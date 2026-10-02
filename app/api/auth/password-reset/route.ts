import { passwordResetSchema } from '@/lib/schemas';
import { supabaseAuthRequest } from '@/lib/supabase-auth';
import { consumeRateLimit } from '@/lib/access-rate';
import { authResponse } from '@/lib/auth-response';

export async function POST(request: Request) {
  if (!(await consumeRateLimit({ request, endpoint: 'auth.password-reset' })))
    return authResponse({ error: 'Too many password-reset attempts' }, 429);
  const parsed = passwordResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return authResponse({ error: 'Enter a valid email address' }, 400);
  const result = await supabaseAuthRequest('recover', {
    ...parsed.data,
    redirect_to: `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}/account/reset-password`,
  });
  if (!result)
    return authResponse({ error: 'Supabase Auth is not configured' }, 503);
  if (!result.ok)
    return authResponse(
      { data: { accepted: true } },
      200,
    );
  return authResponse({ data: { accepted: true } });
}
