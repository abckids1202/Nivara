import { afterEach, describe, expect, it, vi } from 'vitest';

const { getAccessToken, supabaseLogout } = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  supabaseLogout: vi.fn(),
}));

vi.mock('../lib/server-auth', () => ({ getAccessToken }));
vi.mock('../lib/supabase-auth', () => ({ supabaseLogout }));

import { POST } from '../app/api/auth/logout/route';

afterEach(() => {
  getAccessToken.mockReset();
  supabaseLogout.mockReset();
});

describe('logout endpoint', () => {
  it('revokes the provider session before clearing local cookies', async () => {
    getAccessToken.mockReturnValue('access-token');
    supabaseLogout.mockResolvedValue(true);

    const response = await POST(
      new Request('https://nivara.example/api/auth/logout'),
    );

    expect(response.status).toBe(200);
    expect(supabaseLogout).toHaveBeenCalledWith('access-token');
    expect(response.headers.get('set-cookie')).toContain(
      'nivara-access-token=;',
    );
    expect(response.headers.get('set-cookie')).toContain(
      'nivara-refresh-token=;',
    );
  });

  it('still clears local state when no provider session is present', async () => {
    getAccessToken.mockReturnValue(null);

    const response = await POST(
      new Request('https://nivara.example/api/auth/logout'),
    );

    expect(response.status).toBe(200);
    expect(supabaseLogout).not.toHaveBeenCalled();
  });
});
