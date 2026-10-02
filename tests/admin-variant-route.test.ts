import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findFirst,
  update,
  createAudit,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  createAudit: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productVariant: { findFirst, update },
    auditLog: { create: createAudit },
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { PATCH } from '@/app/api/admin/products/[id]/variants/[variantId]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findFirst.mockReset();
  update.mockReset();
  createAudit.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

describe('admin variant route resilience', () => {
  it('returns a safe response when the variant cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('private variant details'));

    const response = await PATCH(
      new Request(
        'https://nivara.example/api/admin/products/product-1/variants/variant-1',
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Natural' }),
        },
      ),
      { params: Promise.resolve({ id: 'product-1', variantId: 'variant-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Variant update is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_variant_update_failed',
      expect.any(Error),
    );
  });
});
