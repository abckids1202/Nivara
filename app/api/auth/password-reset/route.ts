import { NextResponse } from 'next/server';
import { passwordResetSchema } from '@/lib/schemas';
import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';

export async function POST(request: Request) {
  if (!(await consumeRateLimit({ request, endpoint: 'auth.password-reset' })))
    return NextResponse.json({ error: 'Too many password-reset attempts' }, { status: 429 });
  const parsed = passwordResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Enter a valid email address' },
      { status: 400 },
    );
  const result = await supabaseAuthRequest('recover', {
    ...parsed.data,
    redirect_to: `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}/account/reset-password`,
  });
  if (!result)
    return NextResponse.json(
      { error: 'Supabase Auth is not configured' },
      { status: 503 },
    );
  if (!result.ok)
    return NextResponse.json(
      {
        error:
          result.data.error_description ??
          result.data.msg ??
          'Password reset could not be requested',
      },
      { status: 400 },
    );
  return NextResponse.json({ data: { accepted: true } });
}
