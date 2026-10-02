import { authCredentialsSchema } from '@/lib/schemas';
import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';
import { authResponse } from '@/lib/auth-response';
import { ensureUserProfile } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await consumeRateLimit({ request, endpoint: 'auth.signup' })))
      return authResponse({ error: 'Too many sign-up attempts' }, 429);
  } catch (error) {
    logServerError('auth_signup_rate_limit_failed', error);
    return authResponse({ error: 'Sign-up is temporarily unavailable' }, 503);
  }
  const parsed = authCredentialsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return authResponse({ error: 'Email or password is invalid' }, 400);
  const result = await supabaseAuthRequest('signup', parsed.data);
  if (!result)
    return authResponse({ error: 'Supabase Auth is not configured' }, 503);
  if (!result.ok || !result.data.user?.id)
    return authResponse({ error: 'Sign-up could not be completed' }, 400);

  try {
    await ensureUserProfile({
      id: result.data.user.id,
      email: result.data.user.email ?? parsed.data.email,
    });
  } catch (error) {
    logServerError('auth_signup_profile_sync_failed', error);
    return authResponse(
      { error: 'Account service is temporarily unavailable' },
      503,
    );
  }
  const response = authResponse(
    {
      data: {
        userId: result.data.user.id,
        needsVerification: !result.data.access_token,
      },
    },
    201,
  );
  if (result.data.access_token) {
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
  }
  return response;
}
