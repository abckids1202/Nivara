import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canMarkPaymentReview } from '@/lib/payment-rules';
import {
  canConvertReservation,
  decidePaymentCapture,
} from '@/lib/payment-rules';

async function lockOrderReservations(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "InventoryReservation"
    WHERE "orderId" = ${orderId}
    FOR UPDATE
  `);
  return tx.inventoryReservation.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });
}

async function lockPaymentAttempt(
  tx: Prisma.TransactionClient,
  paymentAttemptId: string,
) {
  const reference = await tx.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
    select: { orderId: true },
  });
  if (!reference) return null;
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "Order"
    WHERE "id" = ${reference.orderId}
    FOR UPDATE
  `);
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "PaymentAttempt"
    WHERE "id" = ${paymentAttemptId}
    FOR UPDATE
  `);
  return tx.paymentAttempt.findUnique({
    where: { id: paymentAttemptId },
    include: { order: true },
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
    const payment = await lockPaymentAttempt(tx, paymentAttemptId);
    if (!payment) return { status: 'missing' as const };
    const captureDecision = decidePaymentCapture({
      paymentStatus: payment.status,
      orderStatus: payment.order.paymentStatus,
    });
    if (captureDecision === 'already_paid') {
      return { status: 'already_paid' as const, orderId: payment.orderId };
    }
    if (captureDecision === 'paid_review') {
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

    const reservations = await lockOrderReservations(tx, payment.orderId);
    if (!reservations.length) {
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
    const payment = await lockPaymentAttempt(tx, paymentAttemptId);
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

    const reservations = await lockOrderReservations(tx, payment.orderId);
    const activeReservations = reservations.filter(
      (reservation) => reservation.status === 'ACTIVE',
    );
    for (const reservation of activeReservations) {
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
  return prisma.$transaction(async (tx) => {
    const payment = await lockPaymentAttempt(tx, paymentAttemptId);
    if (!payment) return { status: 'missing' as const };
    if (payment.status === 'PAID' || payment.order.paymentStatus === 'PAID')
      return { status: 'already_paid' as const, orderId: payment.orderId };
    if (
      payment.status === 'PAYMENT_REVIEW' &&
      payment.order.paymentStatus === 'PAYMENT_REVIEW'
    )
      return { status: 'payment_review' as const, orderId: payment.orderId };
    if (
      !canMarkPaymentReview({
        paymentStatus: payment.status,
        orderStatus: payment.order.paymentStatus,
      })
    )
      return { status: 'unchanged' as const, orderId: payment.orderId };
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { status: 'PAYMENT_REVIEW' },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'PAYMENT_REVIEW' },
    });
    return { status: 'payment_review' as const, orderId: payment.orderId };
  });
}

export async function cancelPaymentReview({
  paymentAttemptId,
  orderId,
  refundReference,
}: {
  paymentAttemptId: string;
  orderId: string;
  refundReference?: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `);
    const payment = await lockPaymentAttempt(tx, paymentAttemptId);
    if (!payment || payment.orderId !== orderId)
      return { status: 'missing' as const };
    if (
      payment.order.paymentStatus !== 'PAYMENT_REVIEW' &&
      payment.order.paymentStatus !== 'PAID_REVIEW'
    )
      return { status: 'not_review' as const, orderId };

    const reservations = await lockOrderReservations(tx, orderId);
    const activeReservations = reservations.filter(
      (reservation) => reservation.status === 'ACTIVE',
    );
    for (const reservation of activeReservations) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockReserved: { decrement: reservation.quantity } },
      });
    }
    await tx.inventoryReservation.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
    await tx.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: {
        status: 'CANCELLED',
        ...(refundReference ? { refundReference } : {}),
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'CANCELLED' },
    });
    return { status: 'cancelled' as const, orderId };
  });
}
