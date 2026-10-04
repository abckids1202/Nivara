import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  productFindMany,
  productCount,
  productCreate,
  auditCreate,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  productCount: vi.fn(),
  productCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: productFindMany,
      count: productCount,
      create: productCreate,
    },
    auditLog: {
      create: auditCreate,
    },
    $transaction: transaction,
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET, POST } from '@/app/api/admin/products/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  productFindMany.mockReset();
  productCount.mockReset();
  productCreate.mockReset();
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

describe('admin product list pagination', () => {
  it('rejects invalid pagination input', async () => {
    configureAdmin();

    const response = await GET(
      new Request('https://nivara.example/api/admin/products?page=0'),
    );

    expect(response.status).toBe(400);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it('passes server-side search and pagination to the database', async () => {
    configureAdmin();
    productFindMany.mockResolvedValue([{ id: 'product-1', name: 'Lamp' }]);
    productCount.mockResolvedValue(49);

    const response = await GET(
      new Request(
        'https://nivara.example/api/admin/products?q=lamp&page=2&pageSize=10',
      ),
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'product-1', name: 'Lamp' }]);
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 49,
      totalPages: 5,
    });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        where: {
          OR: [
            { name: { contains: 'lamp', mode: 'insensitive' } },
            { slug: { contains: 'lamp', mode: 'insensitive' } },
            {
              category: {
                name: { contains: 'lamp', mode: 'insensitive' },
              },
            },
          ],
        },
      }),
    );
    expect(productCount).toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    });
  });
});

describe('admin product creation', () => {
  const validPayload = {
    name: 'Linen catchall tray',
    slug: 'linen-catchall-tray',
    description: 'A considered tray for everyday objects and small rituals.',
    material: 'Linen composite',
    dimensions: '30 × 20 cm',
    care: 'Wipe clean with a soft cloth.',
    categoryId: 'category-1',
    status: 'DRAFT',
  };

  it('requires an administrator before creating a product', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue(null);

    const response = await POST(
      new Request('https://nivara.example/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(response.status).toBe(401);
    expect(productCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid product details before opening a transaction', async () => {
    configureAdmin();

    const response = await POST(
      new Request('https://nivara.example/api/admin/products', {
        method: 'POST',
        body: JSON.stringify({ ...validPayload, slug: 'Not valid' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    expect(response.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates the product and records an audit event atomically', async () => {
    configureAdmin();
    const createdProduct = { id: 'product-2', ...validPayload };
    productCreate.mockResolvedValue(createdProduct);
    auditCreate.mockResolvedValue({ id: 'audit-1' });
    transaction.mockImplementation(async (callback) =>
      callback({ product: { create: productCreate }, auditLog: { create: auditCreate } }),
    );

    const response = await POST(
      new Request('https://nivara.example/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const body = (await response.json()) as { data: typeof createdProduct };

    expect(response.status).toBe(201);
    expect(body.data).toEqual(createdProduct);
    expect(productCreate).toHaveBeenCalledWith({ data: validPayload });
    expect(auditCreate).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'product.created',
        entityType: 'Product',
        entityId: 'product-2',
      },
    });
  });
});
