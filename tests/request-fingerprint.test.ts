import { describe, expect, it } from 'vitest';
import { requestFingerprint } from '../lib/request-fingerprint';

describe('requestFingerprint', () => {
  it('uses the first forwarded address consistently across proxy chains', () => {
    const direct = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'user-agent': 'browser',
      },
    });
    const proxied = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.4',
        'user-agent': 'browser',
      },
    });
    expect(requestFingerprint(direct)).toBe(requestFingerprint(proxied));
  });

  it('falls back to x-real-ip and changes for a different client', () => {
    const first = new Request('https://example.test', {
      headers: { 'x-real-ip': '203.0.113.10', 'user-agent': 'browser' },
    });
    const second = new Request('https://example.test', {
      headers: { 'x-real-ip': '203.0.113.11', 'user-agent': 'browser' },
    });
    expect(requestFingerprint(first)).not.toBe(requestFingerprint(second));
  });

  it('bounds user-agent input before hashing', () => {
    const short = new Request('https://example.test', {
      headers: { 'x-real-ip': '203.0.113.10', 'user-agent': 'a'.repeat(256) },
    });
    const long = new Request('https://example.test', {
      headers: {
        'x-real-ip': '203.0.113.10',
        'user-agent': `${'a'.repeat(256)}malicious-suffix`,
      },
    });
    expect(requestFingerprint(short)).toBe(requestFingerprint(long));
  });
});
