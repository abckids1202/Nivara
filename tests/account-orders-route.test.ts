import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, count, getIdentity, logServerError } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  getIdentity: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany, count } } }));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/account/orders/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  count.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('account orders route resilience', () => {
  it('returns paginated order history for the authenticated customer', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({ id: 'user-1', email: 'shopper@example.com' });
    findMany.mockResolvedValue([{ id: 'order-1', orderNumber: 'NV-1' }]);
    count.mockResolvedValue(21);

    const response = await GET(
      new Request('https://nivara.example/api/account/orders?page=2&pageSize=10'),
    );
    const body = (await response.json()) as {
      data: Array<{ id: string }>;
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual([{ id: 'order-1', orderNumber: 'NV-1' }]);
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        select: expect.objectContaining({
          id: true,
          orderNumber: true,
          items: {
            select: expect.objectContaining({
              id: true,
              productName: true,
              variant: { select: { productId: true } },
            }),
          },
          shipment: { select: { courierName: true, trackingReference: true } },
        }),
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('returns a safe response when order history cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    findMany.mockRejectedValue(new Error('private order details'));

    const response = await GET(
      new Request('https://nivara.example/api/account/orders'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Orders are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'account_orders_read_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
