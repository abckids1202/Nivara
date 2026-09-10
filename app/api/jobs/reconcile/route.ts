import { markPaymentFailed, markPaymentPaid, markPaymentReview } from "@/lib/payment-state";
import { prisma } from "@/lib/prisma";
import { json, unauthorized, unavailable } from "@/lib/http";
import { sendOrderConfirmationEmail } from "@/lib/email";

function razorpayAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return null;
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }
  if (!process.env.DATABASE_URL) return unavailable("Reconciliation database is not configured");

  const auth = razorpayAuth();
  if (!auth) return unavailable("Razorpay credentials are not configured");

  const expiredReservations = await prisma.inventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    include: { order: { include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    take: 100,
  });
  const processed = { paid: 0, released: 0, review: 0, skipped: 0 };

  for (const reservation of expiredReservations) {
    const payment = reservation.order.payments[0];
    if (!payment?.providerOrderId) {
      processed.skipped += 1;
      continue;
    }

    const response = await fetch(`https://api.razorpay.com/v1/orders/${payment.providerOrderId}`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
    if (!response.ok) {
      processed.review += 1;
      await markPaymentReview(payment.id);
      continue;
    }

    const providerOrder = (await response.json()) as { status?: string };
    if (providerOrder.status === "paid") {
      const result = await markPaymentPaid({ paymentAttemptId: payment.id });
      if (result.status === "paid" && result.orderId) await sendOrderConfirmationEmail(result.orderId);
      processed.paid += 1;
    } else if (providerOrder.status === "created") {
      await markPaymentFailed(payment.id, "CANCELLED");
      processed.released += 1;
    } else {
      await markPaymentReview(payment.id);
      processed.review += 1;
    }
  }

  return json({ processed });
}
