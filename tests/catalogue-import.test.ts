import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { parseCatalogueCsv } from '../lib/catalogue-import.ts';
import { sortCatalogueProducts } from '../lib/catalogue-sort.ts';

const header =
  'categorySlug,categoryName,productName,productSlug,description,material,dimensions,care,status,variantName,sku,priceRupees,compareAtRupees,stockOnHand,imageUrl,imageAlt';

it('keeps the handoff template valid against the importer', () => {
  const template = readFileSync(
    fileURLToPath(new URL('../docs/catalogue-import-template.csv', import.meta.url)),
    'utf8',
  );
  const result = parseCatalogueCsv(template);
  expect(result.errors).toEqual([]);
  expect(result.rows).toHaveLength(1);
});

it('parses valid catalogue rows and quoted commas', () => {
  const result = parseCatalogueCsv(
    `${header}\norganise,Organise,"Desk, organiser",desk-organiser,"A useful piece, thoughtfully made",Oak,"24 x 12 cm",Wipe clean,PUBLISHED,Natural,NIV-001,1499,,8,,Desk organiser`,
  );
  expect(result.errors).toEqual([]);
  expect(result.rows[0]?.productName).toBe('Desk, organiser');
  expect(result.rows[0]?.priceRupees).toBe(1499);
});

it('accepts paise in rupee prices while rejecting more than two decimals', () => {
  const valid = parseCatalogueCsv(
    `${header}\norganise,Organise,Desk organiser,desk-organiser,A useful piece thoughtfully made,Oak,24 x 12 cm,Wipe clean,PUBLISHED,Natural,NIV-001,649.50,799.99,8,,Desk organiser`,
  );
  expect(valid.errors).toEqual([]);
  expect(valid.rows[0]?.priceRupees).toBe(649.5);
  expect(valid.rows[0]?.compareAtRupees).toBe(799.99);

  const invalid = parseCatalogueCsv(
    `${header}\norganise,Organise,Desk organiser,desk-organiser,A useful piece thoughtfully made,Oak,24 x 12 cm,Wipe clean,PUBLISHED,Natural,NIV-002,649.999,,8,,Desk organiser`,
  );
  expect(invalid.rows).toHaveLength(0);
  expect(invalid.errors).toContain('Row 2: priceRupees');
});

it('reports invalid catalogue rows without importing them', () => {
  const result = parseCatalogueCsv(
    `${header}\norganise,Organise,Bad product,INVALID SLUG,short,,,,PUBLISHED,Natural,NIV-002,0,,0,,`,
  );
  expect(result.rows).toHaveLength(0);
  expect(result.errors.length).toBeGreaterThan(0);
});

it('reports duplicate SKUs before import', () => {
  const row =
    'organise,Organise,Desk organiser,desk-organiser,A useful piece thoughtfully made,Oak,24 x 12 cm,Wipe clean,PUBLISHED,Natural,NIV-001,1499,,8,,Desk organiser';
  const result = parseCatalogueCsv(`${header}\n${row}\n${row}`);
  expect(result.rows).toHaveLength(1);
  expect(result.errors).toContain('Row 3: duplicate SKU NIV-001');
});

it('rejects imports larger than the transaction row limit', () => {
  const rows = Array.from({ length: 2_001 }, (_, index) =>
    `organise,Organise,Desk organiser,desk-organiser-${index},A useful piece thoughtfully made,Oak,24 x 12 cm,Wipe clean,DRAFT,Natural,NIV-${index},1499,,8,,Desk organiser`,
  ).join('\n');
  const result = parseCatalogueCsv(`${header}\n${rows}`);
  expect(result.rows).toHaveLength(0);
  expect(result.errors).toContain('CSV cannot contain more than 2,000 product rows');
});

it('sorts catalogue products by paid sales and price before pagination', () => {
  const products = [
    {
      id: 'newer',
      createdAt: new Date('2026-01-02'),
      variants: [{ pricePaise: 900 }],
      reviews: [{ rating: 3 }, { rating: 3 }],
      paidQuantity: 2,
    },
    {
      id: 'better',
      createdAt: new Date('2026-01-01'),
      variants: [{ pricePaise: 1200 }],
      reviews: [{ rating: 5 }],
      paidQuantity: 8,
    },
    {
      id: 'cheaper',
      createdAt: new Date('2025-12-01'),
      variants: [{ pricePaise: 500 }],
      reviews: [],
      paidQuantity: 0,
    },
  ];
  expect(sortCatalogueProducts(products, 'best').map((item) => item.id)).toEqual([
    'better',
    'newer',
    'cheaper',
  ]);
  expect(sortCatalogueProducts(products, 'price-low').map((item) => item.id)).toEqual([
    'cheaper',
    'newer',
    'better',
  ]);
});
