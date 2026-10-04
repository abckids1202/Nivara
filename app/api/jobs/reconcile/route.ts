import {
  markPaymentFailed,
  markPaymentPaid,
  markPaymentReview,
} from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { noStore, unauthorized, unavailable } from '@/lib/http';
import { sendOrderConfirmationEmail } from '@/lib/email';
import {
  expireReservationsForOrder,
  releaseReservationsForOrder,
} from '@/lib/checkout';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';
import { processStorageCleanupTasks } from '@/lib/storage-cleanup';

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!hasConfiguredValue(keyId) || !hasConfiguredValue(secret)) return null;
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`;
}

async function readRazorpayOrderStatus(auth: string, providerOrderId: string) {
  try {
    const response = await providerFetch(
      `https://api.razorpay.com/v1/orders/${providerOrderId}`,
      {
        headers: { Authorization: auth },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as {
      status?: unknown;
    } | null;
    return typeof body?.status === 'string' ? body.status : null;
  } catch {
    return null;
  }
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

  try {
    const storageCleanup = await processStorageCleanupTasks();
    const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [deletedRateLogs, deletedGuestAttempts] = await prisma.$transaction([
      prisma.accessRateLog.deleteMany({
        where: { createdAt: { lt: retentionCutoff } },
      }),
      prisma.guestOrderAccessAttempt.deleteMany({
        where: { createdAt: { lt: retentionCutoff } },
      }),
    ]);

    const expiredReservations = await prisma.inventoryReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
      include: {
        order: {
          include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const processed = {
      paid: 0,
      released: 0,
      review: 0,
      skipped: 0,
      emailRetried: 0,
      providerUnavailable: !auth,
      storageCleanup,
      deletedRateLogs: deletedRateLogs.count,
      deletedGuestAttempts: deletedGuestAttempts.count,
    };
    const processedOrders = new Set<string>();
    const processedPaymentAttempts = new Set<string>();

    for (const reservation of expiredReservations) {
      if (processedOrders.has(reservation.orderId)) continue;
      processedOrders.add(reservation.orderId);
      const payment = reservation.order.payments[0];
      if (payment) processedPaymentAttempts.add(payment.id);
      if (!payment?.providerOrderId) {
        await expireReservationsForOrder(reservation.orderId);
        if (
          payment &&
          (payment.status === 'PAYMENT_REVIEW' ||
            reservation.order.paymentStatus === 'PAYMENT_REVIEW')
        ) {
          // There is no provider order ID to poll, so preserve the
          // uncertainty for an administrator instead of guessing cancellation.
          processed.review += 1;
        } else if (payment) {
          await markPaymentFailed(payment.id, 'CANCELLED');
          processed.released += 1;
        } else {
          await releaseReservationsForOrder(reservation.orderId);
          processed.released += 1;
        }
        continue;
      }

      if (!auth) {
        await expireReservationsForOrder(reservation.orderId);
        await markPaymentReview(payment.id);
        processed.review += 1;
        continue;
      }

      const providerStatus = await readRazorpayOrderStatus(
        auth,
        payment.providerOrderId,
      );
      if (!providerStatus) {
        await expireReservationsForOrder(reservation.orderId);
        processed.review += 1;
        await markPaymentReview(payment.id);
        continue;
      }
      if (providerStatus === 'paid') {
        const result = await markPaymentPaid({ paymentAttemptId: payment.id });
        if (result.status === 'paid' && result.orderId)
          await sendOrderConfirmationEmail(result.orderId);
        if (result.status === 'paid' || result.status === 'already_paid')
          processed.paid += 1;
        else processed.review += 1;
      } else if (providerStatus === 'created') {
        await expireReservationsForOrder(reservation.orderId);
        await markPaymentFailed(payment.id, 'CANCELLED');
        processed.released += 1;
      } else {
        await expireReservationsForOrder(reservation.orderId);
        await markPaymentReview(payment.id);
        processed.review += 1;
      }
    }

    // A provider lookup failure above moves the payment into PAYMENT_REVIEW
    // after its reservation expires. Keep polling those attempts on later
    // runs; otherwise they would disappear from the active-reservation query
    // and remain unresolved forever.
    const reviewPayments = await prisma.paymentAttempt.findMany({
      where: {
        status: 'PAYMENT_REVIEW',
        providerOrderId: { not: null },
        order: { paymentStatus: 'PAYMENT_REVIEW' },
      },
      select: { id: true, providerOrderId: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    for (const payment of reviewPayments) {
      if (processedPaymentAttempts.has(payment.id) || !payment.providerOrderId)
        continue;
      processedPaymentAttempts.add(payment.id);
      if (!auth) {
        processed.review += 1;
        continue;
      }
      const providerStatus = await readRazorpayOrderStatus(
        auth,
        payment.providerOrderId,
      );
      if (providerStatus === 'paid') {
        const result = await markPaymentPaid({ paymentAttemptId: payment.id });
        if (result.status === 'paid' && result.orderId) {
          await sendOrderConfirmationEmail(result.orderId);
          processed.paid += 1;
        } else {
          processed.review += 1;
        }
      } else if (providerStatus === 'failed' || providerStatus === 'cancelled') {
        await markPaymentFailed(
          payment.id,
          providerStatus === 'cancelled' ? 'CANCELLED' : 'FAILED',
        );
        processed.released += 1;
      } else {
        // Keep network errors and still-open provider orders in the manual
        // review queue rather than guessing a financial outcome.
        processed.review += 1;
      }
    }

    if (
      hasConfiguredValue(process.env.RESEND_API_KEY) &&
      hasConfiguredValue(process.env.RESEND_FROM_EMAIL, ['example.com'])
    ) {
      const ordersNeedingConfirmation = await prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          emailDeliveries: {
            none: { kind: 'ORDER_CONFIRMATION', status: 'SENT' },
          },
        },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
        take: 100,
      });
      for (const order of ordersNeedingConfirmation) {
        const result = await sendOrderConfirmationEmail(order.id);
        if (result.sent) processed.emailRetried += 1;
      }
    }

    return noStore({ processed });
  } catch (error) {
    logServerError('reconciliation_job_failed', error);
    return unavailable('Reconciliation is temporarily unavailable');
  }
}
