import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  orderFindMany,
  orderAggregate,
  orderCount,
  adjustmentFindMany,
  queryRaw,
  reviewFindMany,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  adjustmentFindMany: vi.fn(),
  queryRaw: vi.fn(),
  reviewFindMany: vi.fn(),
  getIdentity: vi.fn(),
  isAdministrator: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: orderFindMany,
      aggregate: orderAggregate,
      count: orderCount,
    },
    inventoryAdjustment: { findMany: adjustmentFindMany },
    $queryRaw: queryRaw,
    review: { findMany: reviewFindMany },
  },
}));
vi.mock('@/lib/server-auth', () => ({
  getAuthenticatedIdentity: getIdentity,
  isAdministrator,
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET as getReports } from '@/app/api/admin/reports/route';
import { GET as getReviews } from '@/app/api/admin/reviews/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  orderFindMany.mockReset();
  orderAggregate.mockReset();
  orderCount.mockReset();
  adjustmentFindMany.mockReset();
  queryRaw.mockReset();
  reviewFindMany.mockReset();
  getIdentity.mockReset();
  isAdministrator.mockReset();
  logServerError.mockReset();
});

function configureAdmin() {
  process.env.DATABASE_URL = 'postgresql://database.example/nivara';
  getIdentity.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
  isAdministrator.mockResolvedValue(true);
}

describe('admin reports and moderation resilience', () => {
  it('returns a safe response when reporting data cannot be loaded', async () => {
    configureAdmin();
    orderAggregate.mockRejectedValue(new Error('private report details'));

    const response = await getReports(
      new Request('https://nivara.example/api/admin/reports'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Reports are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_reports_read_failed',
      expect.any(Error),
    );
  });

  it('reports lowest available stock using reserved quantities', async () => {
    configureAdmin();
    orderAggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { totalPaise: 1000 },
    });
    orderCount.mockResolvedValue(0);
    adjustmentFindMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([
      {
        id: 'variant-1',
        name: 'Large',
        sku: 'SKU-1',
        stockOnHand: 10,
        stockReserved: 9,
        productName: 'Product',
        productSlug: 'product',
      },
    ]);

    const response = await getReports(
      new Request('https://nivara.example/api/admin/reports'),
    );
    const body = (await response.json()) as {
      data: {
        lowStock: Array<{
          stockOnHand: number;
          stockReserved: number;
          product: { name: string; slug: string };
        }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.lowStock[0]).toMatchObject({
      stockOnHand: 10,
      stockReserved: 9,
      product: { name: 'Product', slug: 'product' },
    });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('returns a safe response when moderation data cannot be loaded', async () => {
    configureAdmin();
    reviewFindMany.mockRejectedValue(new Error('private review details'));

    const response = await getReviews(
      new Request('https://nivara.example/api/admin/reviews'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Reviews are temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'admin_reviews_read_failed',
      expect.any(Error),
    );
  });
});
