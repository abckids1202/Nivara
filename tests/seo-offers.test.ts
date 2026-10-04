import { describe, expect, it } from 'vitest';
import { summarizeSeoOffers } from '@/lib/seo-offers';

describe('SEO offer summaries', () => {
  it('uses only sellable variants when any are available', () => {
    expect(
      summarizeSeoOffers([
        { pricePaise: 8000, stockOnHand: 0, stockReserved: 0 },
        { pricePaise: 12000, stockOnHand: 2, stockReserved: 0 },
        { pricePaise: 15000, stockOnHand: 1, stockReserved: 1 },
      ]),
    ).toEqual({
      lowPrice: 120,
      highPrice: 120,
      offerCount: 1,
      availability: 'https://schema.org/InStock',
    });
  });

  it('falls back to all variants for an out-of-stock product', () => {
    expect(
      summarizeSeoOffers([
        { pricePaise: 8000, stockOnHand: 0, stockReserved: 0 },
        { pricePaise: 12000, stockOnHand: 1, stockReserved: 1 },
      ]),
    ).toEqual({
      lowPrice: 80,
      highPrice: 120,
      offerCount: 2,
      availability: 'https://schema.org/OutOfStock',
    });
  });
});
