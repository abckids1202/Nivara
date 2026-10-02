import { noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { logServerError } from '@/lib/safe-logging';
import { getAuthenticatedIdentity } from '@/lib/server-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Order database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const { orderNumber } = await params;
  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber, userId: identity.id },
      include: { items: true, shipment: true },
    });
    if (!order) return noStore({ error: 'Order not found' }, 404);
    return noStore({ data: order });
  } catch (error) {
    logServerError('order_detail_read_failed', error);
    return unavailable('Order is temporarily unavailable');
  }
}
