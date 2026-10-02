import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, findFirst, logServerError } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  findFirst: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findFirst } } }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST } from '@/app/api/guest-orders/[token]/retry-payment/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  consumeRateLimit.mockReset();
  findFirst.mockReset();
  logServerError.mockReset();
});

describe('guest payment retry route resilience', () => {
  it('returns a safe response when the guest order lookup fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    consumeRateLimit.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('private guest order details'));

    const response = await POST(
      new Request(
        'https://nivara.example/api/guest-orders/secret/retry-payment',
        {
          method: 'POST',
        },
      ),
      { params: Promise.resolve({ token: 'secret' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Payment retry is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'guest_payment_retry_lookup_failed',
      expect.any(Error),
    );
  });
});
