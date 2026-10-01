import { expect, it } from 'vitest';
import { hasAllowedImageSignature } from '../lib/image-validation.ts';

it('accepts valid JPEG, PNG, and WebP signatures', () => {
  expect(
    hasAllowedImageSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff])),
  ).toBe(true);
  expect(
    hasAllowedImageSignature(
      'image/png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
  ).toBe(true);
  const webp = new Uint8Array(12);
  webp.set([...Buffer.from('RIFF')], 0);
  webp.set([...Buffer.from('WEBP')], 8);
  expect(hasAllowedImageSignature('image/webp', webp)).toBe(true);
});

it('rejects spoofed, truncated, and unsupported image data', () => {
  expect(
    hasAllowedImageSignature('image/png', new Uint8Array([0xff, 0xd8, 0xff])),
  ).toBe(false);
  expect(hasAllowedImageSignature('image/webp', new Uint8Array(4))).toBe(false);
  expect(hasAllowedImageSignature('image/gif', new Uint8Array([0x47, 0x49, 0x46]))).toBe(false);
});
