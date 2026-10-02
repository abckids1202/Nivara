import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  createPendingOrder,
  releaseReservationsForOrder,
  markPaymentFailed,
  markPaymentReview,
  getIdentity,
  consumeRateLimit,
  providerFetch,
} = vi.hoisted(() => ({
  createPendingOrder: vi.fn(),
  releaseReservationsForOrder: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentReview: vi.fn(),
  getIdentity: vi.fn(),
  consumeRateLimit: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock('@/lib/checkout', () => ({
  CheckoutConflict: class CheckoutConflict extends Error {},
  createPendingOrder,
  releaseReservationsForOrder,
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));
vi.mock('@/lib/payment-state', () => ({
  markPaymentFailed,
  markPaymentReview,
}));

import { POST } from '@/app/api/checkout/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  createPendingOrder.mockReset();
  releaseReservationsForOrder.mockReset();
  markPaymentFailed.mockReset();
  markPaymentReview.mockReset();
  getIdentity.mockReset();
  consumeRateLimit.mockReset();
  providerFetch.mockReset();
});

function checkoutRequest() {
  return new Request('https://nivara.example/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'shopper@example.com',
      fullName: 'Test Shopper',
      line1: '1 Example Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'IN',
      items: [{ variantId: 'variant-1', quantity: 1 }],
    }),
  });
}

describe('checkout route payment setup', () => {
  it('releases reservations when Razorpay credentials are unavailable', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    consumeRateLimit.mockResolvedValue(true);
    getIdentity.mockResolvedValue(null);
    createPendingOrder.mockResolvedValue({
      order: {
        id: 'order-1',
        orderNumber: 'NV-1',
        totalPaise: 72_900,
        payments: [{ id: 'payment-1' }],
      },
      guestAccessToken: 'guest-token',
    });

    const response = await POST(checkoutRequest());
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Razorpay test credentials are not configured');
    expect(markPaymentFailed).toHaveBeenCalledWith('payment-1', 'CANCELLED');
  });

  it('releases reservations when Razorpay rejects order creation', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    consumeRateLimit.mockResolvedValue(true);
    getIdentity.mockResolvedValue(null);
    createPendingOrder.mockResolvedValue({
      order: {
        id: 'order-2',
        orderNumber: 'NV-2',
        totalPaise: 72_900,
        payments: [{ id: 'payment-2' }],
      },
      guestAccessToken: 'guest-token',
    });
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'provider unavailable' }), {
        status: 502,
      }),
    );

    const response = await POST(checkoutRequest());
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Razorpay could not create the test payment');
    expect(markPaymentFailed).toHaveBeenCalledWith('payment-2', 'CANCELLED');
  });

  it('moves uncertain provider failures into payment review', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    consumeRateLimit.mockResolvedValue(true);
    getIdentity.mockResolvedValue(null);
    createPendingOrder.mockResolvedValue({
      order: {
        id: 'order-3',
        orderNumber: 'NV-3',
        totalPaise: 72_900,
        payments: [{ id: 'payment-3' }],
      },
      guestAccessToken: 'guest-token',
    });
    providerFetch.mockRejectedValue(new Error('provider timeout'));

    const response = await POST(checkoutRequest());
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Checkout is temporarily unavailable');
    expect(markPaymentReview).toHaveBeenCalledWith('payment-3');
    expect(markPaymentFailed).not.toHaveBeenCalled();
  });

  it('moves a malformed provider success into payment review', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    consumeRateLimit.mockResolvedValue(true);
    getIdentity.mockResolvedValue(null);
    createPendingOrder.mockResolvedValue({
      order: {
        id: 'order-4',
        orderNumber: 'NV-4',
        totalPaise: 72_900,
        payments: [{ id: 'payment-4' }],
      },
      guestAccessToken: 'guest-token',
    });
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'order_wrong', amount: 1 }), {
        status: 200,
      }),
    );

    const response = await POST(checkoutRequest());
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Razorpay returned a mismatched payment order');
    expect(markPaymentReview).toHaveBeenCalledWith('payment-4');
    expect(markPaymentFailed).not.toHaveBeenCalled();
  });
});
