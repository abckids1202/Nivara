import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  badRequest,
  conflict,
  forbidden,
  noStore,
  notFound,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const { id } = await context.params;
  const parsed = categorySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Category details are invalid', parsed.error.flatten());
  try {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) return notFound('Category not found');
    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
    });
    await prisma.auditLog.create({
      data: {
        actorId: access.identity.id,
        action: 'category.updated',
        entityType: 'Category',
        entityId: id,
        details: { before: existing, after: parsed.data },
      },
    });
    return noStore({ data: category });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return conflict('That category slug is already in use');
    logServerError('category_update_failed', error);
    return unavailable('Category could not be updated');
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const { id } = await context.params;
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) return notFound('Category not found');
    if (category._count.products > 0)
      return conflict(
        'Move or archive the category products before deleting this category',
      );
    await prisma.category.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: access.identity.id,
        action: 'category.deleted',
        entityType: 'Category',
        entityId: id,
        details: { name: category.name, slug: category.slug },
      },
    });
    return noStore({ data: { id } });
  } catch (error) {
    logServerError('category_delete_failed', error);
    return unavailable('Category could not be deleted');
  }
}
