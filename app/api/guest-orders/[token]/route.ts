import { consumeRateLimit } from '@/lib/access-rate';
import { createHash } from 'node:crypto';
import { isGuestOrderToken } from '@/lib/guest-token';
import { requestFingerprint } from '@/lib/request-fingerprint';
import { prisma } from '@/lib/prisma';
import { noStore, unavailable } from '@/lib/http';
import { logServerError } from '@/lib/safe-logging';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Guest order access is not configured');

  try {
    const { token } = await params;
    if (!isGuestOrderToken(token))
      return noStore({ error: 'Order link is invalid or expired' }, 404);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (
      !(await consumeRateLimit({
        request,
        endpoint: `guest-order-access:${tokenHash.slice(0, 16)}`,
        maxAttempts: 10,
      }))
    )
      return noStore({ error: 'Too many access attempts' }, 429);

    if (
      !(await consumeRateLimit({
        request,
        endpoint: 'guest-order-access:client',
        maxAttempts: 30,
      }))
    )
      return noStore({ error: 'Too many access attempts' }, 429);

    const fingerprint = requestFingerprint(request);
    const order = await prisma.order.findFirst({
      where: { guestAccessHash: tokenHash },
      select: {
        orderNumber: true,
        paymentStatus: true,
        fulfilmentStatus: true,
        totalPaise: true,
        id: true,
        guestAccessExpiry: true,
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            unitPricePaise: true,
            quantity: true,
          },
        },
        shipment: {
          select: { courierName: true, trackingReference: true },
        },
      },
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
  } catch (error) {
    logServerError('guest_order_access_failed', error);
    return unavailable('Guest order access is temporarily unavailable');
  }
}
