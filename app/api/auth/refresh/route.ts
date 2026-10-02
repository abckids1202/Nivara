import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';
import { authResponse } from '@/lib/auth-response';

function readRefreshToken(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .find((part) => part.trim().startsWith('nivara-refresh-token='));
  return value?.slice(value.indexOf('=') + 1).trim() ?? '';
}

export async function POST(request: Request) {
  const refreshToken = readRefreshToken(request);
  if (!refreshToken)
    return authResponse({ error: 'No refresh session' }, 401);

  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'auth.refresh',
      maxAttempts: 30,
    }))
  )
    return authResponse({ error: 'Too many refresh attempts' }, 429);
  const result = await supabaseAuthRequest('token?grant_type=refresh_token', {
    refresh_token: refreshToken,
  });
  if (!result || !result.ok || !result.data.access_token)
    return authResponse({ error: 'Session could not be refreshed' }, 401);
  const response = authResponse({ data: { refreshed: true } });
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
