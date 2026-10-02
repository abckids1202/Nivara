import { afterEach, describe, expect, it, vi } from 'vitest';

const { ensureUserProfile, getIdentity, updateUser, logServerError } =
  vi.hoisted(() => ({
    ensureUserProfile: vi.fn(),
    getIdentity: vi.fn(),
    updateUser: vi.fn(),
    logServerError: vi.fn(),
  }));

vi.mock('@/lib/server-auth', () => ({
  ensureUserProfile,
  getAuthenticatedIdentity: getIdentity,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { update: updateUser } } }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET, PATCH } from '@/app/api/account/profile/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  ensureUserProfile.mockReset();
  getIdentity.mockReset();
  updateUser.mockReset();
  logServerError.mockReset();
});

describe('profile route resilience', () => {
  it('returns a safe response when profile reads fail', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    ensureUserProfile.mockRejectedValue(new Error('private profile details'));

    const response = await GET(
      new Request('https://nivara.example/api/account/profile'),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Profile is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'profile_read_failed',
      expect.any(Error),
    );
  });

  it('returns a safe response when profile updates fail', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    getIdentity.mockResolvedValue({
      id: 'user-1',
      email: 'shopper@example.com',
    });
    ensureUserProfile.mockResolvedValue({ id: 'user-1' });
    updateUser.mockRejectedValue(new Error('private update details'));

    const response = await PATCH(
      new Request('https://nivara.example/api/account/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Test Shopper' }),
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Profile is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'profile_update_failed',
      expect.any(Error),
    );
  });
});
