import { prisma } from '@/lib/prisma';
import { providerFetch } from '@/lib/provider-fetch';
import { hasConfiguredValue } from '@/lib/configuration';

export async function sendOrderConfirmationEmail(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL;
  if (
    !hasConfiguredValue(apiKey) ||
    !hasConfiguredValue(sender, ['example.com'])
  )
    return { sent: false as const, reason: 'email_provider_not_configured' };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true } }, items: true },
  });
  if (!order) return { sent: false as const, reason: 'order_not_found' };
  const recipient = order.guestEmail ?? order.user?.email;
  if (!recipient)
    return { sent: false as const, reason: 'recipient_not_found' };

  const existing = await prisma.emailDelivery.findUnique({
    where: { orderId_kind: { orderId, kind: 'ORDER_CONFIRMATION' } },
  });
  if (existing?.status === 'SENT')
    return { sent: true as const, duplicate: true as const };
  await prisma.emailDelivery.upsert({
    where: { orderId_kind: { orderId, kind: 'ORDER_CONFIRMATION' } },
    create: { orderId, kind: 'ORDER_CONFIRMATION', status: 'PENDING' },
    update: { status: 'PENDING', errorMessage: null },
  });

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
    await prisma.emailDelivery.update({
      where: { orderId_kind: { orderId, kind: 'ORDER_CONFIRMATION' } },
      data: { status: 'FAILED', errorMessage: 'Resend request timed out' },
    });
    return { sent: false as const, reason: 'provider_timeout' };
  }
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    await prisma.emailDelivery.update({
      where: { orderId_kind: { orderId, kind: 'ORDER_CONFIRMATION' } },
      data: {
        status: 'FAILED',
        errorMessage: result.message ?? 'Resend request failed',
      },
    });
    return { sent: false as const, reason: 'provider_rejected' };
  }
  await prisma.emailDelivery.update({
    where: { orderId_kind: { orderId, kind: 'ORDER_CONFIRMATION' } },
    data: { status: 'SENT', providerMessageId: result.id },
  });
  return { sent: true as const };
}
