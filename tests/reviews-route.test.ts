import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstOrderItem,
  findReviews,
  createReview,
  getIdentity,
  consumeRateLimit,
  logServerError,
} = vi.hoisted(() => ({
  findFirstOrderItem: vi.fn(),
  findReviews: vi.fn(),
  createReview: vi.fn(),
  getIdentity: vi.fn(),
  consumeRateLimit: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findFirst: findFirstOrderItem },
    review: { findMany: findReviews, create: createReview },
  },
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET, POST } from '@/app/api/reviews/route';

const originalDatabaseUrl = process.env.DATABASE_URL;
const requestBody = {
  productId: 'product-1',
  orderItemId: 'item-1',
  rating: 5,
  body: 'This piece looks beautiful in our home.',
  displayName: 'Test Shopper',
};

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findFirstOrderItem.mockReset();
  findReviews.mockReset();
  createReview.mockReset();
  getIdentity.mockReset();
  consumeRateLimit.mockReset();
  logServerError.mockReset();
});

describe('review submission route', () => {
  it('returns non-cacheable approved reviews', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findReviews.mockResolvedValue([]);

    const response = await GET(
      new Request('https://nivara.example/api/reviews?productId=product-1'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a safe response when approved reviews cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findReviews.mockRejectedValue(new Error('private review database details'));

    const response = await GET(
      new Request('https://nivara.example/api/reviews?productId=product-1'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Reviews are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'reviews_query_failed',
      expect.any(Error),
    );
  });

  it('requires a delivered paid order item', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'user-1', email: 'shopper@nivara.in' });
    consumeRateLimit.mockResolvedValue(true);
    findFirstOrderItem.mockResolvedValue(null);

    const response = await POST(
      new Request('https://nivara.example/api/reviews', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(403);
    expect(createReview).not.toHaveBeenCalled();
  });

  it('creates a pending review for a delivered paid order item', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'user-1', email: 'shopper@nivara.in' });
    consumeRateLimit.mockResolvedValue(true);
    findFirstOrderItem.mockResolvedValue({ id: 'item-1' });
    createReview.mockResolvedValue({ id: 'review-1', status: 'PENDING' });

    const response = await POST(
      new Request('https://nivara.example/api/reviews', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(createReview).toHaveBeenCalledWith({
      data: {
        productId: 'product-1',
        orderItemId: 'item-1',
        userId: 'user-1',
        rating: 5,
        body: requestBody.body,
        displayName: requestBody.displayName,
      },
      select: {
        id: true,
        rating: true,
        body: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });
  });

  it('turns a duplicate order-item review into a client error', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'user-1', email: 'shopper@nivara.in' });
    consumeRateLimit.mockResolvedValue(true);
    findFirstOrderItem.mockResolvedValue({ id: 'item-1' });
    createReview.mockRejectedValue(new Error('Unique constraint failed'));

    const response = await POST(
      new Request('https://nivara.example/api/reviews', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
  });
});
