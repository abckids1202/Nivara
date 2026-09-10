import { json } from "@/lib/http";

export function GET() {
  return json({
    service: "nivara-store",
    status: "ok",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    paymentsConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  });
}
