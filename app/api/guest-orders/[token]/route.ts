import { consumeRateLimit } from '@/lib/access-rate';
import { createHash } from 'node:crypto';
import { requestFingerprint } from '@/lib/request-fingerprint';
import { prisma } from '@/lib/prisma';
import { noStore, unavailable } from '@/lib/http';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Guest order access is not configured');

  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'guest-order-access',
      maxAttempts: 10,
    }))
  )
    return noStore({ error: 'Too many access attempts' }, 429);

  const fingerprint = requestFingerprint(request);
  const { token } = await params;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const order = await prisma.order.findFirst({
    where: { guestAccessHash: tokenHash },
    include: { items: true, shipment: true },
  });
  const valid = Boolean(
    order && order.guestAccessExpiry && order.guestAccessExpiry > new Date(),
  );

  await prisma.guestOrderAccessAttempt.create({
    data: {
      orderId: valid ? order?.id : undefined,
      tokenHash,
      requestFingerprint: fingerprint,
      successful: valid,
    },
  });
  if (!valid || !order)
    return noStore({ error: 'Order link is invalid or expired' }, 404);

  return noStore({
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    totalPaise: order.totalPaise,
    items: order.items,
    shipment: order.shipment,
  });
}
