import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  prepareRetryPayment,
  releaseReservationsForOrder,
  markPaymentFailed,
  getIdentity,
  providerFetch,
  consumeRateLimit,
} = vi.hoisted(() => ({
  prepareRetryPayment: vi.fn(),
  releaseReservationsForOrder: vi.fn(),
  markPaymentFailed: vi.fn(),
  getIdentity: vi.fn(),
  providerFetch: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('@/lib/checkout', () => ({
  CheckoutConflict: class CheckoutConflict extends Error {},
  prepareRetryPayment,
  releaseReservationsForOrder,
}));
vi.mock('@/lib/payment-state', () => ({ markPaymentFailed }));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { POST } from '@/app/api/orders/[orderNumber]/retry-payment/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  prepareRetryPayment.mockReset();
  releaseReservationsForOrder.mockReset();
  markPaymentFailed.mockReset();
  getIdentity.mockReset();
  providerFetch.mockReset();
  consumeRateLimit.mockReset();
});

describe('authenticated payment retry route', () => {
  it('cleans up retry state when the provider request fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    consumeRateLimit.mockResolvedValue(true);
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    prepareRetryPayment.mockResolvedValue({
      orderId: 'order-1',
      orderNumber: 'NV-1',
      totalPaise: 72_900,
      paymentAttemptId: 'payment-1',
    });
    markPaymentFailed.mockResolvedValue({ status: 'failed' });
    releaseReservationsForOrder.mockResolvedValue(undefined);
    providerFetch.mockRejectedValue(new Error('provider timeout'));

    const response = await POST(
      new Request('https://nivara.example/api/orders/NV-1/retry-payment', {
        method: 'POST',
      }),
      { params: Promise.resolve({ orderNumber: 'NV-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Payment retry is unavailable');
    expect(markPaymentFailed).toHaveBeenCalledWith('payment-1', 'FAILED');
    expect(releaseReservationsForOrder).toHaveBeenCalledWith('order-1');
  });
});
