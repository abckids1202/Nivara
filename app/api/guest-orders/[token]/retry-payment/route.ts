import { createHash } from 'node:crypto';
import {
  CheckoutConflict,
  prepareRetryPayment,
  releaseReservationsForOrder,
} from '@/lib/checkout';
import { consumeRateLimit } from '@/lib/access-rate';
import { conflict, noStore, unavailable } from '@/lib/http';
import {
  markPaymentFailed,
  markPaymentReview,
} from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';
import { readRazorpayOrderId } from '@/lib/razorpay-order';

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return hasConfiguredValue(keyId) && hasConfiguredValue(secret)
    ? {
        keyId,
        authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`,
      }
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Guest payment retry is not configured');
  const { token } = await params;
  const guestAccessHash = createHash('sha256').update(token).digest('hex');
  let providerRejected = false;
  try {
    if (
      !(await consumeRateLimit({
        request,
        endpoint: `guest-payment-retry:${guestAccessHash.slice(0, 16)}`,
        maxAttempts: 5,
      }))
    )
      return noStore({ error: 'Too many payment retry attempts' }, 429);
  } catch (error) {
    logServerError('guest_payment_retry_rate_limit_failed', error);
    return unavailable('Payment retry is temporarily unavailable');
  }
  const auth = razorpayAuth();
  if (!auth) return unavailable('Razorpay test credentials are not configured');
  let order;
  try {
    order = await prisma.order.findFirst({
      where: { guestAccessHash, guestAccessExpiry: { gt: new Date() } },
      select: { orderNumber: true },
    });
  } catch (error) {
    logServerError('guest_payment_retry_lookup_failed', error);
    return unavailable('Payment retry is temporarily unavailable');
  }
  if (!order)
    return noStore({ error: 'Order link is invalid or expired' }, 404);

  let pending;
  try {
    pending = await prepareRetryPayment({
      orderNumber: order.orderNumber,
      guestAccessHash,
    });
  } catch (error) {
    if (error instanceof CheckoutConflict) return conflict(error.message);
    logServerError('guest_payment_retry_prepare_failed', error);
    return unavailable('Payment retry is temporarily unavailable');
  }
  try {
    const response = await providerFetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: auth.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pending.totalPaise,
        currency: 'INR',
        receipt: pending.orderNumber,
      }),
    });
    if (!response.ok) {
      providerRejected = true;
      throw new Error('Razorpay could not create the retry payment');
    }
    const razorpayOrder = (await response.json()) as {
      id?: unknown;
      amount?: unknown;
      currency?: unknown;
    };
    const razorpayOrderId = readRazorpayOrderId(
      razorpayOrder,
      pending.totalPaise,
    );
    if (!razorpayOrderId)
      throw new Error('Razorpay returned a mismatched payment order');
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: pending.paymentAttemptId },
        data: { providerOrderId: razorpayOrderId, status: 'PENDING' },
      }),
      prisma.order.update({
        where: { id: pending.orderId },
        data: { paymentStatus: 'PENDING' },
      }),
    ]);
    return noStore({
      data: {
        orderNumber: pending.orderNumber,
        razorpayOrderId,
        keyId: auth.keyId,
        amountPaise: pending.totalPaise,
        currency: 'INR',
      },
    });
  } catch (error) {
    try {
      if (providerRejected)
        await markPaymentFailed(pending.paymentAttemptId, 'FAILED');
      else await markPaymentReview(pending.paymentAttemptId);
    } catch {
      await releaseReservationsForOrder(pending.orderId).catch(() => undefined);
    }
    logServerError('guest_payment_retry_failed', error);
    return unavailable('Payment retry is unavailable');
  }
}
