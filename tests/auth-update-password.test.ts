import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, supabaseUpdatePassword } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  supabaseUpdatePassword: vi.fn(),
}));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/supabase-auth', () => ({
  supabaseUpdatePassword,
  isSupabaseUserVerified: (user: { email_confirmed_at?: string | null }) =>
    Boolean(user?.email_confirmed_at),
}));

import { POST } from '@/app/api/auth/update-password/route';

afterEach(() => {
  consumeRateLimit.mockReset();
  supabaseUpdatePassword.mockReset();
});

describe('password update session issuance', () => {
  it('does not issue cookies for an explicitly unverified identity', async () => {
    consumeRateLimit.mockResolvedValue(true);
    supabaseUpdatePassword.mockResolvedValue({
      ok: true,
      data: {
        user: { id: 'user-1', email_confirmed_at: null },
      },
    });

    const response = await POST(
      new Request('https://nivara.example/api/auth/update-password', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: 'a'.repeat(24),
          refreshToken: 'r'.repeat(24),
          password: 'correct horse battery staple',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Please verify your email before signing in',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
