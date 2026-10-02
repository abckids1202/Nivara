import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, queryRaw, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  queryRaw: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: queryRaw,
    product: { findMany },
  },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/catalogue/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findMany.mockReset();
  queryRaw.mockReset();
  logServerError.mockReset();
});

describe('catalogue route resilience', () => {
  it('marks successful catalogue responses as non-cacheable', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    queryRaw.mockResolvedValue([]);
    findMany.mockResolvedValue([]);

    const response = await GET(
      new Request('https://nivara.example/api/catalogue'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a safe unavailable response when the database query fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    queryRaw.mockRejectedValue(
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

  it('uses database-ranked candidates for best sellers', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    queryRaw.mockResolvedValue([
      { id: 'product-1', total: 1 },
    ]);
    findMany.mockResolvedValue([
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
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
