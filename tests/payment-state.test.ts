import { afterEach, describe, expect, it, vi } from 'vitest';

const { transaction } = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));

import { markPaymentPaid } from '@/lib/payment-state';

afterEach(() => {
  transaction.mockReset();
});

describe('payment-state capture transitions', () => {
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
