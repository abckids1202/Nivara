import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';

export async function sendOrderConfirmationEmail(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (
    !hasConfiguredValue(apiKey) ||
    !hasConfiguredValue(sender, ['example.com'])
  )
    return { sent: false as const, reason: 'email_provider_not_configured' };

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } }, items: true },
    });
    if (!order) return { sent: false as const, reason: 'order_not_found' };
    const recipient = order.guestEmail ?? order.user?.email;
    if (!recipient)
      return { sent: false as const, reason: 'recipient_not_found' };

    const deliveryKey = {
      orderId,
      kind: 'ORDER_CONFIRMATION',
    } as const;
    const existing = await prisma.emailDelivery.findUnique({
      where: { orderId_kind: deliveryKey },
    });
    if (existing?.status === 'SENT')
      return { sent: true as const, duplicate: true as const };
    const staleClaimCutoff = new Date(Date.now() - 10 * 60 * 1000);
    if (
      existing?.status === 'PROCESSING' &&
      (!existing.updatedAt || existing.updatedAt >= staleClaimCutoff)
    )
      return { sent: false as const, reason: 'email_delivery_in_progress' };
    const claimed = await prisma.emailDelivery.updateMany({
      where: {
        ...deliveryKey,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: 'PROCESSING', updatedAt: { lt: staleClaimCutoff } },
        ],
      },
      data: { status: 'PROCESSING', errorMessage: null, providerMessageId: null },
    });
    if (claimed.count === 0) {
      let created = false;
      try {
        await prisma.emailDelivery.create({
          data: { ...deliveryKey, status: 'PROCESSING' },
        });
        created = true;
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
      }
      if (!created)
        return { sent: false as const, reason: 'email_delivery_in_progress' };
    }

    let response: Response;
    try {
      response = await providerFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `order-confirmation/${orderId}`,
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject: `Nivara order ${order.orderNumber} confirmed`,
          text: [
            `Thank you for your order, ${order.shippingFullName ?? 'there'}.`,
            `Order: ${order.orderNumber}`,
            `Total: INR ${(order.totalPaise / 100).toFixed(2)}`,
            'This is an order receipt, not a GST invoice.',
          ].join('\n'),
        }),
      });
    } catch {
      await prisma.emailDelivery.updateMany({
        where: { ...deliveryKey, status: 'PROCESSING' },
        data: { status: 'FAILED', errorMessage: 'Resend request timed out' },
      });
      return { sent: false as const, reason: 'provider_timeout' };
    }
    const result = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!response.ok) {
      await prisma.emailDelivery.updateMany({
        where: { ...deliveryKey, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          errorMessage: result.message ?? 'Resend request failed',
        },
      });
      return { sent: false as const, reason: 'provider_rejected' };
    }
    await prisma.emailDelivery.updateMany({
      where: { ...deliveryKey, status: 'PROCESSING' },
      data: { status: 'SENT', providerMessageId: result.id },
    });
    return { sent: true as const };
  } catch (error) {
    logServerError('order_confirmation_email_failed', error);
    return { sent: false as const, reason: 'email_delivery_failed' };
  }
}
