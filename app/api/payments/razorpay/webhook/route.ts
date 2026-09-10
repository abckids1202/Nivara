import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { markPaymentFailed, markPaymentPaid } from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";
import { json, unavailable } from "@/lib/http";
import { sendOrderConfirmationEmail } from "@/lib/email";

function signaturesMatch(body: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return unavailable("Razorpay webhook secret is not configured");

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !signaturesMatch(rawBody, signature, webhookSecret)) {
    return json({ error: "Invalid webhook signature" }, 401);
  }

  const payload = JSON.parse(rawBody) as {
    id?: string;
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string } };
      order?: { entity?: { id?: string } };
    };
  };
  const providerEventId = request.headers.get("x-razorpay-event-id") ?? payload.id;
  if (!providerEventId) return json({ error: "Missing provider event ID" }, 400);

  try {
    const paymentId = payload.payload?.payment?.entity?.id;
    const providerOrderId =
      payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id;
    const attempt = providerOrderId
      ? await prisma.paymentAttempt.findFirst({ where: { providerOrderId } })
      : null;

    await prisma.paymentEvent.create({
      data: {
        providerEventId,
        ...(attempt ? { paymentAttemptId: attempt.id } : {}),
        payloadHash: createHmac("sha256", webhookSecret).update(rawBody).digest("hex"),
      },
    });

    if (!attempt) return json({ received: true, matched: false });

    if (payload.event === "payment.captured" || payload.event === "order.paid") {
      const result = await markPaymentPaid({ paymentAttemptId: attempt.id, providerPaymentId: paymentId });
      if (result.status === "paid" && result.orderId) await sendOrderConfirmationEmail(result.orderId);
    } else if (payload.event === "payment.failed") {
      await markPaymentFailed(attempt.id, "FAILED");
    } else if (payload.event === "payment.cancelled") {
      await markPaymentFailed(attempt.id, "CANCELLED");
    }

    return json({ received: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return json({ received: true, duplicate: true });
    }
    console.error("razorpay_webhook_failed", error instanceof Error ? error.message : "unknown_error");
    return json({ error: "Webhook processing failed" }, 500);
  }
}
