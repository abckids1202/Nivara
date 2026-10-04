import { z } from 'zod';

const rupeeAmountSchema = z
  .coerce.number()
  .finite()
  .positive()
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    'must use no more than two decimal places',
  );

export const catalogueRowSchema = z.object({
  categorySlug: z.string().trim().min(1).max(80),
  categoryName: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(2).max(160),
  productSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(10_000),
  material: z.string().trim().max(160),
  dimensions: z.string().trim().max(160),
  care: z.string().trim().max(2_000),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  variantName: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(80),
  priceRupees: rupeeAmountSchema,
  compareAtRupees: z.union([z.literal(''), rupeeAmountSchema]),
  stockOnHand: z.coerce.number().int().nonnegative(),
  imageUrl: z.string().trim().url().or(z.literal('')),
  imageAlt: z.string().trim().max(200),
});

export type CatalogueRow = z.infer<typeof catalogueRowSchema>;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

export function parseCatalogueCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2)
    return {
      rows: [] as CatalogueRow[],
      errors: ['CSV must include a header and at least one product row'],
    };
  if (lines.length > 2_001)
    return {
      rows: [] as CatalogueRow[],
      errors: ['CSV cannot contain more than 2,000 product rows'],
    };
  const headers = parseCsvLine(lines[0]);
  const rows: CatalogueRow[] = [];
  const errors: string[] = [];
  const seenSkus = new Set<string>();
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const candidate = Object.fromEntries(
      headers.map((header, column) => [header, values[column] ?? '']),
    );
    const parsed = catalogueRowSchema.safeParse(candidate);
    if (!parsed.success)
      errors.push(
        `Row ${index + 1}: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
      );
    else if (seenSkus.has(parsed.data.sku))
      errors.push(`Row ${index + 1}: duplicate SKU ${parsed.data.sku}`);
    else {
      seenSkus.add(parsed.data.sku);
      rows.push(parsed.data);
    }
  }
  return { rows, errors };
}
