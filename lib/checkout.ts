import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createGuestOrderToken } from '@/lib/guest-token';
import { calculateDeliveryFee } from '@/lib/money';
import { prisma } from '@/lib/prisma';

export type CheckoutAddress = {
  email: string;
  fullName: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'IN';
};

export type CheckoutItem = {
  variantId: string;
  quantity: number;
};

export class CheckoutConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutConflict';
  }
}

export async function createPendingOrder({
  userId,
  address,
  items,
}: {
  userId?: string;
  address: CheckoutAddress;
  items: CheckoutItem[];
}) {
  const guestToken = userId ? null : createGuestOrderToken();
  const orderNumber = `NV-${Date.now()}-${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0')}`;

  return prisma.$transaction(async (tx) => {
    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const variants = await tx.productVariant.findMany({
      where: {
        id: { in: variantIds },
        product: { status: 'PUBLISHED' },
      },
      include: { product: { select: { name: true } } },
    });

    if (variants.length !== variantIds.length) {
      throw new CheckoutConflict(
        'One or more selected variants are no longer available',
      );
    }

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

    const quantityByVariant = new Map(
      items.map((item) => [item.variantId, item.quantity]),
    );
    for (const variant of lockedVariants) {
      const requested = quantityByVariant.get(variant.id) ?? 0;
      if (variant.stockOnHand - variant.stockReserved < requested) {
        throw new CheckoutConflict(
          'A selected variant no longer has enough stock',
        );
      }
    }

    const orderItems = variants.map((variant) => {
      const quantity = quantityByVariant.get(variant.id) ?? 0;
      return {
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        unitPricePaise: variant.pricePaise,
        quantity,
      };
    });

    const subtotalPaise = orderItems.reduce(
      (sum, item) => sum + item.unitPricePaise * item.quantity,
      0,
    );
    const deliveryFeePaise = calculateDeliveryFee(subtotalPaise);

    for (const item of orderItems) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockReserved: { increment: item.quantity } },
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        guestEmail: userId ? null : address.email,
        guestAccessHash: guestToken?.tokenHash,
        guestAccessExpiry: guestToken
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null,
        subtotalPaise,
        deliveryFeePaise,
        totalPaise: subtotalPaise + deliveryFeePaise,
        shippingFullName: address.fullName,
        shippingLine1: address.line1,
        shippingCity: address.city,
        shippingState: address.state,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
        items: { create: orderItems },
        reservations: {
          create: orderItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          })),
        },
        payments: { create: { status: 'CREATED' } },
      },
      include: { payments: true },
    });

    return {
      order,
      guestAccessToken: guestToken?.rawToken ?? null,
    };
  });
}

export async function releaseReservationsForOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.inventoryReservation.findMany({
      where: { orderId, status: 'ACTIVE' },
    });

    for (const reservation of reservations) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockReserved: { decrement: reservation.quantity } },
      });
    }

    await tx.inventoryReservation.updateMany({
      where: { orderId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  });
}

export async function prepareRetryPayment({
  orderNumber,
  userId,
  guestAccessHash,
}: {
  orderNumber: string;
  userId?: string;
  guestAccessHash?: string;
}) {
  if (!userId && !guestAccessHash)
    throw new CheckoutConflict('An order owner is required for payment retry');
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        orderNumber,
        ...(userId ? { userId } : { guestAccessHash }),
        guestAccessExpiry: guestAccessHash ? { gt: new Date() } : undefined,
        paymentStatus: { in: ['FAILED', 'CANCELLED'] },
      },
      include: { items: true },
    });
    if (!order) throw new CheckoutConflict('This order is not eligible for payment retry');

    const variantIds = [...new Set(order.items.map((item) => item.variantId))];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, product: { status: 'PUBLISHED' } },
      select: { id: true, stockOnHand: true, stockReserved: true },
    });
    if (variants.length !== variantIds.length)
      throw new CheckoutConflict('One or more order items are no longer available');

    const lockedVariants = await tx.$queryRaw<
      Array<{ id: string; stockOnHand: number; stockReserved: number }>
    >(Prisma.sql`
      SELECT "id", "stockOnHand", "stockReserved"
      FROM "ProductVariant"
      WHERE "id" IN (${Prisma.join(variantIds)})
      FOR UPDATE
    `);
    const byVariant = new Map(lockedVariants.map((variant) => [variant.id, variant]));
    for (const item of order.items) {
      const variant = byVariant.get(item.variantId);
      if (!variant || variant.stockOnHand - variant.stockReserved < item.quantity)
        throw new CheckoutConflict('A selected order item no longer has enough stock');
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockReserved: { increment: item.quantity } },
      });
      await tx.inventoryReservation.upsert({
        where: { orderId_variantId: { orderId: order.id, variantId: item.variantId } },
        create: { orderId: order.id, variantId: item.variantId, quantity: item.quantity, expiresAt },
        update: { quantity: item.quantity, expiresAt, status: 'ACTIVE' },
      });
    }
    const payment = await tx.paymentAttempt.create({
      data: { orderId: order.id, status: 'CREATED', idempotencyKey: randomUUID() },
    });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PENDING' } });
    return { orderId: order.id, orderNumber: order.orderNumber, totalPaise: order.totalPaise, paymentAttemptId: payment.id };
  });
}
