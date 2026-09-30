import { createHash } from 'node:crypto';
import { CheckoutConflict, prepareRetryPayment, releaseReservationsForOrder } from '@/lib/checkout';
import { consumeRateLimit } from '@/lib/access-rate';
import { badRequest, conflict, json, unavailable } from '@/lib/http';
import { markPaymentFailed } from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { providerFetch } from '@/lib/provider-fetch';

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && secret
    ? { keyId, authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}` }
    : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL) return unavailable('Guest payment retry is not configured');
  if (!(await consumeRateLimit({ request, endpoint: 'guest-payment-retry', maxAttempts: 5 })))
    return json({ error: 'Too many payment retry attempts' }, 429);
  const auth = razorpayAuth();
  if (!auth) return unavailable('Razorpay test credentials are not configured');
  const { token } = await params;
  const guestAccessHash = createHash('sha256').update(token).digest('hex');
  const order = await prisma.order.findFirst({
    where: { guestAccessHash, guestAccessExpiry: { gt: new Date() } },
    select: { orderNumber: true },
  });
  if (!order) return json({ error: 'Order link is invalid or expired' }, 404);

  let pending;
  try {
    pending = await prepareRetryPayment({ orderNumber: order.orderNumber, guestAccessHash });
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
    const razorpayOrder = (await response.json()) as { id?: string };
    if (!razorpayOrder.id) throw new Error('Razorpay returned an invalid payment order');
    await prisma.$transaction([
      prisma.paymentAttempt.update({ where: { id: pending.paymentAttemptId }, data: { providerOrderId: razorpayOrder.id, status: 'PENDING' } }),
      prisma.order.update({ where: { id: pending.orderId }, data: { paymentStatus: 'PENDING' } }),
    ]);
    return json({ data: { orderNumber: pending.orderNumber, razorpayOrderId: razorpayOrder.id, keyId: auth.keyId, amountPaise: pending.totalPaise, currency: 'INR' } });
  } catch (error) {
    await markPaymentFailed(pending.paymentAttemptId, 'FAILED').catch(() => undefined);
    await releaseReservationsForOrder(pending.orderId).catch(() => undefined);
    return unavailable(error instanceof Error ? error.message : 'Payment retry is unavailable');
  }
}
