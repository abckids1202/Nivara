import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  transaction,
  expiredReservations,
  reviewPayments,
  providerFetch,
  markPaymentPaid,
  markPaymentFailed,
  markPaymentReview,
  expireReservationsForOrder,
  releaseReservationsForOrder,
  sendOrderConfirmationEmail,
  processStorageCleanupTasks,
  orderFindMany,
  accessRateDeleteMany,
  guestAttemptDeleteMany,
} = vi.hoisted(() => ({
  transaction: vi.fn(),
  expiredReservations: vi.fn(),
  reviewPayments: vi.fn(),
  providerFetch: vi.fn(),
  markPaymentPaid: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentReview: vi.fn(),
  expireReservationsForOrder: vi.fn(),
  releaseReservationsForOrder: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
  processStorageCleanupTasks: vi.fn(),
  orderFindMany: vi.fn(),
  accessRateDeleteMany: vi.fn(),
  guestAttemptDeleteMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    inventoryReservation: { findMany: expiredReservations },
    paymentAttempt: { findMany: reviewPayments },
    order: { findMany: orderFindMany },
    accessRateLog: { deleteMany: accessRateDeleteMany },
    guestOrderAccessAttempt: { deleteMany: guestAttemptDeleteMany },
  },
}));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));
vi.mock('@/lib/payment-state', () => ({
  markPaymentPaid,
  markPaymentFailed,
  markPaymentReview,
}));
vi.mock('@/lib/checkout', () => ({
  expireReservationsForOrder,
  releaseReservationsForOrder,
}));
vi.mock('@/lib/email', () => ({ sendOrderConfirmationEmail }));
vi.mock('@/lib/storage-cleanup', () => ({ processStorageCleanupTasks }));
vi.mock('@/lib/safe-logging', () => ({ logServerError: vi.fn() }));

import { GET } from '@/app/api/jobs/reconcile/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  transaction.mockReset();
  expiredReservations.mockReset();
  reviewPayments.mockReset();
  providerFetch.mockReset();
  markPaymentPaid.mockReset();
  markPaymentFailed.mockReset();
  markPaymentReview.mockReset();
  expireReservationsForOrder.mockReset();
  releaseReservationsForOrder.mockReset();
  sendOrderConfirmationEmail.mockReset();
  processStorageCleanupTasks.mockReset();
  orderFindMany.mockReset();
  accessRateDeleteMany.mockReset();
  guestAttemptDeleteMany.mockReset();
});

describe('reconciliation payment-review polling', () => {
  it('rechecks unresolved payment reviews after their reservations expired', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
    processStorageCleanupTasks.mockResolvedValue({
      completed: 0,
      failed: 0,
      purged: 0,
      skipped: false,
    });
    expiredReservations.mockResolvedValue([]);
    reviewPayments.mockResolvedValue([
      { id: 'payment-1', providerOrderId: 'order_Razorpay_1' },
    ]);
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'paid' }), { status: 200 }),
    );
    markPaymentPaid.mockResolvedValue({ status: 'paid', orderId: 'order-1' });
    sendOrderConfirmationEmail.mockResolvedValue({ sent: true });
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as {
      processed?: { paid?: number };
    };

    expect(response.status).toBe(200);
    expect(body.processed?.paid).toBe(1);
    expect(markPaymentPaid).toHaveBeenCalledWith({
      paymentAttemptId: 'payment-1',
    });
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-1');
  });

  it('preserves a provider cancellation as CANCELLED', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
    processStorageCleanupTasks.mockResolvedValue({
      completed: 0,
      failed: 0,
      purged: 0,
      skipped: false,
    });
    expiredReservations.mockResolvedValue([]);
    reviewPayments.mockResolvedValue([
      { id: 'payment-2', providerOrderId: 'order_Razorpay_2' },
    ]);
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 }),
    );
    markPaymentFailed.mockResolvedValue({
      status: 'cancelled',
      orderId: 'order-2',
    });
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );

    expect(response.status).toBe(200);
    expect(markPaymentFailed).toHaveBeenCalledWith('payment-2', 'CANCELLED');
  });

  it('counts a captured payment with unavailable stock as review', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
    processStorageCleanupTasks.mockResolvedValue({
      completed: 0,
      failed: 0,
      purged: 0,
      skipped: false,
    });
    expiredReservations.mockResolvedValue([
      {
        orderId: 'order-3',
        order: {
          payments: [{ id: 'payment-3', providerOrderId: 'provider-order-3' }],
        },
      },
    ]);
    reviewPayments.mockResolvedValue([]);
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'paid' }), { status: 200 }),
    );
    markPaymentPaid.mockResolvedValue({
      status: 'paid_review',
      orderId: 'order-3',
    });
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as {
      processed?: { paid?: number; review?: number };
    };

    expect(response.status).toBe(200);
    expect(body.processed).toMatchObject({ paid: 0, review: 1 });
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});
