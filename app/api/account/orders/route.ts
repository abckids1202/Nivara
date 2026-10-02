import { noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  try {
    const orders = await prisma.order.findMany({
      where: { userId: identity.id },
      include: {
        items: { include: { variant: { select: { productId: true } } } },
        shipment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return noStore({ data: orders });
  } catch (error) {
    logServerError('account_orders_read_failed', error);
    return unavailable('Orders are temporarily unavailable');
  }
}
