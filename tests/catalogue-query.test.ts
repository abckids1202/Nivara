import { describe, expect, it } from 'vitest';
import { catalogueQuerySchema } from '@/lib/schemas';

describe('catalogue query validation', () => {
  it('applies safe defaults for an empty query', () => {
    expect(catalogueQuerySchema.parse({})).toEqual({
      availability: 'all',
      sort: 'newest',
      page: 1,
      pageSize: 12,
    });
  });

  it('accepts the URL filter values used by the storefront', () => {
    expect(
      catalogueQuerySchema.parse({
        q: ' linen ',
        category: 'home-decor',
        availability: 'available',
        sort: 'price-low',
        page: '2',
        pageSize: '48',
        minPricePaise: '50000',
        maxPricePaise: '250000',
      }),
    ).toEqual({
      q: 'linen',
      category: 'home-decor',
      availability: 'available',
      sort: 'price-low',
      page: 2,
      pageSize: 48,
      minPricePaise: 50000,
      maxPricePaise: 250000,
    });
  });

  it('rejects unbounded or malformed filters', () => {
    expect(catalogueQuerySchema.safeParse({ q: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(
      catalogueQuerySchema.safeParse({ category: 'Home Decor' }).success,
    ).toBe(false);
    expect(catalogueQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(catalogueQuerySchema.safeParse({ pageSize: '49' }).success).toBe(
      false,
    );
    expect(
      catalogueQuerySchema.safeParse({ maxPricePaise: '-1' }).success,
    ).toBe(false);
    expect(
      catalogueQuerySchema.safeParse({
        minPricePaise: 300000,
        maxPricePaise: 250000,
      }).success,
    ).toBe(false);
  });
});
