import { afterEach, describe, expect, it, vi } from 'vitest';

const { transaction } = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));

import {
  fulfilPaymentReview,
  markPaymentPaid,
} from '@/lib/payment-state';

afterEach(() => {
  transaction.mockReset();
});

describe('payment-state capture transitions', () => {
  it('manually fulfils a captured review when expired reservations still have stock', async () => {
    const paymentAttempt = {
      id: 'payment-review',
      orderId: 'order-review',
      status: 'PAID_REVIEW' as const,
      providerPaymentId: 'pay-review',
      order: { paymentStatus: 'PAID_REVIEW' as const },
    };
    const paymentAttemptFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ orderId: 'order-review' })
      .mockResolvedValueOnce(paymentAttempt);
    const paymentAttemptUpdate = vi.fn().mockResolvedValue(paymentAttempt);
    const orderUpdate = vi.fn().mockResolvedValue({});
    const reservationUpdate = vi.fn().mockResolvedValue({});
    const variantUpdate = vi.fn().mockResolvedValue({});
    const resolutionUpsert = vi.fn().mockResolvedValue({ id: 'resolution-1' });
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'variant-1', stockOnHand: 4 }]),
      paymentAttempt: {
        findUnique: paymentAttemptFindUnique,
        update: paymentAttemptUpdate,
      },
      order: { update: orderUpdate },
      inventoryReservation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'reservation-review',
            variantId: 'variant-1',
            quantity: 1,
            status: 'EXPIRED' as const,
          },
        ]),
        update: reservationUpdate,
      },
      productVariant: { update: variantUpdate },
      paymentReviewResolution: { upsert: resolutionUpsert },
      auditLog: { create: auditCreate },
    };
    transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      fulfilPaymentReview({
        paymentAttemptId: 'payment-review',
        orderId: 'order-review',
        resolution: {
          adminUserId: 'admin-1',
          reason: 'Captured payment confirmed and stock is available.',
        },
      }),
    ).resolves.toEqual({
      status: 'fulfilled',
      orderId: 'order-review',
      resolution: { id: 'resolution-1' },
    });
    expect(variantUpdate).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: { stockOnHand: { decrement: 1 }, stockReserved: undefined },
    });
    expect(reservationUpdate).toHaveBeenCalledWith({
      where: { id: 'reservation-review' },
      data: { status: 'CONVERTED' },
    });
    expect(paymentAttemptUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-review' },
      data: { status: 'PAID', providerPaymentId: undefined },
    });
    expect(resolutionUpsert).toHaveBeenCalledWith({
      where: { orderId: 'order-review' },
      create: {
        orderId: 'order-review',
        adminUserId: 'admin-1',
        action: 'FULFIL',
        reason: 'Captured payment confirmed and stock is available.',
      },
      update: {
        adminUserId: 'admin-1',
        action: 'FULFIL',
        reason: 'Captured payment confirmed and stock is available.',
        refundReference: null,
      },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'order.payment_review_fulfil',
        entityType: 'Order',
        entityId: 'order-review',
        details: {
          reason: 'Captured payment confirmed and stock is available.',
        },
      },
    });
  });

  it('routes a capture with no reservations to manual review', async () => {
    const paymentAttempt = {
      id: 'payment-empty',
      orderId: 'order-empty',
      status: 'PENDING' as const,
      order: { paymentStatus: 'PENDING' as const },
    };
    const paymentAttemptFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ orderId: 'order-empty' })
      .mockResolvedValueOnce(paymentAttempt);
    const paymentAttemptUpdate = vi.fn().mockResolvedValue(paymentAttempt);
    const orderUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
      paymentAttempt: {
        findUnique: paymentAttemptFindUnique,
        update: paymentAttemptUpdate,
      },
      order: { update: orderUpdate },
      inventoryReservation: { findMany: vi.fn().mockResolvedValue([]) },
    };
    transaction.mockImplementation(async (callback) => callback(tx));

    await expect(
      markPaymentPaid({
        paymentAttemptId: 'payment-empty',
        providerPaymentId: 'pay-empty',
      }),
    ).resolves.toEqual({ status: 'paid_review', orderId: 'order-empty' });
    expect(paymentAttemptUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-empty' },
      data: { status: 'PAID_REVIEW', providerPaymentId: 'pay-empty' },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-empty' },
      data: { paymentStatus: 'PAID_REVIEW' },
    });
  });

  it('routes a capture against an expired reservation to manual review', async () => {
    const paymentAttempt = {
      id: 'payment-1',
      orderId: 'order-1',
      status: 'PENDING' as const,
      order: { paymentStatus: 'PENDING' as const },
    };
    const paymentAttemptFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ orderId: 'order-1' })
      .mockResolvedValueOnce(paymentAttempt);
    const productVariantUpdate = vi.fn();
    const paymentAttemptUpdate = vi.fn().mockResolvedValue(paymentAttempt);
    const orderUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'variant-1', stockOnHand: 5, stockReserved: 0 },
        ]),
      paymentAttempt: {
        findUnique: paymentAttemptFindUnique,
        update: paymentAttemptUpdate,
      },
      order: { update: orderUpdate },
      inventoryReservation: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'reservation-1',
            variantId: 'variant-1',
            quantity: 1,
            status: 'EXPIRED' as const,
          },
        ]),
      },
      productVariant: { update: productVariantUpdate },
      inventoryReservationUpdate: vi.fn(),
    };
    transaction.mockImplementation(async (callback) => callback(tx));

    const result = await markPaymentPaid({
      paymentAttemptId: 'payment-1',
      providerPaymentId: 'pay_1',
    });

    expect(result).toEqual({ status: 'paid_review', orderId: 'order-1' });
    expect(paymentAttemptUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'PAID_REVIEW', providerPaymentId: 'pay_1' },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { paymentStatus: 'PAID_REVIEW' },
    });
    expect(productVariantUpdate).not.toHaveBeenCalled();
  });
});
