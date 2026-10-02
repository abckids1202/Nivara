import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  productFindMany,
  productCount,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  productFindMany: vi.fn(),
  productCount: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: productFindMany,
      count: productCount,
    },
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/admin/products/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  productFindMany.mockReset();
  productCount.mockReset();
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
