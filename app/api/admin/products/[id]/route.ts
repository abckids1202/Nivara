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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL)
    return unavailable('Product database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  if (!(await isAdministrator(identity))) return forbidden();
  const { id } = await params;
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
}
