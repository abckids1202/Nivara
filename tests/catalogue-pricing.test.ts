import { describe, expect, it } from 'vitest';
import { isValidComparisonPrice } from '@/lib/catalogue-pricing';

describe('catalogue pricing', () => {
  it('allows no comparison price or a higher comparison price', () => {
    expect(isValidComparisonPrice(1_499_00, null)).toBe(true);
    expect(isValidComparisonPrice(1_499_00, 1_999_00)).toBe(true);
    expect(isValidComparisonPrice(1_499_00, 1_499_00)).toBe(true);
  });

  it('rejects a comparison price below the selling price', () => {
    expect(isValidComparisonPrice(1_499_00, 999_00)).toBe(false);
  });
});
