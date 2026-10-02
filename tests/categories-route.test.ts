import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { category: { findMany } },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/categories/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  findMany.mockReset();
  logServerError.mockReset();
});

describe('categories route resilience', () => {
  it('returns a safe unavailable response when the database query fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    findMany.mockRejectedValue(new Error('private database details'));

    const response = await GET();
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Categories are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'categories_query_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
