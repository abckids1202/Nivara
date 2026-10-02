import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, getIdentity, isAdministrator, logServerError } = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    getIdentity: vi.fn(),
    isAdministrator: vi.fn(),
    logServerError: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({ prisma: { category: { findMany } } }));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/admin/categories/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

describe('admin category route resilience', () => {
  it('returns a safe response when categories cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findMany.mockRejectedValue(new Error('private category details'));

    const response = await GET(
      new Request('https://nivara.example/api/admin/categories'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Categories are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_categories_read_failed',
      expect.any(Error),
    );
  });
});
