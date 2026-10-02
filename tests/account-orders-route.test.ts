import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, getIdentity, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  getIdentity: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany } } }));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/account/orders/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('account orders route resilience', () => {
  it('returns a safe response when order history cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    findMany.mockRejectedValue(new Error('private order details'));

    const response = await GET(
      new Request('https://nivara.example/api/account/orders'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Orders are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'account_orders_read_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
