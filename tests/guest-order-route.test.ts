import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, findFirst, createAttempt, logServerError } =
  vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    findFirst: vi.fn(),
    createAttempt: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst },
    guestOrderAccessAttempt: { create: createAttempt },
  },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/guest-orders/[token]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  consumeRateLimit.mockReset();
  findFirst.mockReset();
  createAttempt.mockReset();
  logServerError.mockReset();
});

describe('guest order route resilience', () => {
  it('returns a safe response when guest order access cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    consumeRateLimit.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('private guest order details'));

    const response = await GET(
      new Request('https://nivara.example/api/guest-orders/secret-token'),
      { params: Promise.resolve({ token: 'secret-token' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Guest order access is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'guest_order_access_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
