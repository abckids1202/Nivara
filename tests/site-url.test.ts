import { describe, expect, it } from 'vitest';
import { normalizeSiteUrl } from '@/lib/site-url';

describe('normalizeSiteUrl', () => {
  it('uses the safe fallback when no URL is configured', () => {
    expect(normalizeSiteUrl()).toBe('https://nivara.example');
  });

  it('removes trailing slashes, query strings, and fragments', () => {
    expect(
      normalizeSiteUrl('https://store.nivara.in///?preview=1#section'),
    ).toBe('https://store.nivara.in');
  });

  it('preserves a configured deployment path without its trailing slash', () => {
    expect(normalizeSiteUrl('https://preview.example/nivara/')).toBe(
      'https://preview.example/nivara',
    );
  });
});
