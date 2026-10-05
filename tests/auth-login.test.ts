import { afterEach, describe, expect, it, vi } from 'vitest';

const { supabaseAuthRequest, consumeRateLimit, ensureUserProfile } = vi.hoisted(() => ({
  supabaseAuthRequest: vi.fn(),
  consumeRateLimit: vi.fn(),
  ensureUserProfile: vi.fn(),
}));

vi.mock('@/lib/supabase-auth', () => ({ supabaseAuthRequest }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/server-auth', () => ({ ensureUserProfile }));

import { POST } from '@/app/api/auth/login/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  supabaseAuthRequest.mockReset();
  consumeRateLimit.mockReset();
  ensureUserProfile.mockReset();
});

describe('login session cookies', () => {
  it('sets secure, HTTP-only, bounded session cookies in production', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({
      ok: true,
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: { id: 'user-1', email: 'shopper@nivara.in' },
      },
    });
    ensureUserProfile.mockResolvedValue({ id: 'user-1' });

    const response = await POST(
      new Request('https://nivara.example/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'shopper@nivara.in',
          password: 'correct horse battery staple',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(200);
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('nivara-access-token=access-token');
    expect(cookies).toContain('nivara-refresh-token=refresh-token');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('Secure');
    expect(cookies).toContain('SameSite=lax');
    expect(cookies).toContain('Path=/');
  });

  it('does not issue a session for an explicitly unverified email', async () => {
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({
      ok: true,
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'shopper@nivara.in',
          email_confirmed_at: null,
        },
      },
    });

    const response = await POST(
      new Request('https://nivara.example/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'shopper@nivara.in',
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
    expect(ensureUserProfile).not.toHaveBeenCalled();
  });
});
