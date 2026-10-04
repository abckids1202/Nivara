import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirst, aggregate, logServerError } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findFirst }, review: { aggregate } },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/products/[slug]/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findFirst.mockReset();
  aggregate.mockReset();
  logServerError.mockReset();
});

describe('product route resilience', () => {
  it('uses the cheapest sellable variant for the displayed price', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findFirst.mockResolvedValue({
      id: 'product-1',
      variants: [
        {
          id: 'sold-out',
          name: 'Small',
          sku: 'LAMP-S',
          pricePaise: 8000,
          compareAtPaise: null,
          stockOnHand: 0,
          stockReserved: 0,
        },
        {
          id: 'available',
          name: 'Large',
          sku: 'LAMP-L',
          pricePaise: 12000,
          compareAtPaise: null,
          stockOnHand: 2,
          stockReserved: 0,
        },
      ],
      reviews: [],
    });
    aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { _all: 0 } });

    const response = await GET(
      new Request('https://nivara.example/product/lamp'),
      { params: Promise.resolve({ slug: 'lamp' }) },
    );
    const body = (await response.json()) as {
      data: { minPricePaise: number; stockAvailable: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      minPricePaise: 12000,
      stockAvailable: true,
    });
  });

  it('limits displayed reviews while returning the complete rating summary', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findFirst.mockResolvedValue({
      id: 'product-1',
      name: 'Lamp',
      variants: [
        {
          id: 'variant-1',
          name: 'Standard',
          sku: 'LAMP-1',
          pricePaise: 10000,
          compareAtPaise: null,
          stockOnHand: 3,
          stockReserved: 0,
        },
      ],
      reviews: [
        {
          id: 'review-1',
          rating: 5,
          body: 'Lovely lamp',
          displayName: 'Asha',
          createdAt: new Date('2026-01-01'),
          orderItem: {
            order: { paymentStatus: 'PAID', fulfilmentStatus: 'DELIVERED' },
          },
        },
      ],
    });
    aggregate.mockResolvedValue({ _avg: { rating: 4.25 }, _count: { _all: 24 } });

    const response = await GET(
      new Request('https://nivara.example/product/lamp'),
      { params: Promise.resolve({ slug: 'lamp' }) },
    );
    const body = (await response.json()) as {
      data: { rating: number; reviewCount: number; reviews: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ rating: 4.25, reviewCount: 24 });
    expect(body.data.reviews).toHaveLength(1);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          reviews: expect.objectContaining({ take: 3 }),
        }),
      }),
    );
    expect(aggregate).toHaveBeenCalledWith({
      where: { productId: 'product-1', status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
  });

  it('marks a product-not-found response as non-cacheable', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('https://nivara.example/product/x'),
      {
        params: Promise.resolve({ slug: 'x' }),
      },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a safe unavailable response when the database query fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findFirst.mockRejectedValue(new Error('private product database details'));

    const response = await GET(
      new Request('https://nivara.example/product/x'),
      {
        params: Promise.resolve({ slug: 'x' }),
      },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Product is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'product_query_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
