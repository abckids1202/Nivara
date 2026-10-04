import {
  cancelPaymentReview,
  fulfilPaymentReview,
} from '@/lib/payment-state';
import { Prisma } from '@prisma/client';
import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import {
  paymentReviewQuerySchema,
  paymentReviewResolutionSchema,
} from '@/lib/schemas';
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

export async function PATCH(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  try {
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
    if (!order) return noStore({ error: 'Order not found' }, 404);
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
      const result = await fulfilPaymentReview({
        paymentAttemptId: payment.id,
        orderId: order.id,
        providerPaymentId: payment.providerPaymentId ?? undefined,
      });
      if (result.status === 'stock_unavailable')
        return badRequest(
          'Stock is no longer available; resolve this order by refund or cancellation',
        );
      if (result.status === 'missing')
        return noStore({ error: 'Payment not found' }, 404);
      if (result.status === 'not_review')
        return badRequest('This order is no longer waiting for payment review');
    } else {
      const result = await cancelPaymentReview({
        paymentAttemptId: payment.id,
        orderId: order.id,
        refundReference: parsed.data.refundReference,
      });
      if (result.status === 'missing')
        return noStore({ error: 'Payment not found' }, 404);
      if (result.status === 'not_review')
        return badRequest('This order is no longer waiting for payment review');
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

    return noStore({ data: resolution });
  } catch (error) {
    logServerError('admin_payment_review_mutation_failed', error);
    return unavailable('Payment review is temporarily unavailable');
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const parsedQuery = paymentReviewQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsedQuery.success)
    return badRequest(
      'Payment review query is invalid',
      parsedQuery.error.flatten(),
    );
  try {
    const { page, pageSize } = parsedQuery.data;
    const where: Prisma.OrderWhereInput = {
      paymentStatus: { in: ['PAYMENT_REVIEW', 'PAID_REVIEW'] },
    };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
          items: true,
          paymentReviewResolution: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);
    return noStore({
      data: orders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    logServerError('admin_payment_review_read_failed', error);
    return unavailable('Payment review is temporarily unavailable');
  }
}
