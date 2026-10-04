import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findUnique,
  update,
  deleteCategory,
  auditCreate,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteCategory: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: { findUnique, update, delete: deleteCategory },
    $transaction: transaction,
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { DELETE, PATCH } from '@/app/api/admin/categories/[id]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findUnique.mockReset();
  update.mockReset();
  deleteCategory.mockReset();
  auditCreate.mockReset();
  transaction.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

function configureAdmin() {
  process.env.DATABASE_URL = 'postgresql://database.example/nivara';
  getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
  isAdministrator.mockResolvedValue(true);
}

describe('admin category mutations', () => {
  it('rejects unauthenticated updates before reading the category', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(null);

    const response = await PATCH(
      new Request('https://nivara.example/api/admin/categories/category-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Workspace', slug: 'workspace' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'category-1' }) },
    );

    expect(response.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('updates a category and records the before/after audit atomically', async () => {
    configureAdmin();
    const existing = {
      id: 'category-1',
      name: 'Desk',
      slug: 'desk',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const updated = { ...existing, name: 'Workspace', slug: 'workspace' };
    findUnique.mockResolvedValue(existing);
    update.mockResolvedValue(updated);
    auditCreate.mockResolvedValue({ id: 'audit-1' });
    transaction.mockImplementation(async (callback) =>
      callback({ category: { update }, auditLog: { create: auditCreate } }),
    );

    const response = await PATCH(
      new Request('https://nivara.example/api/admin/categories/category-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Workspace', slug: 'workspace' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: Promise.resolve({ id: 'category-1' }) },
    );
    const body = (await response.json()) as { data: typeof updated };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      ...updated,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'category-1' },
      data: { name: 'Workspace', slug: 'workspace' },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'category.updated',
        entityType: 'Category',
        entityId: 'category-1',
        details: {
          before: existing,
          after: { name: 'Workspace', slug: 'workspace' },
        },
      },
    });
  });

  it('blocks deletion when products still belong to the category', async () => {
    configureAdmin();
    findUnique.mockResolvedValue({
      id: 'category-1',
      name: 'Desk',
      slug: 'desk',
      _count: { products: 2 },
    });

    const response = await DELETE(
      new Request('https://nivara.example/api/admin/categories/category-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'category-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(body.error).toContain('Move or archive');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('deletes an empty category and records the audit atomically', async () => {
    configureAdmin();
    findUnique.mockResolvedValue({
      id: 'category-1',
      name: 'Desk',
      slug: 'desk',
      _count: { products: 0 },
    });
    deleteCategory.mockResolvedValue({ id: 'category-1' });
    auditCreate.mockResolvedValue({ id: 'audit-2' });
    transaction.mockImplementation(async (callback) =>
      callback({
        category: { delete: deleteCategory },
        auditLog: { create: auditCreate },
      }),
    );

    const response = await DELETE(
      new Request('https://nivara.example/api/admin/categories/category-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'category-1' }) },
    );
    const body = (await response.json()) as { data?: { id: string } };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ id: 'category-1' });
    expect(deleteCategory).toHaveBeenCalledWith({ where: { id: 'category-1' } });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'category.deleted',
        entityType: 'Category',
        entityId: 'category-1',
        details: { name: 'Desk', slug: 'desk' },
      },
    });
  });
});
