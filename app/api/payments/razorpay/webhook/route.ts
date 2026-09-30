import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { markPaymentFailed, markPaymentPaid } from '@/lib/payment-state';
import { prisma } from '@/lib/prisma';
import { json, unavailable } from '@/lib/http';
import { sendOrderConfirmationEmail } from '@/lib/email';
import { razorpaySignatureMatches } from '@/lib/razorpay-webhook';

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret)
    return unavailable('Razorpay webhook secret is not configured');

  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (
    !signature ||
    !razorpaySignatureMatches(rawBody, signature, webhookSecret)
  ) {
    return json({ error: 'Invalid webhook signature' }, 401);
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as {
        id?: string;
        event?: string;
        payload?: {
          payment?: { entity?: { id?: string; order_id?: string } };
          order?: { entity?: { id?: string } };
        };
      };
    } catch {
      return null;
    }
  })();
  if (!payload) return json({ error: 'Webhook body is invalid JSON' }, 400);
  /* Keep the raw body for the provider-event audit hash. */
  const typedPayload = payload as {
    id?: string;
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
      order?: { entity?: { id?: string } };
    };
  };
  const providerEventId =
    request.headers.get('x-razorpay-event-id') ?? typedPayload.id;
  if (!providerEventId)
    return json({ error: 'Missing provider event ID' }, 400);

  try {
    const payloadHash = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    const paymentId = typedPayload.payload?.payment?.entity?.id;
    const providerOrderId =
      typedPayload.payload?.payment?.entity?.order_id ??
      typedPayload.payload?.order?.entity?.id;
    const attempt = providerOrderId
      ? await prisma.paymentAttempt.findFirst({ where: { providerOrderId } })
      : null;

    let duplicate = false;
    try {
      await prisma.paymentEvent.create({
        data: {
          providerEventId,
          ...(attempt ? { paymentAttemptId: attempt.id } : {}),
          payloadHash,
        },
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      )
        throw error;
      duplicate = true;
      const previous = await prisma.paymentEvent.findUnique({
        where: { providerEventId },
        select: { payloadHash: true },
      });
      if (previous?.payloadHash !== payloadHash)
        return json({ error: 'Provider event ID was reused' }, 400);
    }

    if (!attempt) return json({ received: true, matched: false, duplicate });

    if (
      typedPayload.event === 'payment.captured' ||
      typedPayload.event === 'order.paid'
    ) {
      const result = await markPaymentPaid({
        paymentAttemptId: attempt.id,
        providerPaymentId: paymentId,
      });
      if (
        (result.status === 'paid' || result.status === 'already_paid') &&
        result.orderId
      ) {
        const email = await sendOrderConfirmationEmail(result.orderId);
        if (!email.sent) {
          console.error('order_confirmation_email_pending', {
            orderId: result.orderId,
            reason: email.reason,
          });
          return json(
            { error: 'Payment accepted; confirmation email will be retried' },
            503,
          );
        }
      }
    } else if (typedPayload.event === 'payment.failed') {
      await markPaymentFailed(attempt.id, 'FAILED');
    } else if (typedPayload.event === 'payment.cancelled') {
      await markPaymentFailed(attempt.id, 'CANCELLED');
    }

    return json({ received: true, duplicate });
  } catch (error) {
    console.error(
      'razorpay_webhook_failed',
      error instanceof Error ? error.message : 'unknown_error',
    );
    return json({ error: 'Webhook processing failed' }, 500);
  }
}
