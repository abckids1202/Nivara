import { describe, expect, it } from 'vitest';
import { readCookie } from '../lib/cart';
import { getAccessToken, getAuthenticatedIdentity } from '../lib/server-auth';

describe('cookie parsing', () => {
  it('fails closed for malformed guest cart cookies', () => {
    const request = new Request('http://localhost/api/cart', {
      headers: { cookie: 'nivara-cart-key=%E0%A4%A' },
    });

    expect(readCookie(request, 'nivara-cart-key')).toBeNull();
  });

  it('does not throw for malformed chunked auth cookies', async () => {
    const request = new Request('http://localhost/api/account/profile', {
      headers: { cookie: 'sb-demo-auth-token=%E0%A4%A' },
    });

    await expect(getAuthenticatedIdentity(request)).resolves.toBeNull();
  });

  it('reassembles auth cookie chunks in numeric order', () => {
    const serialized = JSON.stringify({ access_token: 'access-token' });
    const chunkSize = Math.ceil(serialized.length / 11);
    const cookies = Array.from({ length: 11 }, (_, index) => {
      const start = index * chunkSize;
      return `sb-demo-auth-token.${index}=${serialized.slice(start, start + chunkSize)}`;
    }).join('; ');
    const request = new Request('http://localhost/api/account/profile', {
      headers: { cookie: cookies },
    });

    expect(getAccessToken(request)).toBe('access-token');
  });

  it('decodes a direct access-token cookie', () => {
    const request = new Request('http://localhost/api/account/profile', {
      headers: { cookie: 'nivara-access-token=%22access%2Btoken%22' },
    });

    expect(getAccessToken(request)).toBe('access+token');
  });
});
