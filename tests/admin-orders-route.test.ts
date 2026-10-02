import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findMany,
  count,
  transaction,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
    findMany: vi.fn(),
    count: vi.fn(),
    transaction: vi.fn(),
    getIdentity: vi.fn(),
    isAdministrator: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: { order: { findMany, count }, $transaction: transaction },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET, PATCH } from '@/app/api/admin/orders/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  count.mockReset();
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

describe('admin orders route resilience', () => {
  it('returns paginated orders and applies the search query', async () => {
    configureAdmin();
    findMany.mockResolvedValue([{ id: 'order-1', orderNumber: 'NV-1' }]);
    count.mockResolvedValue(25);

    const response = await GET(
      new Request(
        'https://nivara.example/api/admin/orders?q=shopper&page=2&pageSize=10',
      ),
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
      total: 25,
      totalPages: 3,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ OR: expect.any(Array) }),
    });
  });

  it('returns a safe response when the order queue cannot be loaded', async () => {
    configureAdmin();
    findMany.mockRejectedValue(new Error('private order details'));

    const response = await GET(
      new Request('https://nivara.example/api/admin/orders'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Orders are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_orders_read_failed',
      expect.any(Error),
    );
  });

  it('returns a safe response when a fulfilment transaction fails', async () => {
    configureAdmin();
    transaction.mockRejectedValue(new Error('private transaction details'));

    const response = await PATCH(
      new Request('https://nivara.example/api/admin/orders', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'order-1',
          status: 'SHIPPED',
          courierName: 'Nivara Express',
          trackingReference: 'TRACK-1',
        }),
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Order update is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_order_fulfilment_update_failed',
      expect.any(Error),
    );
  });
});
