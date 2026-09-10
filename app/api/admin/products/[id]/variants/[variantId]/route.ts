import { z } from "zod";
import { badRequest, forbidden, json, unauthorized, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedIdentity, isAdministrator } from "@/lib/server-auth";

const variantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  priceRupees: z.number().nonnegative().optional(),
  compareAtRupees: z.number().nonnegative().nullable().optional(),
});

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity))) return { response: forbidden() } as const;
  return { identity } as const;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; variantId: string }> }) {
  if (!process.env.DATABASE_URL) return unavailable("Catalogue database is not configured");
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { id, variantId } = await context.params;
  const parsed = variantUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Variant update is invalid", parsed.error.flatten());
  const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId: id } });
  if (!existing) return json({ error: "Variant not found" }, 404);
  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.sku === undefined ? {} : { sku: parsed.data.sku }),
      ...(parsed.data.priceRupees === undefined ? {} : { pricePaise: Math.round(parsed.data.priceRupees * 100) }),
      ...(parsed.data.compareAtRupees === undefined ? {} : { compareAtPaise: parsed.data.compareAtRupees === null ? null : Math.round(parsed.data.compareAtRupees * 100) }),
    },
  });
  await prisma.auditLog.create({ data: { actorId: access.identity.id, action: "variant.updated", entityType: "ProductVariant", entityId: variant.id, details: parsed.data } });
  return json({ data: variant });
}
