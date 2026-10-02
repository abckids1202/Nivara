import {
  badRequest,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { productMutationSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: { orderBy: { sku: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return noStore({ data: products });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const parsed = productMutationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Product details are invalid', parsed.error.flatten());

  try {
    const product = await prisma.product.create({ data: parsed.data });
    await prisma.auditLog.create({
      data: {
        actorId: access.identity.id,
        action: 'product.created',
        entityType: 'Product',
        entityId: product.id,
      },
    });
    return noStore({ data: product }, 201);
  } catch (error) {
    logServerError('product_create_failed', error);
    return unavailable('Product could not be created');
  }
}
