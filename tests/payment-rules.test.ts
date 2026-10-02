import { describe, expect, it } from 'vitest';
import {
  canMarkPaymentReview,
  decidePaymentCapture,
} from '@/lib/payment-rules';

describe('payment review transitions', () => {
  it.each([
    ['FAILED', 'FAILED'],
    ['CANCELLED', 'PENDING'],
    ['PAID_REVIEW', 'PAID_REVIEW'],
    ['PENDING', 'PAID'],
  ] as const)('does not reopen terminal state %s/%s', (
    paymentStatus,
    orderStatus,
  ) => {
    expect(canMarkPaymentReview({ paymentStatus, orderStatus })).toBe(false);
  });

  it('allows uncertain non-terminal payments to enter review', () => {
    expect(
      canMarkPaymentReview({ paymentStatus: 'PENDING', orderStatus: 'PENDING' }),
    ).toBe(true);
  });
});

describe('payment capture decisions', () => {
  it('is idempotent for an already paid payment and order', () => {
    expect(
      decidePaymentCapture({ paymentStatus: 'PAID', orderStatus: 'PAID' }),
    ).toBe('already_paid');
  });

  it.each([
    ['FAILED', 'FAILED'],
    ['CANCELLED', 'CANCELLED'],
    ['FAILED', 'PENDING'],
    ['PENDING', 'CANCELLED'],
  ] as const)('routes %s/%s late captures to manual review', (
    paymentStatus,
    orderStatus,
  ) => {
    expect(decidePaymentCapture({ paymentStatus, orderStatus })).toBe(
      'paid_review',
    );
  });

  it('allows pending payment capture to continue to reservation checks', () => {
    expect(
      decidePaymentCapture({
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
      }),
    ).toBe('capture');
  });
});
