import { noStore, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { isSellable } from '@/lib/inventory';
import { logServerError } from '@/lib/safe-logging';

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');

  const { slug } = await context.params;
  try {
    const product = await prisma.product.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        category: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            pricePaise: true,
            compareAtPaise: true,
            stockOnHand: true,
            stockReserved: true,
          },
        },
        reviews: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            rating: true,
            body: true,
            displayName: true,
            createdAt: true,
            orderItem: {
              select: {
                order: {
                  select: { paymentStatus: true, fulfilmentStatus: true },
                },
              },
            },
          },
        },
      },
    });

    if (!product) return noStore({ error: 'Product not found' }, 404);

    const ratingSummary = await prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return noStore({
      data: {
        ...product,
        reviews: product.reviews.map(({ orderItem, ...review }) => ({
          ...review,
          verifiedPurchase:
            orderItem.order.paymentStatus === 'PAID' &&
            orderItem.order.fulfilmentStatus === 'DELIVERED',
        })),
        minPricePaise: product.variants.length
          ? Math.min(...product.variants.map((variant) => variant.pricePaise))
          : null,
        stockAvailable: product.variants.some((variant) =>
          isSellable(variant.stockOnHand, variant.stockReserved),
        ),
        rating: ratingSummary._avg.rating,
        reviewCount: ratingSummary._count._all,
      },
    });
  } catch (error) {
    logServerError('product_query_failed', error);
    return unavailable('Product is temporarily unavailable');
  }
}
