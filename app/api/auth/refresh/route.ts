import { NextResponse } from 'next/server';
import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';

function readRefreshToken(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .find((part) => part.trim().startsWith('nivara-refresh-token='));
  return value?.slice(value.indexOf('=') + 1).trim() ?? '';
}

export async function POST(request: Request) {
  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'auth.refresh',
      maxAttempts: 30,
    }))
  )
    return NextResponse.json(
      { error: 'Too many refresh attempts' },
      { status: 429 },
    );
  const refreshToken = readRefreshToken(request);
  if (!refreshToken)
    return NextResponse.json({ error: 'No refresh session' }, { status: 401 });
  const result = await supabaseAuthRequest('token?grant_type=refresh_token', {
    refresh_token: refreshToken,
  });
  if (!result || !result.ok || !result.data.access_token)
    return NextResponse.json(
      { error: 'Session could not be refreshed' },
      { status: 401 },
    );
  const response = NextResponse.json({ data: { refreshed: true } });
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
