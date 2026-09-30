import { expect, it } from 'vitest';
import {
  createGuestOrderToken,
  hashGuestOrderToken,
} from '../lib/guest-token.ts';

it('guest tokens are random and only their hash is persisted', () => {
  const token = createGuestOrderToken();
  expect(token.rawToken.length).toBeGreaterThanOrEqual(40);
  expect(token.rawToken).not.toBe(token.tokenHash);
  expect(hashGuestOrderToken(token.rawToken)).toBe(token.tokenHash);
});
