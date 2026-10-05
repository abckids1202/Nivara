import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  findAttempt,
  createEvent,
  findEvent,
  markPaymentPaid,
  markPaymentFailed,
  markPaymentReview,
  sendOrderConfirmationEmail,
} = vi.hoisted(() => ({
  findAttempt: vi.fn(),
  createEvent: vi.fn(),
  findEvent: vi.fn(),
  markPaymentPaid: vi.fn(),
  markPaymentFailed: vi.fn(),
  markPaymentReview: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentAttempt: { findFirst: findAttempt },
    paymentEvent: { create: createEvent, findUnique: findEvent },
  },
}));
vi.mock('@/lib/payment-state', () => ({
  markPaymentPaid,
  markPaymentFailed,
  markPaymentReview,
}));
vi.mock('@/lib/email', () => ({ sendOrderConfirmationEmail }));
vi.mock('@/lib/safe-logging', () => ({
  logServerError: vi.fn(),
  safeErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'unknown error',
}));

import { POST } from '@/app/api/payments/razorpay/webhook/route';

const originalEnvironment = { ...process.env };
const secret = 'webhook-secret';

function signedRequest(body: string) {
  return new Request('https://nivara.example/api/payments/razorpay/webhook', {
    method: 'POST',
    headers: {
      'x-razorpay-signature': createHmac('sha256', secret)
        .update(body)
        .digest('hex'),
    },
    body,
  });
}

function duplicateError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate event', {
    code: 'P2002',
    clientVersion: '6.7.0',
  });
}

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  findAttempt.mockReset();
  createEvent.mockReset();
  findEvent.mockReset();
  markPaymentPaid.mockReset();
  markPaymentFailed.mockReset();
  markPaymentReview.mockReset();
  sendOrderConfirmationEmail.mockReset();
});

describe('Razorpay webhook processing', () => {
  it('records a captured event and completes the matching payment', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'evt_captured_1',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_1', order_id: 'order_1' } },
      },
    });
    findAttempt.mockResolvedValue({ id: 'payment-1' });
    createEvent.mockResolvedValue({ id: 'event-1' });
    markPaymentPaid.mockResolvedValue({ status: 'paid', orderId: 'order-1' });
    sendOrderConfirmationEmail.mockResolvedValue({ sent: true });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(200);
    expect(markPaymentPaid).toHaveBeenCalledWith({
      paymentAttemptId: 'payment-1',
      providerPaymentId: 'pay_1',
    });
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-1');
  });

  it('accepts an idempotent replay only when its payload hash matches', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'evt_replayed_1',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_2', order_id: 'order_2' } },
      },
    });
    const payloadHash = createHmac('sha256', secret).update(body).digest('hex');
    findAttempt.mockResolvedValue({ id: 'payment-2' });
    createEvent.mockRejectedValue(duplicateError());
    findEvent.mockResolvedValue({ payloadHash });
    markPaymentPaid.mockResolvedValue({
      status: 'already_paid',
      orderId: 'order-2',
    });
    sendOrderConfirmationEmail.mockResolvedValue({ sent: true });

    const response = await POST(signedRequest(body));
    const payload = (await response.json()) as {
      duplicate?: boolean;
      received?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ received: true, duplicate: true });
    expect(markPaymentPaid).toHaveBeenCalledOnce();
  });

  it('moves a captured event without a provider payment ID into review', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'evt_captured_missing_payment_id',
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_4' } } },
    });
    findAttempt.mockResolvedValue({ id: 'payment-4' });
    createEvent.mockResolvedValue({ id: 'event-4' });

    const response = await POST(signedRequest(body));
    const payload = (await response.json()) as {
      paymentReview?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.paymentReview).toBe(true);
    expect(markPaymentReview).toHaveBeenCalledWith('payment-4');
    expect(markPaymentPaid).not.toHaveBeenCalled();
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('rejects reuse of an event ID with a different payload', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      id: 'evt_replayed_2',
      event: 'payment.failed',
      payload: {
        payment: { entity: { id: 'pay_3', order_id: 'order_3' } },
      },
    });
    findAttempt.mockResolvedValue({ id: 'payment-3' });
    createEvent.mockRejectedValue(duplicateError());
    findEvent.mockResolvedValue({ payloadHash: 'different-hash' });

    const response = await POST(signedRequest(body));

    expect(response.status).toBe(400);
    expect(markPaymentFailed).not.toHaveBeenCalled();
  });
});
