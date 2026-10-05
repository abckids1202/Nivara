import { consumeRateLimit } from '@/lib/access-rate';
import { passwordUpdateSchema } from '@/lib/schemas';
import {
  isSupabaseUserVerified,
  supabaseUpdatePassword,
} from '@/lib/supabase-auth';
import { authResponse } from '@/lib/auth-response';
import { logServerError } from '@/lib/safe-logging';

export async function POST(request: Request): Promise<Response> {
  try {
    if (
      !(await consumeRateLimit({
        request,
        endpoint: 'auth.update-password',
        maxAttempts: 5,
      }))
    )
      return authResponse({ error: 'Too many password-update attempts' }, 429);
  } catch (error) {
    logServerError('auth_update_password_rate_limit_failed', error);
    return authResponse(
      { error: 'Password update is temporarily unavailable' },
      503,
    );
  }

  const parsed = passwordUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return authResponse({ error: 'Password reset details are invalid' }, 400);

  const result = await supabaseUpdatePassword(parsed.data);
  if (!result)
    return authResponse({ error: 'Supabase Auth is not configured' }, 503);
  if (!result.ok || !result.data.user?.id)
    return authResponse({ error: 'Password could not be updated' }, 401);
  if (!isSupabaseUserVerified(result.data.user))
    return authResponse(
      { error: 'Please verify your email before signing in' },
      403,
    );

  const response = authResponse({
    data: { userId: result.data.user.id },
  });
  response.cookies.set('nivara-access-token', parsed.data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  if (parsed.data.refreshToken)
    response.cookies.set('nivara-refresh-token', parsed.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  return response;
}
