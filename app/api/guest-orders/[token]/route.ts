import { createHash } from 'node:crypto';
import { requestFingerprint } from '@/lib/request-fingerprint';
import { prisma } from '@/lib/prisma';
import { json, unavailable } from '@/lib/http';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Guest order access is not configured');

  const fingerprint = requestFingerprint(request);
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recentAttempts = await prisma.guestOrderAccessAttempt.count({
    where: { requestFingerprint: fingerprint, createdAt: { gt: since } },
  });
  if (recentAttempts >= 10)
    return json({ error: 'Too many access attempts' }, 429);

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
    return json({ error: 'Order link is invalid or expired' }, 404);

  return json({
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    totalPaise: order.totalPaise,
    items: order.items,
    shipment: order.shipment,
  });
}
