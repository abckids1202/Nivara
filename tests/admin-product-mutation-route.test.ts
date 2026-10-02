import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  update,
  createAudit,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
    update: vi.fn(),
    createAudit: vi.fn(),
    transaction: vi.fn(),
    getIdentity: vi.fn(),
    isAdministrator: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: transaction },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { PATCH } from '@/app/api/admin/products/[id]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  update.mockReset();
  createAudit.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

describe('admin product mutation resilience', () => {
  it('returns a safe response when a product update fails', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    transaction.mockImplementation(async (callback) =>
      callback({ product: { update }, auditLog: { create: createAudit } }),
    );
    update.mockRejectedValue(new Error('private product details'));

    const response = await PATCH(
      new Request('https://nivara.example/api/admin/products/product-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Nivara product' }),
      }),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Product could not be updated');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'product_update_failed',
      expect.any(Error),
    );
  });
});
