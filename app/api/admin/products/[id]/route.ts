import { Prisma } from '@prisma/client';
import {
  badRequest,
  conflict,
  forbidden,
  noStore,
  unauthorized,
  unavailable,
} from '@/lib/http';
import { productMutationSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, isAdministrator } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const { id } = await params;
  const parsed = productMutationSchema
    .partial()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return badRequest('Product details are invalid', parsed.error.flatten());

  try {
    if (parsed.data.status === 'PUBLISHED') {
      const product = await prisma.product.findUnique({
        where: { id },
        select: { id: true, _count: { select: { variants: true } } },
      });
      if (!product) return noStore({ error: 'Product not found' }, 404);
      if (product._count.variants === 0)
        return conflict('Add at least one variant before publishing this product');
    }
    const product = await prisma.$transaction(async (transaction) => {
      const updatedProduct = await transaction.product.update({
        where: { id },
        data: parsed.data,
      });
      await transaction.auditLog.create({
        data: {
          actorId: identity.id,
          action: 'product.updated',
          entityType: 'Product',
          entityId: updatedProduct.id,
          details: parsed.data,
        },
      });
      return updatedProduct;
    });
    return noStore({ data: product });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      return conflict('That product slug is already in use');
    logServerError('product_update_failed', error);
    return unavailable('Product could not be updated');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const { id } = await params;
  try {
    const product = await prisma.$transaction(async (transaction) => {
      const archivedProduct = await transaction.product.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      await transaction.auditLog.create({
        data: {
          actorId: identity.id,
          action: 'product.archived',
          entityType: 'Product',
          entityId: archivedProduct.id,
        },
      });
      return archivedProduct;
    });
    return noStore({ data: product });
  } catch (error) {
    logServerError('product_archive_failed', error);
    return unavailable('Product could not be archived');
  }
}
