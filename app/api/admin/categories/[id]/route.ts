import { z } from 'zod';
import { badRequest, conflict, forbidden, json, notFound, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await context.params;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest('Category details are invalid', parsed.error.flatten());
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return notFound('Category not found');
  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data });
    await prisma.auditLog.create({
      data: { actorId: access.identity.id, action: 'category.updated', entityType: 'Category', entityId: id, details: { before: existing, after: parsed.data } },
    });
    return json({ data: category });
  } catch {
    return conflict('That category slug is already in use');
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await context.params;
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) return notFound('Category not found');
  if (category._count.products > 0) return conflict('Move or archive the category products before deleting this category');
  await prisma.category.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: access.identity.id, action: 'category.deleted', entityType: 'Category', entityId: id, details: { name: category.name, slug: category.slug } },
  });
  return json({ data: { id } });
}
