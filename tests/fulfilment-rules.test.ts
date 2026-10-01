import { describe, expect, it } from 'vitest';
import { evaluateFulfilmentTransition } from '../lib/fulfilment-rules.ts';

describe('fulfilment transitions', () => {
  it('allows the next forward stage', () => {
    expect(evaluateFulfilmentTransition('PROCESSING', 'SHIPPED')).toEqual({
      allowed: true,
      kind: 'updated',
    });
  });

  it('rejects skipping a stage', () => {
    expect(evaluateFulfilmentTransition('PROCESSING', 'DELIVERED')).toEqual({
      allowed: false,
      kind: 'skipped',
    });
  });

  it('rejects backward movement', () => {
    expect(evaluateFulfilmentTransition('DELIVERED', 'SHIPPED')).toEqual({
      allowed: false,
      kind: 'backward',
    });
  });

  it('allows shipment corrections without changing status', () => {
    expect(evaluateFulfilmentTransition('SHIPPED', 'SHIPPED')).toEqual({
      allowed: true,
      kind: 'correction',
    });
  });
});
