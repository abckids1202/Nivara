import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  badRequest,
  conflict,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { isValidComparisonPrice } from '@/lib/catalogue-pricing';
import { logServerError } from '@/lib/safe-logging';

const variantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  priceRupees: z.number().int().positive().max(10_000_000).optional(),
  compareAtRupees: z
    .number()
    .int()
    .positive()
    .max(10_000_000)
    .nullable()
    .optional(),
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
  context: { params: Promise<{ id: string; variantId: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Catalogue database is not configured');
  const access = await requireAdmin(request);
  if ('response' in access && access.response) return access.response;
  try {
    const { id, variantId } = await context.params;
    const parsed = variantUpdateSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return badRequest('Variant update is invalid', parsed.error.flatten());
    const existing = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
    });
    if (!existing) return noStore({ error: 'Variant not found' }, 404);
    const pricePaise =
      parsed.data.priceRupees === undefined
        ? existing.pricePaise
        : parsed.data.priceRupees * 100;
    const compareAtPaise =
      parsed.data.compareAtRupees === undefined
        ? existing.compareAtPaise
        : parsed.data.compareAtRupees === null
          ? null
          : parsed.data.compareAtRupees * 100;
    if (!isValidComparisonPrice(pricePaise, compareAtPaise))
      return badRequest('Comparison price must be at least the selling price');
    const variant = await prisma.$transaction(async (transaction) => {
      const updatedVariant = await transaction.productVariant.update({
        where: { id: variantId },
        data: {
          ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
          ...(parsed.data.sku === undefined ? {} : { sku: parsed.data.sku }),
          ...(parsed.data.priceRupees === undefined ? {} : { pricePaise }),
          ...(parsed.data.compareAtRupees === undefined
            ? {}
            : {
                compareAtPaise:
                  parsed.data.compareAtRupees === null ? null : compareAtPaise,
              }),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: access.identity.id,
          action: 'variant.updated',
          entityType: 'ProductVariant',
          entityId: updatedVariant.id,
          details: parsed.data,
        },
      });
      return updatedVariant;
    });
    return noStore({ data: variant });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return conflict('That SKU is already in use');
    logServerError('admin_variant_update_failed', error);
    return unavailable('Variant update is temporarily unavailable');
  }
}
