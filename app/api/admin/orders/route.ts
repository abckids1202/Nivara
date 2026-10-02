import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { Prisma } from '@prisma/client';
import { evaluateFulfilmentTransition } from '@/lib/fulfilment-rules';
import { adminOrderQuerySchema, fulfilmentUpdateSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const parsedQuery = adminOrderQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsedQuery.success)
    return badRequest(
      'Order search query is invalid',
      parsedQuery.error.flatten(),
    );
  try {
    const query = parsedQuery.data.q;
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
    return noStore({ data: orders });
  } catch (error) {
    logServerError('admin_orders_read_failed', error);
    return unavailable('Orders are temporarily unavailable');
  }
}

export async function PATCH(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const body = (await request.json().catch(() => null)) as
    | ({ orderId?: string } & Record<string, unknown>)
    | null;
  const parsed = fulfilmentUpdateSchema.safeParse(body);
  if (!body?.orderId || !parsed.success)
    return badRequest('Order fulfilment update is invalid');

  try {
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
        select: { fulfilmentStatus: true, paymentStatus: true },
      });
      if (!order) return { kind: 'not-found' as const };
      if (order.paymentStatus !== 'PAID') return { kind: 'unpaid' as const };

      const transition = evaluateFulfilmentTransition(
        order.fulfilmentStatus,
        parsed.data.status,
      );
      if (!transition.allowed) return { kind: transition.kind };

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
            transition.kind === 'correction'
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
    if (result.kind === 'not-found')
      return noStore({ error: 'Order not found' }, 404);
    if (result.kind === 'backward')
      return badRequest('Fulfilment status cannot move backwards');
    if (result.kind === 'skipped')
      return badRequest('Fulfilment status must move one stage at a time');
    if (result.kind === 'unpaid')
      return badRequest('Fulfilment requires verified captured payment');
    return noStore({ data: result.order });
  } catch (error) {
    logServerError('admin_order_fulfilment_update_failed', error);
    return unavailable('Order update is temporarily unavailable');
  }
}
