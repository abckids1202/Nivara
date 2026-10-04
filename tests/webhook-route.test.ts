import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/payments/razorpay/webhook/route';

const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
  else process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
});

describe('Razorpay webhook route boundary', () => {
  it('rejects a webhook when the secret is not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        body: '{}',
      }),
    );

    expect(response.status).toBe(503);
  });

  it('rejects an invalid signature before parsing provider data', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'invalid' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(401);
  });

  it('rejects signed non-JSON bodies before database access', async () => {
    const secret = 'webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = 'not-json';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body,
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects oversized webhook bodies before signature processing', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-secret';
    const body = 'x'.repeat(1_000_001);
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        body,
      }),
    );

    expect(response.status).toBe(413);
  });

  it('rejects a signed payload without a provider event ID', async () => {
    const secret = 'webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ event: 'payment.captured' });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body,
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects a non-string provider event ID', async () => {
    const secret = 'webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ id: 123, event: 'payment.captured' });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body,
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects an oversized provider event ID', async () => {
    const secret = 'webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'e'.repeat(257),
      event: 'payment.captured',
    });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body,
      }),
    );

    expect(response.status).toBe(400);
  });

  it('rejects signed payloads with contradictory provider order IDs', async () => {
    const secret = 'webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'evt_mismatch',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
        order: { entity: { id: 'order_456' } },
      },
    });
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const response = await POST(
      new Request('https://nivara.example/api/payments/razorpay/webhook', {
        method: 'POST',
        headers: { 'x-razorpay-signature': signature },
        body,
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
