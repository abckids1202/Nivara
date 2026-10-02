import { z } from 'zod';
import {
  badRequest,
  forbidden,
  noStore,
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

export async function GET(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  try {
    return noStore({
      data: await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
    });
  } catch (error) {
    logServerError('admin_categories_read_failed', error);
    return unavailable('Categories are temporarily unavailable');
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  const parsed = categorySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Category details are invalid', parsed.error.flatten());
  try {
    const category = await prisma.$transaction(async (transaction) => {
      const createdCategory = await transaction.category.create({
        data: parsed.data,
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.identity.id,
          action: 'category.created',
          entityType: 'Category',
          entityId: createdCategory.id,
          details: parsed.data,
        },
      });
      return createdCategory;
    });
    return noStore({ data: category }, 201);
  } catch (error) {
    logServerError('category_create_failed', error);
    return unavailable('Category could not be created');
  }
}
