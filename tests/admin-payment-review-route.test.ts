import { afterEach, describe, expect, it, vi } from 'vitest';

const { findMany, count, getIdentity, isAdministrator, logServerError } = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    count: vi.fn(),
    getIdentity: vi.fn(),
    isAdministrator: vi.fn(),
    logServerError: vi.fn(),
  }),
);

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findMany, count } } }));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/admin/orders/payment-review/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findMany.mockReset();
  count.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

describe('admin payment review route resilience', () => {
  it('returns a paginated payment-review queue', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findMany.mockResolvedValue([{ id: 'order-1', orderNumber: 'NV-1' }]);
    count.mockResolvedValue(25);

    const response = await GET(
      new Request(
        'https://nivara.example/api/admin/orders/payment-review?page=2&pageSize=10',
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
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        paymentStatus: { in: ['PAYMENT_REVIEW', 'PAID_REVIEW'] },
      },
    });
  });

  it('returns a safe response when the review queue cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
    });
    isAdministrator.mockResolvedValue(true);
    findMany.mockRejectedValue(new Error('private payment review details'));

    const response = await GET(
      new Request('https://nivara.example/api/admin/orders/payment-review'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Payment review is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_payment_review_read_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
