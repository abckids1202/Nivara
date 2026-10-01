import { NextResponse } from 'next/server';
import { consumeRateLimit } from '@/lib/access-rate';
import { passwordUpdateSchema } from '@/lib/schemas';
import { supabaseUpdatePassword } from '@/lib/supabase-auth';

export async function POST(request: Request) {
  if (
    !(await consumeRateLimit({
      request,
      endpoint: 'auth.update-password',
      maxAttempts: 5,
    }))
  )
    return NextResponse.json(
      { error: 'Too many password-update attempts' },
      { status: 429 },
    );

  const parsed = passwordUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Password reset details are invalid' },
      { status: 400 },
    );

  const result = await supabaseUpdatePassword(parsed.data);
  if (!result)
    return NextResponse.json(
      { error: 'Supabase Auth is not configured' },
      { status: 503 },
    );
  if (!result.ok || !result.data.user?.id)
    return NextResponse.json(
      {
        error:
          result.data.error_description ??
          result.data.msg ??
          'Password could not be updated',
      },
      { status: 401 },
    );

  const response = NextResponse.json({
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
