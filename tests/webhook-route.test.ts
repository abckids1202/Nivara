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
});
