import { Prisma } from '@prisma/client';
import {
  forbidden,
  noStore,
  unauthorized,
  unavailable,
  badRequest,
} from '@/lib/http';
import { inventoryAdjustmentSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Inventory database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();

  const parsed = inventoryAdjustmentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest(
      'Inventory adjustment is invalid',
      parsed.error.flatten(),
    );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ stockOnHand: number; stockReserved: number }>
      >(Prisma.sql`
        SELECT "stockOnHand", "stockReserved"
        FROM "ProductVariant"
        WHERE "id" = ${parsed.data.variantId}
        FOR UPDATE
      `);
      const current = rows[0];
      if (!current) throw new Error('VARIANT_NOT_FOUND');

      const afterQuantity = current.stockOnHand + parsed.data.quantityDelta;
      if (afterQuantity < current.stockReserved || afterQuantity < 0) {
        throw new Error('STOCK_BELOW_RESERVED');
      }

      const variant = await tx.productVariant.update({
        where: { id: parsed.data.variantId },
        data: { stockOnHand: afterQuantity },
        select: { id: true, sku: true, stockOnHand: true, stockReserved: true },
      });
      await tx.inventoryAdjustment.create({
        data: {
          variantId: variant.id,
          adminUserId: identity.id,
          quantityDelta: parsed.data.quantityDelta,
          beforeQuantity: current.stockOnHand,
          afterQuantity,
          reason: parsed.data.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: identity.id,
          action: 'inventory.adjusted',
          entityType: 'ProductVariant',
          entityId: variant.id,
          details: {
            quantityDelta: parsed.data.quantityDelta,
            reason: parsed.data.reason,
          },
        },
      });
      return variant;
    });
    return noStore({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'VARIANT_NOT_FOUND')
      return noStore({ error: 'Variant not found' }, 404);
    if (error instanceof Error && error.message === 'STOCK_BELOW_RESERVED')
      return badRequest('Stock cannot be reduced below reserved quantity');
    logServerError('inventory_adjustment_failed', error);
    return unavailable('Inventory update is temporarily unavailable');
  }
}
