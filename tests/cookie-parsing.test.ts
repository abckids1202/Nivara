import { describe, expect, it } from 'vitest';
import { readCookie } from '../lib/cart';
import { getAuthenticatedIdentity } from '../lib/server-auth';

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
});
