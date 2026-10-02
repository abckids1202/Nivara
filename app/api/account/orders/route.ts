import { badRequest, noStore, unauthorized, unavailable } from '@/lib/http';
import { accountOrderQuerySchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const parsedQuery = accountOrderQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsedQuery.success)
    return badRequest('Order history query is invalid', parsedQuery.error.flatten());
  try {
    const { page, pageSize } = parsedQuery.data;
    const where = { userId: identity.id };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { variant: { select: { productId: true } } } },
          shipment: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
    logServerError('account_orders_read_failed', error);
    return unavailable('Orders are temporarily unavailable');
  }
}
