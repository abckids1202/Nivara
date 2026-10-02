import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirst, logServerError } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findFirst } },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/products/[slug]/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findFirst.mockReset();
  logServerError.mockReset();
});

describe('product route resilience', () => {
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
