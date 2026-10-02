import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { moderationSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { z } from 'zod';

const moderationRequestSchema = moderationSchema.extend({
  reviewId: z.string().min(1),
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Moderation database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const reviews = await prisma.review.findMany({
    where: { status: 'PENDING' },
    include: { product: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return noStore({ data: reviews });
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Moderation database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const parsed = moderationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Moderation decision is invalid', parsed.error.flatten());

  const result = await prisma
    .$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: parsed.data.reviewId },
      });
      if (!review) throw new Error('REVIEW_NOT_FOUND');
      const updated = await tx.review.update({
        where: { id: review.id },
        data: {
          status: parsed.data.status,
          moderationReason: parsed.data.reason,
        },
      });
      await tx.moderationAction.create({
        data: {
          reviewId: review.id,
          adminUserId: identity.id,
          previousStatus: review.status,
          nextStatus: parsed.data.status,
          reason: parsed.data.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: identity.id,
          action: 'review.moderated',
          entityType: 'Review',
          entityId: review.id,
          details: { status: parsed.data.status },
        },
      });
      return updated;
    })
    .catch((error) => {
      if (error instanceof Error && error.message === 'REVIEW_NOT_FOUND')
        return null;
      throw error;
    });

  if (!result) return noStore({ error: 'Review not found' }, 404);
  return noStore({ data: result });
}
