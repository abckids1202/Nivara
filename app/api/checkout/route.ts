import {
  CheckoutConflict,
  createPendingOrder,
  releaseReservationsForOrder,
} from '@/lib/checkout';
import { badRequest, noStore, unavailable } from '@/lib/http';
import { checkoutRequestSchema } from '@/lib/schemas';
import { getAuthenticatedIdentity } from '@/lib/server-auth';
import { providerFetch } from '@/lib/provider-fetch';
import { consumeRateLimit } from '@/lib/access-rate';
import { hasConfiguredValue } from '@/lib/configuration';
import { logServerError } from '@/lib/safe-logging';
import { readRazorpayOrderId } from '@/lib/razorpay-order';

export async function POST(request: Request) {
  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'checkout.create',
      maxAttempts: 20,
    }))
  )
    return noStore(
      { error: 'Too many checkout attempts. Please try again later.' },
      429,
    );
  if (!process.env.DATABASE_URL) {
    return unavailable('Checkout database is not configured');
  }

  const parsed = checkoutRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Checkout details are invalid', parsed.error.flatten());

  const identity = await getAuthenticatedIdentity(request);
  const input = parsed.data;
  const address = { ...input, email: identity?.email ?? input.email };

  let pending: Awaited<ReturnType<typeof createPendingOrder>> | null = null;
  try {
    pending = await createPendingOrder({
      userId: identity?.id,
      address,
      items: input.items,
    });

    if (
      !hasConfiguredValue(process.env.RAZORPAY_KEY_ID) ||
      !hasConfiguredValue(process.env.RAZORPAY_KEY_SECRET)
    ) {
      await releaseReservationsForOrder(pending.order.id);
      return unavailable('Razorpay test credentials are not configured');
    }

    const razorpayResponse = await providerFetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pending.order.totalPaise,
        currency: 'INR',
        receipt: pending.order.orderNumber,
      }),
    });

    if (!razorpayResponse.ok) {
      await releaseReservationsForOrder(pending.order.id);
      return unavailable('Razorpay could not create the test payment');
    }

    const razorpayOrder = (await razorpayResponse.json()) as {
      id?: unknown;
      amount?: unknown;
      currency?: unknown;
    };
    const razorpayOrderId = readRazorpayOrderId(
      razorpayOrder,
      pending.order.totalPaise,
    );
    if (!razorpayOrderId) {
      await releaseReservationsForOrder(pending.order.id);
      return unavailable('Razorpay returned a mismatched payment order');
    }

    const { prisma } = await import('@/lib/prisma');
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: pending.order.payments[0].id },
        data: { providerOrderId: razorpayOrderId, status: 'PENDING' },
      }),
      prisma.order.update({
        where: { id: pending.order.id },
        data: { paymentStatus: 'PENDING' },
      }),
    ]);

    return noStore(
      {
        orderNumber: pending.order.orderNumber,
        razorpayOrderId,
        keyId: process.env.RAZORPAY_KEY_ID,
        amountPaise: pending.order.totalPaise,
        currency: 'INR',
        guestAccessToken: pending.guestAccessToken,
      },
      201,
    );
  } catch (error) {
    if (error instanceof CheckoutConflict) return badRequest(error.message);
    if (pending)
      await releaseReservationsForOrder(pending.order.id).catch(() => undefined);
    logServerError('checkout_create_failed', error);
    return unavailable('Checkout is temporarily unavailable');
  }
}
