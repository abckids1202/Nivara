import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canConvertReservation } from '@/lib/payment-rules';

async function lockOrderReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  return tx.inventoryReservation.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });
}

export async function markPaymentPaid({
  paymentAttemptId,
  providerPaymentId,
}: {
  paymentAttemptId: string;
  providerPaymentId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      include: { order: true },
    });
    if (!payment) return { status: 'missing' as const };
    if (payment.status === 'PAID' && payment.order.paymentStatus === 'PAID') {
      return { status: 'already_paid' as const, orderId: payment.orderId };
    }

    const reservations = await lockOrderReservations(tx, payment.orderId);
    const variantIds = reservations.map((reservation) => reservation.variantId);
    const lockedVariants = await tx.$queryRaw<
      Array<{
        id: string;
        stockOnHand: number;
        stockReserved: number;
      }>
    >(Prisma.sql`
      SELECT "id", "stockOnHand", "stockReserved"
      FROM "ProductVariant"
      WHERE "id" IN (${Prisma.join(variantIds)})
      FOR UPDATE
    `);
    const byVariant = new Map(
      lockedVariants.map((variant) => [variant.id, variant]),
    );

    for (const reservation of reservations) {
      const variant = byVariant.get(reservation.variantId);
      if (
        !variant ||
        !canConvertReservation({
          status: reservation.status,
          stockOnHand: variant.stockOnHand,
          quantity: reservation.quantity,
        })
      ) {
        await tx.paymentAttempt.update({
          where: { id: paymentAttemptId },
          data: { status: 'PAID_REVIEW', providerPaymentId },
        });
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: 'PAID_REVIEW' },
        });
        return { status: 'paid_review' as const, orderId: payment.orderId };
      }
    }

    for (const reservation of reservations) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: {
          stockOnHand: { decrement: reservation.quantity },
          stockReserved:
            reservation.status === 'ACTIVE'
              ? { decrement: reservation.quantity }
              : undefined,
        },
      });
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'CONVERTED' },
      });
    }

    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { status: 'PAID', providerPaymentId },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'PAID' },
    });
    return { status: 'paid' as const, orderId: payment.orderId };
  });
}

export async function markPaymentFailed(
  paymentAttemptId: string,
  status: 'FAILED' | 'CANCELLED',
) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      include: { order: true },
    });
    if (!payment) return { status: 'missing' as const };
    if (payment.status === 'PAID' || payment.order.paymentStatus === 'PAID')
      return { status: 'already_paid' as const, orderId: payment.orderId };
    if (
      payment.status === 'PAID_REVIEW' ||
      payment.order.paymentStatus === 'PAID_REVIEW'
    )
      return { status: 'paid_review' as const, orderId: payment.orderId };
    if (payment.status === status && payment.order.paymentStatus === status)
      return {
        status: status.toLowerCase() as 'failed' | 'cancelled',
        orderId: payment.orderId,
      };

    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId: payment.orderId, status: 'ACTIVE' },
    });
    for (const reservation of reservations) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockReserved: { decrement: reservation.quantity } },
      });
    }
    await tx.inventoryReservation.updateMany({
      where: { orderId: payment.orderId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { status },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: status },
    });
    return {
      status: status.toLowerCase() as 'failed' | 'cancelled',
      orderId: payment.orderId,
    };
  });
}

export async function markPaymentReview(paymentAttemptId: string) {
  const payment = await prisma.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
  });
  if (!payment) return { status: 'missing' as const };
  await prisma.$transaction([
    prisma.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { status: 'PAYMENT_REVIEW' },
    }),
    prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'PAYMENT_REVIEW' },
    }),
  ]);
  return { status: 'payment_review' as const, orderId: payment.orderId };
}
