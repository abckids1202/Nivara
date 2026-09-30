import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { razorpaySignatureMatches } from '../lib/razorpay-webhook.ts';

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
