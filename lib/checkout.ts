import { Prisma } from "@prisma/client";
import { createGuestOrderToken } from "@/lib/guest-token";
import { calculateDeliveryFee } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type CheckoutAddress = {
  email: string;
  fullName: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: "IN";
};

export type CheckoutItem = {
  variantId: string;
  quantity: number;
};

export class CheckoutConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutConflict";
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
  const orderNumber = `NV-${Date.now()}-${Math.floor(Math.random() * 10_000).toString().padStart(4, "0")}`;

  return prisma.$transaction(async (tx) => {
    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { select: { name: true } } },
    });

    if (variants.length !== variantIds.length) {
      throw new CheckoutConflict("One or more selected variants are no longer available");
    }

    const lockedVariants = await tx.$queryRaw<Array<{
      id: string;
      stockOnHand: number;
      stockReserved: number;
    }>>(Prisma.sql`
      SELECT "id", "stockOnHand", "stockReserved"
      FROM "ProductVariant"
      WHERE "id" IN (${Prisma.join(variantIds)})
      FOR UPDATE
    `);

    const quantityByVariant = new Map(items.map((item) => [item.variantId, item.quantity]));
    for (const variant of lockedVariants) {
      const requested = quantityByVariant.get(variant.id) ?? 0;
      if (variant.stockOnHand - variant.stockReserved < requested) {
        throw new CheckoutConflict("A selected variant no longer has enough stock");
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
        guestAccessExpiry: guestToken ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
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
        payments: { create: { status: "CREATED" } },
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
      where: { orderId, status: "ACTIVE" },
    });

    for (const reservation of reservations) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: { stockReserved: { decrement: reservation.quantity } },
      });
    }

    await tx.inventoryReservation.updateMany({
      where: { orderId, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
  });
}
