import { afterEach, describe, expect, it, vi } from 'vitest';

const { updateProduct, createAudit, transaction, getIdentity, isAdministrator } = vi.hoisted(() => ({
  updateProduct: vi.fn(),
  createAudit: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
  },
}));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity, isAdministrator }));

import { DELETE } from '@/app/api/admin/products/[id]/route';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  updateProduct.mockReset();
  createAudit.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
});

describe('admin product deletion route', () => {
  it('archives products instead of deleting historical catalogue records', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@nivara.in' });
    isAdministrator.mockResolvedValue(true);
    updateProduct.mockResolvedValue({ id: 'product-1', status: 'ARCHIVED' });
    transaction.mockImplementation(async (callback) =>
      callback({ product: { update: updateProduct }, auditLog: { create: createAudit } }),
    );

    const response = await DELETE(
      new Request('https://nivara.example/api/admin/products/product-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'product-1' }) },
    );

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { status: 'ARCHIVED' },
    });
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'product.archived' }),
      }),
    );
  });
});
