import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { badRequest, noStore, unavailable } from '@/lib/http';
import { isSellable } from '@/lib/inventory';
import { selectDefaultVariant } from '@/lib/catalogue-display';
import { catalogueQuerySchema } from '@/lib/schemas';
import { logServerError } from '@/lib/safe-logging';

const catalogueProductInclude = {
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  variants: {
    select: {
      id: true,
      name: true,
      pricePaise: true,
      compareAtPaise: true,
      stockOnHand: true,
      stockReserved: true,
    },
  },
  reviews: { where: { status: 'APPROVED' as const }, select: { rating: true } },
} satisfies Prisma.ProductInclude;

type CatalogueProduct = Prisma.ProductGetPayload<{
  include: typeof catalogueProductInclude;
}>;

type CatalogueCandidate = { id: string; total: bigint | number };

function candidateQuery({
  query,
  category,
  availability,
  sort,
  page,
  pageSize,
  minPricePaise,
  maxPricePaise,
}: {
  query?: string;
  category?: string;
  availability: 'all' | 'available' | 'soldout';
  sort: 'newest' | 'best' | 'price-low' | 'price-high';
  page: number;
  pageSize: number;
  minPricePaise?: number;
  maxPricePaise?: number;
}) {
  const conditions: Prisma.Sql[] = [Prisma.sql`p."status" = 'PUBLISHED'`];
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(Prisma.sql`(
      p."name" ILIKE ${pattern}
      OR p."description" ILIKE ${pattern}
      OR EXISTS (
        SELECT 1
        FROM "ProductVariant" search_variant
        WHERE search_variant."productId" = p."id"
          AND search_variant."sku" ILIKE ${pattern}
      )
    )`);
  }
  if (category) conditions.push(Prisma.sql`c."slug" = ${category}`);
  if (availability === 'available')
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM "ProductVariant" available_variant
      WHERE available_variant."productId" = p."id"
        AND available_variant."stockOnHand" > available_variant."stockReserved"
    )`);
  if (availability === 'soldout')
    conditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1
      FROM "ProductVariant" available_variant
      WHERE available_variant."productId" = p."id"
        AND available_variant."stockOnHand" > available_variant."stockReserved"
    )`);

  const sales = Prisma.sql`(
    SELECT COUNT(DISTINCT paid_order."id")
    FROM "OrderItem" order_item
    JOIN "Order" paid_order ON paid_order."id" = order_item."orderId"
    JOIN "ProductVariant" sold_variant ON sold_variant."id" = order_item."variantId"
    WHERE sold_variant."productId" = p."id"
      AND paid_order."paymentStatus" = 'PAID'
  )`;
  const averageRating = Prisma.sql`COALESCE((
    SELECT AVG(approved_review."rating")
    FROM "Review" approved_review
    WHERE approved_review."productId" = p."id"
      AND approved_review."status" = 'APPROVED'
  ), 0)`;
  const reviewCount = Prisma.sql`(
    SELECT COUNT(*)
    FROM "Review" approved_review
    WHERE approved_review."productId" = p."id"
      AND approved_review."status" = 'APPROVED'
  )`;
  // Match the storefront display rule: use the cheapest sellable variant,
  // falling back to the cheapest variant only when the product is sold out.
  const displayPrice = Prisma.sql`COALESCE((
    SELECT MIN(sellable_variant."pricePaise")
    FROM "ProductVariant" sellable_variant
    WHERE sellable_variant."productId" = p."id"
      AND sellable_variant."stockOnHand" > sellable_variant."stockReserved"
  ), COALESCE((
    SELECT MIN(any_variant."pricePaise")
    FROM "ProductVariant" any_variant
    WHERE any_variant."productId" = p."id"
  ), 2147483647))`;
  if (minPricePaise !== undefined)
    conditions.push(Prisma.sql`${displayPrice} >= ${minPricePaise}`);
  if (maxPricePaise !== undefined)
    conditions.push(Prisma.sql`${displayPrice} <= ${maxPricePaise}`);
  const orderBy =
    sort === 'best'
      ? Prisma.sql`${sales} DESC, ${averageRating} DESC, ${reviewCount} DESC, p."createdAt" DESC`
      : sort === 'price-low'
        ? Prisma.sql`${displayPrice} ASC, p."createdAt" DESC`
        : sort === 'price-high'
          ? Prisma.sql`${displayPrice} DESC, p."createdAt" DESC`
          : Prisma.sql`p."createdAt" DESC`;

  return Prisma.sql`
    SELECT p."id", COUNT(*) OVER() AS "total"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${orderBy}
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `;
}

function serializeCatalogueProduct(product: CatalogueProduct) {
  const displayVariant = selectDefaultVariant(product.variants);
  const ratings = product.reviews.map((review) => review.rating);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    image: product.images[0] ?? null,
    variants: product.variants,
    minPricePaise: displayVariant?.pricePaise ?? null,
    stockAvailable: product.variants.some((variant) =>
      isSellable(variant.stockOnHand, variant.stockReserved),
    ),
    rating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null,
    reviewCount: ratings.length,
  };
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return unavailable('Catalogue database is not configured');
  }

  const url = new URL(request.url);
  const parsedQuery = catalogueQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsedQuery.success)
    return badRequest('Invalid catalogue query', parsedQuery.error.flatten());

  const {
    q: query,
    category,
    availability,
    sort,
    page,
    pageSize,
    minPricePaise,
    maxPricePaise,
  } = parsedQuery.data;
  try {
    const candidates = await prisma.$queryRaw<CatalogueCandidate[]>(
      candidateQuery({
        query,
        category,
        availability,
        sort,
        page,
        pageSize,
        minPricePaise,
        maxPricePaise,
      }),
    );
    const pageIds = candidates.map((candidate) => candidate.id);
    const total = candidates.length ? Number(candidates[0].total) : 0;
    const products = await prisma.product.findMany({
      include: catalogueProductInclude,
      where: { id: { in: pageIds } },
    });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    const orderedProducts = pageIds.flatMap((id) => {
      const product = productById.get(id);
      return product ? [product] : [];
    });
    return noStore({
      data: orderedProducts.map(serializeCatalogueProduct),
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      sort,
    });
  } catch (error) {
    logServerError('catalogue_query_failed', error);
    return unavailable('Catalogue is temporarily unavailable');
  }
}
