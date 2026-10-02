import { describe, expect, it } from 'vitest';
import { mergedCartQuantity } from '@/lib/cart-merge';

describe('guest cart merging', () => {
  it('caps the combined quantity at the available stock and cart limit', () => {
    expect(mergedCartQuantity(4, 5, 6)).toBe(6);
    expect(mergedCartQuantity(18, 5, 50)).toBe(20);
  });

  it('does not produce a quantity for unavailable stock', () => {
    expect(mergedCartQuantity(2, 3, 0)).toBe(0);
  });

  it('fails closed for invalid quantities', () => {
    expect(mergedCartQuantity(-2, -1, 5)).toBe(0);
    expect(mergedCartQuantity(2, 3, -1)).toBe(0);
  });
});
