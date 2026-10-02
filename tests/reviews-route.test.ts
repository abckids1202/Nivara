import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirstOrderItem, createReview, getIdentity, consumeRateLimit } = vi.hoisted(() => ({
  findFirstOrderItem: vi.fn(),
  createReview: vi.fn(),
  getIdentity: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: { findFirst: findFirstOrderItem },
    review: { create: createReview },
  },
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));

import { POST } from '@/app/api/reviews/route';

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
  createReview.mockReset();
  getIdentity.mockReset();
  consumeRateLimit.mockReset();
});

describe('review submission route', () => {
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
