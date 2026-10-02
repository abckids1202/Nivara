import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, groupBy, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  groupBy: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { product: { findMany }, orderItem: { groupBy } },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/catalogue/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findMany.mockReset();
  groupBy.mockReset();
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
});
