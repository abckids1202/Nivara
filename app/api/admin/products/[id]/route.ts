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
    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
    });
    await prisma.auditLog.create({
      data: {
        actorId: identity.id,
        action: 'product.updated',
        entityType: 'Product',
        entityId: product.id,
        details: parsed.data,
      },
    });
    return noStore({ data: product });
  } catch (error) {
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
    const product = await prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await prisma.auditLog.create({
      data: {
        actorId: identity.id,
        action: 'product.archived',
        entityType: 'Product',
        entityId: product.id,
      },
    });
    return noStore({ data: product });
  } catch (error) {
    logServerError('product_archive_failed', error);
    return unavailable('Product could not be archived');
  }
}
