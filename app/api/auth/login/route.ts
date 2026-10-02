import { authCredentialsSchema } from '@/lib/schemas';
import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/access-rate';
import { authResponse } from '@/lib/auth-response';

export async function POST(request: Request) {
  if (!(await consumeRateLimit({ request, endpoint: 'auth.login' })))
    return authResponse({ error: 'Too many login attempts' }, 429);
  const parsed = authCredentialsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return authResponse({ error: 'Email or password is invalid' }, 400);
  const result = await supabaseAuthRequest(
    'token?grant_type=password',
    parsed.data,
  );
  if (!result)
    return authResponse({ error: 'Supabase Auth is not configured' }, 503);
  if (!result.ok || !result.data.access_token)
    return authResponse({ error: 'Email or password is incorrect' }, 401);
  if (result.data.user?.id)
    await prisma.user.upsert({
      where: { id: result.data.user.id },
      create: {
        id: result.data.user.id,
        email: result.data.user.email ?? parsed.data.email,
      },
      update: { email: result.data.user.email ?? parsed.data.email },
    });
  const response = authResponse({
    data: { userId: result.data.user?.id },
  });
  response.cookies.set('nivara-access-token', result.data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  if (result.data.refresh_token)
    response.cookies.set('nivara-refresh-token', result.data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  return response;
}
