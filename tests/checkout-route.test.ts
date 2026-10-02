import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  createPendingOrder,
  releaseReservationsForOrder,
  getIdentity,
  consumeRateLimit,
} = vi.hoisted(() => ({
  createPendingOrder: vi.fn(),
  releaseReservationsForOrder: vi.fn(),
  getIdentity: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('@/lib/checkout', () => ({
  CheckoutConflict: class CheckoutConflict extends Error {},
  createPendingOrder,
  releaseReservationsForOrder,
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));

import { POST } from '@/app/api/checkout/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  createPendingOrder.mockReset();
  releaseReservationsForOrder.mockReset();
  getIdentity.mockReset();
  consumeRateLimit.mockReset();
});

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

    const response = await POST(
      new Request('https://nivara.example/api/checkout', {
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
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Razorpay test credentials are not configured');
    expect(releaseReservationsForOrder).toHaveBeenCalledWith('order-1');
  });
});
