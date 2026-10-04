import { afterEach, describe, expect, it, vi } from 'vitest';

const { findUniqueOrder, findUniqueDelivery, createDelivery, updateManyDelivery, providerFetch } = vi.hoisted(() => ({
  findUniqueOrder: vi.fn(),
  findUniqueDelivery: vi.fn(),
  createDelivery: vi.fn(),
  updateManyDelivery: vi.fn(),
  providerFetch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { findUnique: findUniqueOrder },
    emailDelivery: {
      findUnique: findUniqueDelivery,
      create: createDelivery,
      updateMany: updateManyDelivery,
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
  createDelivery.mockReset();
  updateManyDelivery.mockReset();
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
    updateManyDelivery.mockResolvedValue({ count: 0 });
    createDelivery.mockResolvedValue({ status: 'PROCESSING' });
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'email_123' }), { status: 200 }),
    );

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: true });
    const [, requestInit] = providerFetch.mock.calls[0] ?? [];
    expect(requestInit.headers['Idempotency-Key']).toBe(
      'order-confirmation/order-123',
    );
    expect(updateManyDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PROCESSING' }),
      }),
    );
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
    updateManyDelivery.mockResolvedValue({ count: 0 });

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: true, duplicate: true });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('does not send a second email while another worker owns the delivery claim', async () => {
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
    findUniqueDelivery.mockResolvedValue({
      status: 'PROCESSING',
      updatedAt: new Date(),
    });

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({
      sent: false,
      reason: 'email_delivery_in_progress',
    });
    expect(createDelivery).not.toHaveBeenCalled();
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
    updateManyDelivery.mockResolvedValue({ count: 0 });
    createDelivery.mockResolvedValue({ status: 'PROCESSING' });
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 }),
    );

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: false, reason: 'provider_rejected' });
    expect(updateManyDelivery).toHaveBeenLastCalledWith(
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
    updateManyDelivery.mockResolvedValue({ count: 0 });
    createDelivery.mockResolvedValue({ status: 'PROCESSING' });
    providerFetch.mockRejectedValue(new Error('request timed out'));

    const result = await sendOrderConfirmationEmail('order-123');

    expect(result).toEqual({ sent: false, reason: 'provider_timeout' });
    expect(updateManyDelivery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
