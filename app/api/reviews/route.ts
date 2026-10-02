import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity } from '@/lib/server-auth';
import { consumeRateLimit } from '@/lib/access-rate';
import { z } from 'zod';
import { logServerError } from '@/lib/safe-logging';

const reviewSchema = z.object({
  productId: z.string().min(1),
  orderItemId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(2_000),
  displayName: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Review database is not configured');
  const productId = new URL(request.url).searchParams.get('productId');
  if (!productId) return badRequest('productId is required');
  try {
    const reviews = await prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      select: {
        id: true,
        rating: true,
        body: true,
        displayName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return noStore({ data: reviews });
  } catch (error) {
    logServerError('reviews_query_failed', error);
    return unavailable('Reviews are temporarily unavailable');
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Review database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  try {
    if (
      !(await consumeRateLimit({
        request,
        endpoint: 'reviews.create',
        maxAttempts: 10,
      }))
    )
      return noStore(
        { error: 'Too many review submissions. Please try again later.' },
        429,
      );
  } catch (error) {
    logServerError('reviews_rate_limit_failed', error);
    return unavailable('Review submission is temporarily unavailable');
  }
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return badRequest('Review details are invalid', parsed.error.flatten());

  const item = await prisma.orderItem.findFirst({
    where: {
      id: parsed.data.orderItemId,
      variant: { productId: parsed.data.productId },
      order: {
        userId: identity.id,
        paymentStatus: 'PAID',
        fulfilmentStatus: 'DELIVERED',
      },
    },
  });
  if (!item)
    return forbidden(
      'A delivered paid order is required to review this product',
    );

  try {
    const review = await prisma.review.create({
      data: {
        productId: parsed.data.productId,
        orderItemId: parsed.data.orderItemId,
        userId: identity.id,
        rating: parsed.data.rating,
        body: parsed.data.body,
        displayName: parsed.data.displayName,
      },
      select: {
        id: true,
        rating: true,
        body: true,
        displayName: true,
        status: true,
        createdAt: true,
      },
    });
    return noStore({ data: review }, 201);
  } catch (error) {
    logServerError('review_create_failed', error);
    return badRequest('A review may already exist for this order item');
  }
}
