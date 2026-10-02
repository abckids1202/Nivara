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

const variantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(80),
  priceRupees: z.number().nonnegative(),
  compareAtRupees: z.number().nonnegative().optional(),
  stockOnHand: z.number().int().nonnegative(),
});

async function requireAdmin(request: Request) {
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return { response: unauthorized() } as const;
  if (!(await isAdministrator(identity)))
    return { response: forbidden() } as const;
  return { identity } as const;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await context.params;
  return noStore({
    data: await prisma.productVariant.findMany({
      where: { productId: id },
      orderBy: { name: 'asc' },
    }),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access) return access.response;
  const { id } = await context.params;
  const parsed = variantSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Variant details are invalid', parsed.error.flatten());
  const variant = await prisma.productVariant.create({
    data: {
      productId: id,
      name: parsed.data.name,
      sku: parsed.data.sku,
      pricePaise: Math.round(parsed.data.priceRupees * 100),
      compareAtPaise:
        parsed.data.compareAtRupees === undefined
          ? null
          : Math.round(parsed.data.compareAtRupees * 100),
      stockOnHand: parsed.data.stockOnHand,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: access.identity.id,
      action: 'variant.created',
      entityType: 'ProductVariant',
      entityId: variant.id,
      details: parsed.data,
    },
  });
  return noStore({ data: variant }, 201);
}
