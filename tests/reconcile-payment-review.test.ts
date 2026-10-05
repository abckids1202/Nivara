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
  it('expires reservations even when provider credentials are temporarily unavailable', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    transaction.mockResolvedValue([{ count: 0 }, { count: 0 }]);
    processStorageCleanupTasks.mockResolvedValue({
      completed: 0,
      failed: 0,
      purged: 0,
      skipped: false,
    });
    expiredReservations.mockResolvedValue([
      {
        orderId: 'order-no-provider',
        order: {
          paymentStatus: 'PENDING',
          payments: [{ id: 'payment-no-provider', providerOrderId: null }],
        },
      },
    ]);
    reviewPayments.mockResolvedValue([]);
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });
    expireReservationsForOrder.mockResolvedValue({ expired: 1 });
    markPaymentFailed.mockResolvedValue({ status: 'cancelled' });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as {
      processed?: { released?: number; providerUnavailable?: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.processed).toMatchObject({
      released: 1,
      providerUnavailable: true,
    });
    expect(expireReservationsForOrder).toHaveBeenCalledWith('order-no-provider');
    expect(markPaymentFailed).toHaveBeenCalledWith(
      'payment-no-provider',
      'CANCELLED',
    );
    expect(providerFetch).not.toHaveBeenCalled();
  });

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

  it('keeps an uncertain payment without a provider ID in manual review', async () => {
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
        orderId: 'order-4',
        order: {
          paymentStatus: 'PAYMENT_REVIEW',
          payments: [{ id: 'payment-4', providerOrderId: null, status: 'PAYMENT_REVIEW' }],
        },
      },
    ]);
    reviewPayments.mockResolvedValue([]);
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as {
      processed?: { released?: number; review?: number };
    };

    expect(response.status).toBe(200);
    expect(body.processed).toMatchObject({ released: 0, review: 1 });
    expect(expireReservationsForOrder).toHaveBeenCalledWith('order-4');
    expect(markPaymentFailed).not.toHaveBeenCalled();
  });

  it('recovers a pending payment after reservation release but before state update', async () => {
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
      { id: 'payment-orphaned', providerOrderId: null },
    ]);
    orderFindMany.mockResolvedValue([]);
    accessRateDeleteMany.mockResolvedValue({ count: 0 });
    guestAttemptDeleteMany.mockResolvedValue({ count: 0 });

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as {
      processed?: { review?: number };
    };

    expect(response.status).toBe(200);
    expect(body.processed?.review).toBe(1);
    expect(markPaymentReview).toHaveBeenCalledWith('payment-orphaned');
  });
});
