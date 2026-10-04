import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { parseCatalogueCsv } from '@/lib/catalogue-import';
import { rupeesToPaise } from '@/lib/money';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const csv = await request.text();
  if (csv.length > 2_000_000) return badRequest('Catalogue file is too large');
  const parsed = parseCatalogueCsv(csv);
  const dryRun = new URL(request.url).searchParams.get('dryRun') !== 'false';
  if (parsed.errors.length)
    return badRequest('Catalogue contains invalid rows', parsed.errors);
  if (dryRun)
    return noStore({
      dryRun: true,
      rowCount: parsed.rows.length,
      preview: parsed.rows,
    });

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const row of parsed.rows) {
          const pricePaise = rupeesToPaise(row.priceRupees);
          const compareAtPaise =
            row.compareAtRupees === ''
              ? null
              : rupeesToPaise(row.compareAtRupees);
          const category = await tx.category.upsert({
            where: { slug: row.categorySlug },
            create: { slug: row.categorySlug, name: row.categoryName },
            update: { name: row.categoryName },
          });
          const product = await tx.product.upsert({
            where: { slug: row.productSlug },
            create: {
              categoryId: category.id,
              name: row.productName,
              slug: row.productSlug,
              description: row.description,
              material: row.material || null,
              dimensions: row.dimensions || null,
              care: row.care || null,
              status: row.status,
            },
            update: {
              categoryId: category.id,
              name: row.productName,
              description: row.description,
              material: row.material || null,
              dimensions: row.dimensions || null,
              care: row.care || null,
              status: row.status,
            },
          });
          await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "ProductVariant"
        WHERE "sku" = ${row.sku}
        FOR UPDATE
      `);
          const existingVariant = await tx.productVariant.findUnique({
            where: { sku: row.sku },
            select: { stockReserved: true },
          });
          if (
            existingVariant &&
            row.stockOnHand < existingVariant.stockReserved
          )
            throw new Error('STOCK_BELOW_RESERVED');
          await tx.productVariant.upsert({
            where: { sku: row.sku },
            create: {
              productId: product.id,
              name: row.variantName,
              sku: row.sku,
              pricePaise,
              compareAtPaise,
              stockOnHand: row.stockOnHand,
            },
            update: {
              productId: product.id,
              name: row.variantName,
              pricePaise,
              compareAtPaise,
              stockOnHand: row.stockOnHand,
            },
          });
          if (row.imageUrl) {
            const existingImage = await tx.productImage.findFirst({
              where: { productId: product.id, url: row.imageUrl },
              select: { id: true },
            });
            if (existingImage)
              await tx.productImage.update({
                where: { id: existingImage.id },
                data: { altText: row.imageAlt || row.productName },
              });
            else
              await tx.productImage.create({
                data: {
                  productId: product.id,
                  url: row.imageUrl,
                  altText: row.imageAlt || row.productName,
                },
              });
          }
        }
        await tx.auditLog.create({
          data: {
            actorId: identity.id,
            action: 'catalogue.imported',
            entityType: 'Catalogue',
            entityId: 'bulk',
            details: { rowCount: parsed.rows.length },
          },
        });
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'STOCK_BELOW_RESERVED')
      return badRequest('Catalogue stock cannot be below reserved quantity');
    logServerError('catalogue_import_failed', error);
    return unavailable('Catalogue import is temporarily unavailable');
  }

  return noStore({ imported: parsed.rows.length });
}
