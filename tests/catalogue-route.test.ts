import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, count, groupBy, reviewGroupBy, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  reviewGroupBy: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany, count },
    orderItem: { groupBy },
    review: { groupBy: reviewGroupBy },
  },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/catalogue/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findMany.mockReset();
  count.mockReset();
  groupBy.mockReset();
  reviewGroupBy.mockReset();
  logServerError.mockReset();
});

describe('catalogue route resilience', () => {
  it('marks successful catalogue responses as non-cacheable', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('https://nivara.example/api/catalogue'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a safe unavailable response when the database query fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findMany.mockRejectedValue(
      new Error('database password should not escape'),
    );

    const response = await GET(
      new Request('https://nivara.example/api/catalogue'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Catalogue is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('password');
    expect(logServerError).toHaveBeenCalledWith(
      'catalogue_query_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('uses aggregated sales and review statistics for best sellers', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    groupBy.mockResolvedValueOnce([
      { variantId: 'variant-1', _sum: { quantity: 4 } },
    ]);
    reviewGroupBy.mockResolvedValueOnce([
      { productId: 'product-1', _avg: { rating: 4.5 }, _count: { _all: 2 } },
    ]);
    findMany
      .mockResolvedValueOnce([
        {
          id: 'product-1',
          createdAt: new Date('2026-01-01'),
          variants: [
            {
              id: 'variant-1',
              pricePaise: 100_00,
              stockOnHand: 2,
              stockReserved: 0,
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'product-1',
          name: 'Test product',
          slug: 'test-product',
          description: 'A test product description.',
          category: { name: 'Home', slug: 'home' },
          images: [],
          variants: [
            {
              id: 'variant-1',
              name: 'Standard',
              pricePaise: 100_00,
              compareAtPaise: null,
              stockOnHand: 2,
              stockReserved: 0,
            },
          ],
          reviews: [{ rating: 4 }, { rating: 5 }],
        },
      ]);

    const response = await GET(
      new Request('https://nivara.example/api/catalogue?sort=best'),
    );
    const body = (await response.json()) as {
      data: Array<{ rating: number; reviewCount: number }>;
    };

    expect(response.status).toBe(200);
    expect(body.data[0]).toMatchObject({ rating: 4.5, reviewCount: 2 });
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(reviewGroupBy).toHaveBeenCalledTimes(1);
  });
});
