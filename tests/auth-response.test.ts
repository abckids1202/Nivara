import { describe, expect, it } from 'vitest';
import { authResponse } from '@/lib/auth-response';

describe('authentication responses', () => {
  it('disable caching for auth payloads', async () => {
    const response = authResponse({ error: 'generic' }, 401);

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'generic' });
  });
});
