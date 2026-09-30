import { markPaymentPaid } from '@/lib/payment-state';
import { releaseReservationsForOrder } from '@/lib/checkout';
import {
  badRequest,
  forbidden,
  json,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { paymentReviewResolutionSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;

  const body = (await request.json().catch(() => null)) as
    | ({ orderId?: string } & Record<string, unknown>)
    | null;
  const parsed = paymentReviewResolutionSchema.safeParse(body);
  if (!body?.orderId || !parsed.success)
    return badRequest(
      'Payment review resolution is invalid',
      parsed.success ? undefined : parsed.error.flatten(),
    );

  const order = await prisma.order.findUnique({
    where: { id: body.orderId },
    include: {
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      reservations: true,
    },
  });
  if (!order) return json({ error: 'Order not found' }, 404);
  if (
    order.paymentStatus !== 'PAYMENT_REVIEW' &&
    order.paymentStatus !== 'PAID_REVIEW'
  ) {
    return badRequest('This order is not waiting for payment review');
  }

  const payment = order.payments[0];
  if (!payment) return badRequest('The order has no payment attempt');

  if (parsed.data.action === 'FULFIL') {
    if (order.paymentStatus !== 'PAID_REVIEW') {
      return badRequest('Fulfilment requires verified captured payment');
    }
    const result = await markPaymentPaid({
      paymentAttemptId: payment.id,
      providerPaymentId: payment.providerPaymentId ?? undefined,
    });
    if (result.status === 'paid_review')
      return badRequest(
        'Stock is no longer available; resolve this order by refund or cancellation',
      );
  } else {
    await releaseReservationsForOrder(order.id);
    await prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          ...(parsed.data.refundReference
            ? { refundReference: parsed.data.refundReference }
            : {}),
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'CANCELLED' },
      });
    });
  }

  const resolution = await prisma.$transaction(async (tx) => {
    const result = await tx.paymentReviewResolution.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        adminUserId: access.identity.id,
        action: parsed.data.action,
        reason: parsed.data.reason,
        refundReference: parsed.data.refundReference,
      },
      update: {
        adminUserId: access.identity.id,
        action: parsed.data.action,
        reason: parsed.data.reason,
        refundReference: parsed.data.refundReference,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: access.identity.id,
        action: `order.payment_review_${parsed.data.action.toLowerCase()}`,
        entityType: 'Order',
        entityId: order.id,
        details: {
          reason: parsed.data.reason,
          refundReference: parsed.data.refundReference,
        },
      },
    });
    return result;
  });

  return json({ data: resolution });
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const orders = await prisma.order.findMany({
    where: { paymentStatus: { in: ['PAYMENT_REVIEW', 'PAID_REVIEW'] } },
    include: {
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      items: true,
      paymentReviewResolution: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return json({ data: orders });
}
