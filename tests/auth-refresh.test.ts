import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, supabaseAuthRequest } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  supabaseAuthRequest: vi.fn(),
}));

vi.mock('../lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('../lib/supabase-auth', () => ({ supabaseAuthRequest }));

import { POST } from '../app/api/auth/refresh/route';

afterEach(() => {
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
});
