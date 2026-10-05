import { afterEach, describe, expect, it, vi } from 'vitest';

const { findUnique, findOrCreateCart, getIdentity, logServerError } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    findOrCreateCart: vi.fn(),
    getIdentity: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({ prisma: { wishlist: { findUnique } } }));
vi.mock('@/lib/cart', () => ({
  CART_COOKIE: 'nivara-cart',
  clearCartCookieHeader: vi.fn(),
  isCartKey: vi.fn(() => true),
  readCookie: vi.fn(() => null),
}));
vi.mock('@/lib/cart-merge', () => ({ mergedCartQuantity: vi.fn() }));
vi.mock('@/lib/server-auth', () => ({
  ensureUserProfile: vi.fn(),
  getAuthenticatedIdentity: getIdentity,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET as getWishlist } from '@/app/api/wishlist/route';
import { POST as mergeCart } from '@/app/api/cart/merge/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findUnique.mockReset();
  findOrCreateCart.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('wishlist and cart merge resilience', () => {
  it('returns a safe response when the wishlist cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    findUnique.mockRejectedValue(new Error('private wishlist details'));

    const response = await getWishlist(
      new Request('https://nivara.example/api/wishlist'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Wishlist is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'wishlist_read_failed',
      expect.any(Error),
    );
  });

  it('returns a safe response when cart merge fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    vi.mocked((await import('@/lib/cart')).readCookie).mockReturnValue(
      'guest-key',
    );
    vi.mocked(
      (await import('@/lib/server-auth')).ensureUserProfile,
    ).mockRejectedValue(new Error('private merge details'));

    const response = await mergeCart(
      new Request('https://nivara.example/api/cart/merge'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Cart merge is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'cart_merge_failed',
      expect.any(Error),
    );
  });
});
