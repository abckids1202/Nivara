import { describe, expect, it } from 'vitest';
import { paymentReviewResolutionSchema } from '@/lib/schemas';

describe('payment review resolution validation', () => {
  it('requires a provider reference for manual refunds', () => {
    expect(
      paymentReviewResolutionSchema.safeParse({
        action: 'REFUND',
        reason: 'Captured after stock expired',
      }).success,
    ).toBe(false);
    expect(
      paymentReviewResolutionSchema.safeParse({
        action: 'REFUND',
        reason: 'Captured after stock expired',
        refundReference: 'rfnd_test_123',
      }).success,
    ).toBe(true);
  });

  it('does not require a refund reference for cancellation or fulfilment', () => {
    for (const action of ['CANCEL', 'FULFIL'] as const)
      expect(
        paymentReviewResolutionSchema.safeParse({
          action,
          reason: 'Provider state was resolved manually',
        }).success,
      ).toBe(true);
  });
});
