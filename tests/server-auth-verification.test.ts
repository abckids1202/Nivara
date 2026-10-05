import { afterEach, describe, expect, it, vi } from 'vitest';

const { providerFetch } = vi.hoisted(() => ({ providerFetch: vi.fn() }));

vi.mock('@/lib/provider-fetch', () => ({ providerFetch }));

import { getAuthenticatedIdentity } from '@/lib/server-auth';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  providerFetch.mockReset();
});

describe('server authentication email verification', () => {
  it('fails closed when Supabase omits verification metadata', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://nivara.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    providerFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1', email: 'shopper@nivara.in' }), {
        status: 200,
      }),
    );

    const identity = await getAuthenticatedIdentity(
      new Request('https://nivara.example/account', {
        headers: { authorization: 'Bearer access-token' },
      }),
    );

    expect(identity).toBeNull();
  });

  it('accepts a confirmed Supabase identity', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://nivara.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    providerFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'shopper@nivara.in',
          email_confirmed_at: '2026-10-05T00:00:00.000Z',
        }),
        { status: 200 },
      ),
    );

    await expect(
      getAuthenticatedIdentity(
        new Request('https://nivara.example/account', {
          headers: { authorization: 'Bearer access-token' },
        }),
      ),
    ).resolves.toEqual({ id: 'user-1', email: 'shopper@nivara.in' });
  });
});
