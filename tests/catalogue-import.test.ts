import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogueCsv } from "../lib/catalogue-import.ts";

const header = "categorySlug,categoryName,productName,productSlug,description,material,dimensions,care,status,variantName,sku,priceRupees,compareAtRupees,stockOnHand,imageUrl,imageAlt";

void test("parses valid catalogue rows and quoted commas", () => {
  const result = parseCatalogueCsv(`${header}\norganise,Organise,"Desk, organiser",desk-organiser,"A useful piece, thoughtfully made",Oak,"24 x 12 cm",Wipe clean,PUBLISHED,Natural,NIV-001,1499,,8,,Desk organiser`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0]?.productName, "Desk, organiser");
  assert.equal(result.rows[0]?.priceRupees, 1499);
});

void test("reports invalid catalogue rows without importing them", () => {
  const result = parseCatalogueCsv(`${header}\norganise,Organise,Bad product,INVALID SLUG,short,,,,PUBLISHED,Natural,NIV-002,0,,0,,`);
  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.length > 0);
});
