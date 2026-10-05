import { createHash, randomBytes } from 'node:crypto';

export function createGuestOrderToken() {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
  };
}

export function isGuestOrderToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function hashGuestOrderToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}
