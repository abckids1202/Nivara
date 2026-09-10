import { z } from "zod";
import { badRequest, forbidden, json, unauthorized, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedIdentity, isAdministrator } from "@/lib/server-auth";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity))) return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET() {
  if (!process.env.DATABASE_URL) return unavailable("Catalogue database is not configured");
  return json({ data: await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } }) });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return unavailable("Catalogue database is not configured");
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Category details are invalid", parsed.error.flatten());
  const category = await prisma.category.create({ data: parsed.data });
  await prisma.auditLog.create({ data: { actorId: access.identity.id, action: "category.created", entityType: "Category", entityId: category.id, details: parsed.data } });
  return json({ data: category }, 201);
}
