import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  orderFindMany,
  orderAggregate,
  orderCount,
  adjustmentFindMany,
  variantFindMany,
  reviewFindMany,
  getIdentity,
  isAdministrator,
  logServerError,
} = vi.hoisted(() => ({
  orderFindMany: vi.fn(),
  orderAggregate: vi.fn(),
  orderCount: vi.fn(),
  adjustmentFindMany: vi.fn(),
  variantFindMany: vi.fn(),
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
    productVariant: { findMany: variantFindMany },
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
  variantFindMany.mockReset();
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
