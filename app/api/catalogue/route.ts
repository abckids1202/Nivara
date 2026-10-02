import { prisma } from '@/lib/prisma';
import { badRequest, unavailable, json } from '@/lib/http';
import { sortCatalogueProducts } from '@/lib/catalogue-sort';
import { isSellable } from '@/lib/inventory';
import { catalogueQuerySchema } from '@/lib/schemas';

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
    maxPricePaise,
  } = parsedQuery.data;
  const filters: object[] = [];

  if (query) {
    filters.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        {
          variants: { some: { sku: { contains: query, mode: 'insensitive' } } },
        },
      ],
    });
  }
  if (category) filters.push({ category: { slug: category } });
  if (maxPricePaise !== undefined) {
    filters.push({
      variants: { some: { pricePaise: { lte: maxPricePaise } } },
    });
  }
  const where = { status: 'PUBLISHED' as const, AND: filters };

  const candidates = await prisma.product.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      variants: {
        select: {
          pricePaise: true,
          stockOnHand: true,
          stockReserved: true,
          orderItems: {
            where: { order: { paymentStatus: 'PAID' } },
            select: { quantity: true },
          },
        },
      },
      reviews: { where: { status: 'APPROVED' }, select: { rating: true } },
    },
  });
  const availabilityFiltered = candidates.filter((product) => {
    if (availability === 'available')
      return product.variants.some(
        (variant) => isSellable(variant.stockOnHand, variant.stockReserved),
      );
    if (availability === 'soldout')
      return product.variants.every(
        (variant) => !isSellable(variant.stockOnHand, variant.stockReserved),
      );
    return true;
  });
  const orderedIds = sortCatalogueProducts(
    availabilityFiltered.map((product) => ({
      ...product,
      paidQuantity: product.variants.reduce(
        (sum, variant) =>
          sum +
          variant.orderItems.reduce(
            (quantity, item) => quantity + item.quantity,
            0,
          ),
        0,
      ),
    })),
    sort,
  ).map((product) => product.id);
  const pageIds = orderedIds.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
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
      reviews: { where: { status: 'APPROVED' }, select: { rating: true } },
    },
    where: { id: { in: pageIds } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderedProducts = pageIds.flatMap((id) => {
    const product = productById.get(id);
    return product ? [product] : [];
  });
  const total = orderedIds.length;

  return json({
    data: orderedProducts.map((product) => {
      const prices = product.variants.map((variant) => variant.pricePaise);
      const ratings = product.reviews.map((review) => review.rating);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        category: product.category,
        image: product.images[0] ?? null,
        variants: product.variants,
        minPricePaise: prices.length ? Math.min(...prices) : null,
        stockAvailable: product.variants.some(
          (variant) => isSellable(variant.stockOnHand, variant.stockReserved),
        ),
        rating: ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null,
        reviewCount: ratings.length,
      };
    }),
    page,
    pageSize,
    total,
    pages: Math.ceil(total / pageSize),
    sort,
  });
}
