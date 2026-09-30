import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { razorpaySignatureMatches } from '../lib/razorpay-webhook.ts';

const body = JSON.stringify({ id: 'evt_123', event: 'payment.captured' });
const secret = 'webhook-secret';
const signature = createHmac('sha256', secret).update(body).digest('hex');

void test('accepts a valid Razorpay webhook signature', () => {
  assert.equal(razorpaySignatureMatches(body, signature, secret), true);
  assert.equal(
    razorpaySignatureMatches(body, signature.toUpperCase(), secret),
    true,
  );
});

void test('rejects tampered, wrong-secret, and malformed signatures', () => {
  assert.equal(razorpaySignatureMatches(`${body} `, signature, secret), false);
  assert.equal(
    razorpaySignatureMatches(body, signature, 'wrong-secret'),
    false,
  );
  assert.equal(
    razorpaySignatureMatches(body, 'not-a-signature', secret),
    false,
  );
});
