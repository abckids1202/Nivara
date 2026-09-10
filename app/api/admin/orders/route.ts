import { badRequest, forbidden, json, unauthorized, unavailable } from "@/lib/http";
import { fulfilmentUpdateSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedIdentity, isAdministrator } from "@/lib/server-auth";

const fulfilmentRank = { PROCESSING: 0, SHIPPED: 1, DELIVERED: 2 } as const;

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity))) return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return unavailable("Order database is not configured");
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const orders = await prisma.order.findMany({
    where: query
      ? { OR: [{ orderNumber: { contains: query, mode: "insensitive" } }, { guestEmail: { contains: query, mode: "insensitive" } }, { user: { email: { contains: query, mode: "insensitive" } } }] }
      : undefined,
    include: { items: true, shipment: true, user: { select: { email: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return json({ data: orders });
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL) return unavailable("Order database is not configured");
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => null) as { orderId?: string } & Record<string, unknown> | null;
  const parsed = fulfilmentUpdateSchema.safeParse(body);
  if (!body?.orderId || !parsed.success) return badRequest("Order fulfilment update is invalid");

  const order = await prisma.order.findUnique({ where: { id: body.orderId }, select: { fulfilmentStatus: true } });
  if (!order) return json({ error: "Order not found" }, 404);
  if (fulfilmentRank[parsed.data.status] < fulfilmentRank[order.fulfilmentStatus]) {
    return badRequest("Fulfilment status cannot move backwards");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: body.orderId },
      data: {
        fulfilmentStatus: parsed.data.status,
        shipment: {
          upsert: {
            create: { courierName: parsed.data.courierName, trackingReference: parsed.data.trackingReference },
            update: { courierName: parsed.data.courierName, trackingReference: parsed.data.trackingReference },
          },
        },
      },
      include: { shipment: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: access.identity.id,
        action: "order.fulfilment_updated",
        entityType: "Order",
        entityId: result.id,
        details: { status: parsed.data.status, courierName: parsed.data.courierName, trackingReference: parsed.data.trackingReference },
      },
    });
    return result;
  });
  return json({ data: updated });
}
