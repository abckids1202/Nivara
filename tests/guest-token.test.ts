import { expect, it } from 'vitest';
import {
  createGuestOrderToken,
  hashGuestOrderToken,
} from '../lib/guest-token.ts';
import { requestFingerprint } from '../lib/request-fingerprint.ts';

it('guest tokens are random and only their hash is persisted', () => {
  const token = createGuestOrderToken();
  expect(token.rawToken.length).toBeGreaterThanOrEqual(40);
  expect(token.rawToken).not.toBe(token.tokenHash);
  expect(hashGuestOrderToken(token.rawToken)).toBe(token.tokenHash);
});

it('hashes guest access request metadata before persistence', () => {
  const request = new Request('https://nivara.example/guest-order/token', {
    headers: {
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'Practice Browser',
    },
  });
  const fingerprint = requestFingerprint(request);
  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(fingerprint).not.toContain('203.0.113.10');
  expect(fingerprint).not.toContain('Practice Browser');
});
