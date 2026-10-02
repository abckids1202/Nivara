import { addressSchema } from '@/lib/schemas';
import { getAuthenticatedIdentity, ensureUserProfile } from '@/lib/server-auth';
import { badRequest, noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { logServerError } from '@/lib/safe-logging';

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Address database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: identity.id },
      orderBy: { createdAt: 'desc' },
    });
    return noStore({ data: addresses });
  } catch (error) {
    logServerError('address_read_failed', error);
    return unavailable('Addresses are temporarily unavailable');
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Address database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const parsed = addressSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Address details are invalid', parsed.error.flatten());
  try {
    await ensureUserProfile(identity);
    const address = await prisma.address.create({
      data: { ...parsed.data, userId: identity.id },
    });
    return noStore({ data: address }, 201);
  } catch (error) {
    logServerError('address_create_failed', error);
    return unavailable('Addresses are temporarily unavailable');
  }
}

export async function DELETE(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Address database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const addressId = new URL(request.url).searchParams.get('id');
  if (!addressId) return badRequest('Address id is required');
  try {
    await prisma.address.deleteMany({
      where: { id: addressId, userId: identity.id },
    });
    return noStore({ deleted: true });
  } catch (error) {
    logServerError('address_delete_failed', error);
    return unavailable('Addresses are temporarily unavailable');
  }
}
