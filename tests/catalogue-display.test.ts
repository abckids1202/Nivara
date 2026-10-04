import { describe, expect, it } from 'vitest';
import { selectDefaultVariant } from '@/lib/catalogue-display';

const variant = (
  id: string,
  pricePaise: number,
  stockOnHand: number,
  stockReserved = 0,
) => ({ id, pricePaise, stockOnHand, stockReserved });

describe('catalogue display variant selection', () => {
  it('chooses the cheapest sellable variant regardless of database order', () => {
    expect(
      selectDefaultVariant([
        variant('z', 90000, 4),
        variant('sold', 30000, 5, 5),
        variant('a', 70000, 2),
      ]).id,
    ).toBe('a');
  });

  it('uses a stable lowest-price fallback when every variant is sold out', () => {
    expect(
      selectDefaultVariant([
        variant('z', 90000, 0),
        variant('b', 30000, 1, 1),
        variant('a', 30000, 0),
      ]).id,
    ).toBe('a');
  });

  it('returns undefined for a product with no variants', () => {
    expect(selectDefaultVariant([])).toBeUndefined();
  });

  it('prefers a purchasable price when a cheaper variant is sold out', () => {
    expect(
      selectDefaultVariant([
        variant('sold', 30000, 2, 2),
        variant('available', 70000, 1),
      ])?.pricePaise,
    ).toBe(70000);
  });
});
