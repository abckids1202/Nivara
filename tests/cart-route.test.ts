import { afterEach, describe, expect, it, vi } from 'vitest';

const { findOrCreateCart, getIdentity, logServerError } = vi.hoisted(() => ({
  findOrCreateCart: vi.fn(),
  getIdentity: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/cart', () => ({
  CART_COOKIE: 'nivara-cart',
  cartCookieHeader: vi.fn(),
  createCartKey: vi.fn(),
  findOrCreateCart,
  readCookie: vi.fn(() => null),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVariant: { findFirst: vi.fn() },
    cartItem: { upsert: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/cart/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findOrCreateCart.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('cart route resilience', () => {
  it('returns a safe response when the cart cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(null);
    findOrCreateCart.mockRejectedValue(new Error('private cart details'));

    const response = await GET(new Request('https://nivara.example/api/cart'));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Cart is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'cart_read_failed',
      expect.any(Error),
    );
  });
});
