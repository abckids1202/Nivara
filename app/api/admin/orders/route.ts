import {
  badRequest,
  forbidden,
  json,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { Prisma } from '@prisma/client';
import { fulfilmentUpdateSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';

const fulfilmentRank = { PROCESSING: 0, SHIPPED: 1, DELIVERED: 2 } as const;

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const query = new URL(request.url).searchParams.get('q')?.trim();
  const orders = await prisma.order.findMany({
    where: query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { guestEmail: { contains: query, mode: 'insensitive' } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    include: {
      items: true,
      shipment: true,
      user: { select: { email: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return json({ data: orders });
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const body = (await request.json().catch(() => null)) as
    | ({ orderId?: string } & Record<string, unknown>)
    | null;
  const parsed = fulfilmentUpdateSchema.safeParse(body);
  if (!body?.orderId || !parsed.success)
    return badRequest('Order fulfilment update is invalid');

  const result = await prisma.$transaction(async (tx) => {
    // Serialize fulfilment changes so two administrators cannot both approve
    // a transition based on the same stale status.
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${body.orderId}
      FOR UPDATE
    `);
    const order = await tx.order.findUnique({
      where: { id: body.orderId },
      select: { fulfilmentStatus: true },
    });
    if (!order) return { kind: 'not-found' as const };

    const currentRank = fulfilmentRank[order.fulfilmentStatus];
    const nextRank = fulfilmentRank[parsed.data.status];
    if (nextRank < currentRank) return { kind: 'backward' as const };
    if (nextRank > currentRank + 1) return { kind: 'skipped' as const };

    const result = await tx.order.update({
      where: { id: body.orderId },
      data: {
        fulfilmentStatus: parsed.data.status,
        shipment: {
          upsert: {
            create: {
              courierName: parsed.data.courierName,
              trackingReference: parsed.data.trackingReference,
            },
            update: {
              courierName: parsed.data.courierName,
              trackingReference: parsed.data.trackingReference,
            },
          },
        },
      },
      include: { shipment: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: access.identity.id,
        action:
          nextRank === currentRank
            ? 'order.fulfilment_correction'
            : 'order.fulfilment_updated',
        entityType: 'Order',
        entityId: result.id,
        details: {
          previousStatus: order.fulfilmentStatus,
          status: parsed.data.status,
          courierName: parsed.data.courierName,
          trackingReference: parsed.data.trackingReference,
        },
      },
    });
    return { kind: 'updated' as const, order: result };
  });
  if (result.kind === 'not-found') return json({ error: 'Order not found' }, 404);
  if (result.kind === 'backward')
    return badRequest('Fulfilment status cannot move backwards');
  if (result.kind === 'skipped')
    return badRequest('Fulfilment status must move one stage at a time');
  return json({ data: result.order });
}
