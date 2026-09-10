import { json, unauthorized, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedIdentity } from "@/lib/server-auth";

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return unavailable("Order database is not configured");
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const orders = await prisma.order.findMany({
    where: { userId: identity.id },
    include: { items: true, shipment: true },
    orderBy: { createdAt: "desc" },
  });
  return json({ data: orders });
}
