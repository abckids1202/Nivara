import { prisma } from '@/lib/prisma';
import { unavailable, json } from '@/lib/http';
import { sortCatalogueProducts } from '@/lib/catalogue-sort';

const allowedSorts = new Set(['newest', 'best', 'price-low', 'price-high']);

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return unavailable('Catalogue database is not configured');
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  const category = url.searchParams.get('category')?.trim();
  const availability = url.searchParams.get('availability');
  const sort = url.searchParams.get('sort') ?? 'newest';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(
    48,
    Math.max(1, Number(url.searchParams.get('pageSize') ?? '12') || 12),
  );
  const maxPricePaise = Number(url.searchParams.get('maxPricePaise'));
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
  if (availability === 'available')
    filters.push({ variants: { some: { stockOnHand: { gt: 0 } } } });
  if (availability === 'soldout')
    filters.push({ variants: { every: { stockOnHand: { lte: 0 } } } });
  if (Number.isFinite(maxPricePaise) && maxPricePaise > 0) {
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
      variants: { select: { pricePaise: true } },
      reviews: { where: { status: 'APPROVED' }, select: { rating: true } },
    },
  });
  const normalizedSort = allowedSorts.has(sort) ? sort : 'newest';
  const orderedIds = sortCatalogueProducts(candidates, normalizedSort).map(
    (product) => product.id,
  );
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
          (variant) => variant.stockOnHand > 0,
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
    sort: normalizedSort,
  });
}
