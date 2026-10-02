import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  readConsistentProviderOrderId,
  razorpaySignatureMatches,
} from '../lib/razorpay-webhook.ts';

const body = JSON.stringify({ id: 'evt_123', event: 'payment.captured' });
const secret = 'webhook-secret';
const signature = createHmac('sha256', secret).update(body).digest('hex');

it('accepts a valid Razorpay webhook signature', () => {
  expect(razorpaySignatureMatches(body, signature, secret)).toBe(true);
  expect(
    razorpaySignatureMatches(body, signature.toUpperCase(), secret),
  ).toBe(true);
});

it('rejects tampered, wrong-secret, and malformed signatures', () => {
  expect(razorpaySignatureMatches(`${body} `, signature, secret)).toBe(false);
  expect(
    razorpaySignatureMatches(body, signature, 'wrong-secret'),
  ).toBe(false);
  expect(
    razorpaySignatureMatches(body, 'not-a-signature', secret),
  ).toBe(false);
});

it('requires payment and order entities to identify the same provider order', () => {
  expect(readConsistentProviderOrderId('order_123', 'order_123')).toBe(
    'order_123',
  );
  expect(readConsistentProviderOrderId('order_123', undefined)).toBe(
    'order_123',
  );
  expect(readConsistentProviderOrderId('order_123', 'order_456')).toBeNull();
});
