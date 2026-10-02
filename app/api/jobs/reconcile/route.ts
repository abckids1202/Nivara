import {
  markPaymentFailed,
  markPaymentPaid,
  markPaymentReview,
} from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { noStore, unauthorized, unavailable } from '@/lib/http';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { releaseReservationsForOrder } from '@/lib/checkout';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!hasConfiguredValue(keyId) || !hasConfiguredValue(secret)) return null;
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get('authorization') !== `Bearer ${cronSecret}`
  ) {
    return unauthorized();
  }
  if (!process.env.DATABASE_URL)
    return unavailable('Reconciliation database is not configured');

  const auth = razorpayAuth();
  if (!auth) return unavailable('Razorpay credentials are not configured');

  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [deletedRateLogs, deletedGuestAttempts] = await prisma.$transaction([
    prisma.accessRateLog.deleteMany({ where: { createdAt: { lt: retentionCutoff } } }),
    prisma.guestOrderAccessAttempt.deleteMany({ where: { createdAt: { lt: retentionCutoff } } }),
  ]);

  const expiredReservations = await prisma.inventoryReservation.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    include: {
      order: {
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
    take: 100,
  });
  const processed = {
    paid: 0,
    released: 0,
    review: 0,
    skipped: 0,
    deletedRateLogs: deletedRateLogs.count,
    deletedGuestAttempts: deletedGuestAttempts.count,
  };
  const processedOrders = new Set<string>();

  for (const reservation of expiredReservations) {
    if (processedOrders.has(reservation.orderId)) continue;
    processedOrders.add(reservation.orderId);
    const payment = reservation.order.payments[0];
    if (!payment?.providerOrderId) {
      if (payment) await markPaymentFailed(payment.id, 'CANCELLED');
      else await releaseReservationsForOrder(reservation.orderId);
      processed.released += 1;
      continue;
    }

    let response: Response;
    try {
      response = await providerFetch(
        `https://api.razorpay.com/v1/orders/${payment.providerOrderId}`,
        {
          headers: { Authorization: auth },
          cache: 'no-store',
        },
      );
    } catch {
      processed.review += 1;
      await markPaymentReview(payment.id);
      continue;
    }
    if (!response.ok) {
      processed.review += 1;
      await markPaymentReview(payment.id);
      continue;
    }

    const providerOrder = (await response.json()) as { status?: string };
    if (providerOrder.status === 'paid') {
      const result = await markPaymentPaid({ paymentAttemptId: payment.id });
      if (result.status === 'paid' && result.orderId)
        await sendOrderConfirmationEmail(result.orderId);
      processed.paid += 1;
    } else if (providerOrder.status === 'created') {
      await markPaymentFailed(payment.id, 'CANCELLED');
      processed.released += 1;
    } else {
      await markPaymentReview(payment.id);
      processed.review += 1;
    }
  }

  return noStore({ processed });
}
