import { CheckoutConflict, prepareRetryPayment, releaseReservationsForOrder } from '@/lib/checkout';
import { badRequest, conflict, noStore, unauthorized, unavailable } from '@/lib/http';
import { markPaymentFailed } from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity } from '@/lib/server-auth';
import { providerFetch } from '@/lib/provider-fetch';
import { consumeRateLimit } from '@/lib/access-rate';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';
import { readRazorpayOrderId } from '@/lib/razorpay-order';

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return hasConfiguredValue(keyId) && hasConfiguredValue(secret)
    ? { keyId, authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` }
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  if (!process.env.DATABASE_URL) return unavailable('Payment retry database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'account-payment-retry',
      maxAttempts: 5,
    }))
  )
    return noStore({ error: 'Too many payment retry attempts' }, 429);
  const auth = razorpayAuth();
  if (!auth) return unavailable('Razorpay test credentials are not configured');
  const { orderNumber } = await params;
  let pending;
  try {
    pending = await prepareRetryPayment({ orderNumber, userId: identity.id });
  } catch (error) {
    if (error instanceof CheckoutConflict) return conflict(error.message);
    return badRequest('This order could not be retried');
  }
  try {
    const response = await providerFetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: auth.authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: pending.totalPaise, currency: 'INR', receipt: pending.orderNumber }),
    });
    if (!response.ok) throw new Error('Razorpay could not create the retry payment');
    const razorpayOrder = (await response.json()) as {
      id?: unknown;
      amount?: unknown;
      currency?: unknown;
    };
    const razorpayOrderId = readRazorpayOrderId(razorpayOrder, pending.totalPaise);
    if (!razorpayOrderId) throw new Error('Razorpay returned a mismatched payment order');
    await prisma.$transaction([
      prisma.paymentAttempt.update({ where: { id: pending.paymentAttemptId }, data: { providerOrderId: razorpayOrderId, status: 'PENDING' } }),
      prisma.order.update({ where: { id: pending.orderId }, data: { paymentStatus: 'PENDING' } }),
    ]);
    return noStore({ data: { orderNumber: pending.orderNumber, razorpayOrderId, keyId: auth.keyId, amountPaise: pending.totalPaise, currency: 'INR' } });
  } catch (error) {
    await markPaymentFailed(pending.paymentAttemptId, 'FAILED').catch(() => undefined);
    await releaseReservationsForOrder(pending.orderId).catch(() => undefined);
    logServerError('account_payment_retry_failed', error);
    return unavailable('Payment retry is unavailable');
  }
}
