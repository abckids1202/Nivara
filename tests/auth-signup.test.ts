import { afterEach, describe, expect, it, vi } from 'vitest';

const { supabaseAuthRequest, consumeRateLimit, ensureUserProfile } = vi.hoisted(() => ({
  supabaseAuthRequest: vi.fn(),
  consumeRateLimit: vi.fn(),
  ensureUserProfile: vi.fn(),
}));

vi.mock('@/lib/supabase-auth', () => ({ supabaseAuthRequest }));
vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/server-auth', () => ({ ensureUserProfile }));

import { POST } from '@/app/api/auth/signup/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  supabaseAuthRequest.mockReset();
  consumeRateLimit.mockReset();
  ensureUserProfile.mockReset();
});

const request = () =>
  new Request('https://nivara.example/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'shopper@nivara.in',
      password: 'correct horse battery staple',
    }),
    headers: { 'content-type': 'application/json' },
  });

describe('signup session boundary', () => {
  it('does not issue cookies before email verification', async () => {
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1', email: 'shopper@nivara.in' } },
    });
    ensureUserProfile.mockResolvedValue({ id: 'user-1' });

    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: { userId: 'user-1', needsVerification: true },
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not issue cookies when profile synchronization fails', async () => {
    consumeRateLimit.mockResolvedValue(true);
    supabaseAuthRequest.mockResolvedValue({
      ok: true,
      data: {
        access_token: 'access-token',
        user: { id: 'user-1', email: 'shopper@nivara.in' },
      },
    });
    ensureUserProfile.mockRejectedValue(new Error('database unavailable'));

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
