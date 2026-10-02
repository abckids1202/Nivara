import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, supabaseAuthRequest } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  supabaseAuthRequest: vi.fn(),
}));

vi.mock('../lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('../lib/supabase-auth', () => ({ supabaseAuthRequest }));

import { POST } from '../app/api/auth/refresh/route';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Reflect.set(process.env, 'NODE_ENV', originalNodeEnv);
  consumeRateLimit.mockReset();
  supabaseAuthRequest.mockReset();
});

describe('session refresh endpoint', () => {
  it('rejects anonymous refresh requests before touching the rate limiter', async () => {
    const response = await POST(
      new Request('https://nivara.example/api/auth/refresh'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'No refresh session' });
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it('rate-limits requests that carry a refresh session', async () => {
    consumeRateLimit.mockResolvedValue(false);
    const response = await POST(
      new Request('https://nivara.example/api/auth/refresh', {
        headers: { cookie: 'nivara-refresh-token=refresh-token' },
      }),
    );

    expect(response.status).toBe(429);
    expect(supabaseAuthRequest).not.toHaveBeenCalled();
  });

  it('rotates secure session cookies after a successful refresh', async () => {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({
      ok: true,
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      },
    });

    const response = await POST(
      new Request('https://nivara.example/api/auth/refresh', {
        headers: { cookie: 'nivara-refresh-token=old-refresh-token' },
      }),
    );

    expect(response.status).toBe(200);
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('new-access-token');
    expect(cookies).toContain('new-refresh-token');
    expect(cookies).toContain('Secure');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=lax');
  });

  it('clears local cookies when the provider definitively rejects refresh', async () => {
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({ ok: false, data: {} });

    const response = await POST(
      new Request('https://nivara.example/api/auth/refresh', {
        headers: { cookie: 'nivara-refresh-token=expired-refresh-token' },
      }),
    );

    expect(response.status).toBe(401);
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('nivara-access-token=;');
    expect(cookies).toContain('nivara-refresh-token=;');
  });
});
