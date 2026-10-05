import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  consumeRateLimit,
  supabaseAuthRequest,
  supabaseUpdatePassword,
  logServerError,
} = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  supabaseAuthRequest: vi.fn(),
  supabaseUpdatePassword: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/supabase-auth', () => ({
  supabaseAuthRequest,
  supabaseUpdatePassword,
  isSupabaseUserVerified: (user: { email_confirmed_at?: string | null }) =>
    Boolean(user?.email_confirmed_at),
}));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST as resetPassword } from '@/app/api/auth/password-reset/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as updatePassword } from '@/app/api/auth/update-password/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as signup } from '@/app/api/auth/signup/route';

afterEach(() => {
  consumeRateLimit.mockReset();
  supabaseAuthRequest.mockReset();
  supabaseUpdatePassword.mockReset();
  logServerError.mockReset();
});

describe('authentication rate-limit failure handling', () => {
  it('normalizes the password-reset redirect to the canonical site URL', async () => {
    const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in///?preview=1';
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({ ok: true, data: {} });

    try {
      const response = await resetPassword(
        new Request('https://preview.nivara.in/api/auth/password-reset', {
          method: 'POST',
          body: JSON.stringify({ email: 'shopper@example.com' }),
        }),
      );

      expect(response.status).toBe(200);
      expect(supabaseAuthRequest).toHaveBeenCalledWith('recover', {
        email: 'shopper@example.com',
        redirect_to: 'https://store.nivara.in/account/reset-password',
      });
    } finally {
      if (previousSiteUrl === undefined)
        delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
    }
  });

  it('returns a safe response for password-reset infrastructure failure', async () => {
    consumeRateLimit.mockRejectedValue(new Error('private rate log details'));

    const response = await resetPassword(
      new Request('https://nivara.example/api/auth/password-reset', {
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Password reset is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'auth_password_reset_rate_limit_failed',
      expect.any(Error),
    );
  });

  it('returns safe responses for login and signup infrastructure failures', async () => {
    consumeRateLimit.mockRejectedValue(new Error('private rate log details'));
    const requestBody = JSON.stringify({
      email: 'shopper@example.com',
      password: 'correct horse battery staple',
    });

    const loginResponse = await login(
      new Request('https://nivara.example/api/auth/login', {
        method: 'POST',
        body: requestBody,
      }),
    );
    const signupResponse = await signup(
      new Request('https://nivara.example/api/auth/signup', {
        method: 'POST',
        body: requestBody,
      }),
    );

    expect(loginResponse.status).toBe(503);
    expect(signupResponse.status).toBe(503);
    expect(await loginResponse.json()).toEqual({
      error: 'Login is temporarily unavailable',
    });
    expect(await signupResponse.json()).toEqual({
      error: 'Sign-up is temporarily unavailable',
    });
  });

  it('returns a safe response for refresh infrastructure failure', async () => {
    consumeRateLimit.mockRejectedValue(new Error('private rate log details'));

    const response = await refresh(
      new Request('https://nivara.example/api/auth/refresh', {
        headers: { cookie: 'nivara-refresh-token=refresh-token' },
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Session refresh is temporarily unavailable');
  });

  it('returns a safe response for password-update infrastructure failure', async () => {
    consumeRateLimit.mockRejectedValue(new Error('private rate log details'));

    const response = await updatePassword(
      new Request('https://nivara.example/api/auth/update-password', {
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Password update is temporarily unavailable');
  });
});
