import { afterEach, describe, expect, it, vi } from 'vitest';

const { findFirst, getIdentity, logServerError } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getIdentity: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { order: { findFirst } } }));
vi.mock('@/lib/server-auth', () => ({ getAuthenticatedIdentity: getIdentity }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/orders/[orderNumber]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findFirst.mockReset();
  getIdentity.mockReset();
  logServerError.mockReset();
});

describe('order detail route resilience', () => {
  it('returns a safe response when an order cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    findFirst.mockRejectedValue(new Error('private order details'));

    const response = await GET(
      new Request('https://nivara.example/api/orders/NIV-1001'),
      { params: Promise.resolve({ orderNumber: 'NIV-1001' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Order is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'order_detail_read_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(findFirst).toHaveBeenCalledWith({
      where: { orderNumber: 'NIV-1001', userId: 'user-1' },
      select: expect.objectContaining({
        orderNumber: true,
        totalPaise: true,
        items: {
          select: expect.objectContaining({
            id: true,
            productName: true,
            sku: true,
          }),
        },
        shipment: {
          select: { courierName: true, trackingReference: true },
        },
      }),
    });
  });
});
