import { authCredentialsSchema } from '@/lib/schemas';
import {
  isSupabaseUserVerified,
  supabaseAuthRequest,
} from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';
import { authResponse } from '@/lib/auth-response';
import { ensureUserProfile } from '@/lib/server-auth';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request): Promise<Response> {
  try {
    if (!(await consumeRateLimit({ request, endpoint: 'auth.login' })))
      return authResponse({ error: 'Too many login attempts' }, 429);
  } catch (error) {
    logServerError('auth_login_rate_limit_failed', error);
    return authResponse({ error: 'Login is temporarily unavailable' }, 503);
  }
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
  if (!result.data.user?.id)
    return authResponse({ error: 'Email or password is incorrect' }, 401);
  if (!isSupabaseUserVerified(result.data.user))
    return authResponse(
      { error: 'Please verify your email before signing in' },
      403,
    );
  try {
    await ensureUserProfile({
      id: result.data.user.id,
      email: result.data.user.email ?? parsed.data.email,
    });
  } catch (error) {
    logServerError('auth_login_profile_sync_failed', error);
    return authResponse(
      { error: 'Account service is temporarily unavailable' },
      503,
    );
  }
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
