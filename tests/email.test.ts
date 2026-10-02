import { afterEach, describe, expect, it, vi } from 'vitest';

const { findUniqueOrder, findUniqueDelivery, upsertDelivery, updateDelivery, providerFetch } = vi.hoisted(() => ({
  findUniqueOrder: vi.fn(),
  findUniqueDelivery: vi.fn(),
  upsertDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: findUniqueOrder },
    emailDelivery: {
      findUnique: findUniqueDelivery,
      upsert: upsertDelivery,
      update: updateDelivery,
    },
  },
}));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));

import { sendOrderConfirmationEmail } from '@/lib/email';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findUniqueOrder.mockReset();
  findUniqueDelivery.mockReset();
  upsertDelivery.mockReset();
  updateDelivery.mockReset();
  providerFetch.mockReset();
});

describe('order confirmation email delivery', () => {
  it('uses an order-specific Resend idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.in>';
    findUniqueOrder.mockResolvedValue({
      orderNumber: 'NV-123',
      guestEmail: 'customer@nivara.in',
      user: null,
      items: [],
      shippingFullName: 'Test Shopper',
      totalPaise: 12_500,
    });
    findUniqueDelivery.mockResolvedValue(null);
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }),
    );

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: true });
    const [, requestInit] = providerFetch.mock.calls[0] ?? [];
    expect(requestInit.headers['Idempotency-Key']).toBe(
      'order-confirmation/order-123',
    );
    expect(updateDelivery).toHaveBeenCalled();
  });

  it('does not call Resend when the delivery is already recorded as sent', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.in>';
    findUniqueOrder.mockResolvedValue({
      orderNumber: 'NV-123',
      guestEmail: 'customer@nivara.in',
      user: null,
      items: [],
      shippingFullName: 'Test Shopper',
      totalPaise: 12_500,
    });
    findUniqueDelivery.mockResolvedValue({ status: 'SENT' });

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: true, duplicate: true });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('marks a provider rejection as failed for a later retry', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.in>';
    findUniqueOrder.mockResolvedValue({
      orderNumber: 'NV-123',
      guestEmail: 'customer@nivara.in',
      user: null,
      items: [],
      shippingFullName: 'Test Shopper',
      totalPaise: 12_500,
    });
    findUniqueDelivery.mockResolvedValue(null);
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }),
    );

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: false, reason: 'provider_rejected' });
    expect(updateDelivery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('marks a provider timeout as failed for a later retry', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.in>';
    findUniqueOrder.mockResolvedValue({
      orderNumber: 'NV-123',
      guestEmail: 'customer@nivara.in',
      user: null,
      items: [],
      shippingFullName: 'Test Shopper',
      totalPaise: 12_500,
    });
    findUniqueDelivery.mockResolvedValue(null);
    providerFetch.mockRejectedValue(new Error('request timed out'));

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: false, reason: 'provider_timeout' });
    expect(updateDelivery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
