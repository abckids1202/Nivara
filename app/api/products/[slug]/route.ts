import { json, unavailable } from '@/lib/http';
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

    if (!product) return json({ error: 'Product not found' }, 404);

    const ratings = product.reviews.map((review) => review.rating);
    return json({
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
        rating: ratings.length
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null,
        reviewCount: ratings.length,
      },
    });
  } catch (error) {
    logServerError('product_query_failed', error);
    return unavailable('Product is temporarily unavailable');
  }
}
