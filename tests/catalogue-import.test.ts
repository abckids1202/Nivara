import { expect, it } from 'vitest';
import { parseCatalogueCsv } from '../lib/catalogue-import.ts';

const header =
  'categorySlug,categoryName,productName,productSlug,description,material,dimensions,care,status,variantName,sku,priceRupees,compareAtRupees,stockOnHand,imageUrl,imageAlt';

it('parses valid catalogue rows and quoted commas', () => {
  const result = parseCatalogueCsv(
    `${header}\norganise,Organise,"Desk, organiser",desk-organiser,"A useful piece, thoughtfully made",Oak,"24 x 12 cm",Wipe clean,PUBLISHED,Natural,NIV-001,1499,,8,,Desk organiser`,
  );
  expect(result.errors).toEqual([]);
  expect(result.rows[0]?.productName).toBe('Desk, organiser');
  expect(result.rows[0]?.priceRupees).toBe(1499);
});

it('reports invalid catalogue rows without importing them', () => {
  const result = parseCatalogueCsv(
    `${header}\norganise,Organise,Bad product,INVALID SLUG,short,,,,PUBLISHED,Natural,NIV-002,0,,0,,`,
  );
  expect(result.rows).toHaveLength(0);
  expect(result.errors.length).toBeGreaterThan(0);
});
