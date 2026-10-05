import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, findFirst, createAttempt, logServerError } =
  vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    findFirst: vi.fn(),
    createAttempt: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findFirst },
    guestOrderAccessAttempt: { create: createAttempt },
  },
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/guest-orders/[token]/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  consumeRateLimit.mockReset();
  findFirst.mockReset();
  createAttempt.mockReset();
  logServerError.mockReset();
});

describe('guest order route resilience', () => {
  it('returns a safe response when guest order access cannot be loaded', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    consumeRateLimit.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('private guest order details'));

    const response = await GET(
      new Request('https://nivara.example/api/guest-orders/secret-token'),
      { params: Promise.resolve({ token: 'secret-token' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Guest order access is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'guest_order_access_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(consumeRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringMatching(/^guest-order-access:[a-f0-9]{16}$/),
      }),
    );
    expect(JSON.stringify(consumeRateLimit.mock.calls)).not.toContain(
      'secret-token',
    );
  });

  it('projects guest order data without internal identifiers', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    consumeRateLimit.mockResolvedValue(true);
    findFirst.mockResolvedValue({
      id: 'internal-order-id',
      orderNumber: 'NV-1001',
      paymentStatus: 'PAID',
      fulfilmentStatus: 'PROCESSING',
      totalPaise: 79900,
      guestAccessExpiry: new Date(Date.now() + 60_000),
      items: [
        {
          id: 'item-1',
          productName: 'Arc organizer',
          variantName: 'Clay',
          unitPricePaise: 79900,
          quantity: 1,
        },
      ],
      shipment: { courierName: null, trackingReference: null },
    });

    const response = await GET(
      new Request('https://nivara.example/api/guest-orders/secret-token'),
      { params: Promise.resolve({ token: 'secret-token' }) },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ orderNumber: 'NV-1001', totalPaise: 79900 });
    expect(body).not.toHaveProperty('id');
    expect(body.items).toEqual([
      {
        id: 'item-1',
        productName: 'Arc organizer',
        variantName: 'Clay',
        unitPricePaise: 79900,
        quantity: 1,
      },
    ]);
    expect(findFirst).toHaveBeenCalledWith({
      where: { guestAccessHash: expect.any(String) },
      select: {
        orderNumber: true,
        paymentStatus: true,
        fulfilmentStatus: true,
        totalPaise: true,
        id: true,
        guestAccessExpiry: true,
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            unitPricePaise: true,
            quantity: true,
          },
        },
        shipment: {
          select: { courierName: true, trackingReference: true },
        },
      },
    });
  });

  it('applies a client-wide limit when token values are rotated', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    consumeRateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const response = await GET(
      new Request('https://nivara.example/api/guest-orders/random-token'),
      { params: Promise.resolve({ token: 'random-token' }) },
    );

    expect(response.status).toBe(429);
    expect(findFirst).not.toHaveBeenCalled();
    expect(consumeRateLimit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        endpoint: 'guest-order-access:client',
        maxAttempts: 30,
      }),
    );
  });
});
