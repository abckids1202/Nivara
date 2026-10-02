import { badRequest, noStore, unauthorized, unavailable } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedIdentity, ensureUserProfile } from '@/lib/server-auth';
import { z } from 'zod';
import { logServerError } from '@/lib/safe-logging';

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Profile database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  try {
    return noStore({ data: await ensureUserProfile(identity) });
  } catch (error) {
    logServerError('profile_read_failed', error);
    return unavailable('Profile is temporarily unavailable');
  }
}

export async function PATCH(request: Request) {
  if (!process.env.DATABASE_URL)
    return unavailable('Profile database is not configured');
  const identity = await getAuthenticatedIdentity(request);
  if (!identity) return unauthorized();
  const parsed = profileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return badRequest('Profile details are invalid', parsed.error.flatten());
  try {
    await ensureUserProfile(identity);
    const user = await prisma.user.update({
      where: { id: identity.id },
      data: parsed.data,
      select: { id: true, email: true, displayName: true },
    });
    return noStore({ data: user });
  } catch (error) {
    logServerError('profile_update_failed', error);
    return unavailable('Profile is temporarily unavailable');
  }
}
