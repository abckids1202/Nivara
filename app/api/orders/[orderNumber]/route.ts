import { json, unauthorized, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedIdentity } from "@/lib/server-auth";

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  if (!process.env.DATABASE_URL) return unavailable("Order database is not configured");
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const { orderNumber } = await params;
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: identity.id },
    include: { items: true, shipment: true },
  });
  if (!order) return json({ error: "Order not found" }, 404);
  return json({ data: order });
}
