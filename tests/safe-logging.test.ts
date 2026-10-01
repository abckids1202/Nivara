import { describe, expect, it } from 'vitest';
import { safeErrorMessage } from '@/lib/safe-logging';

describe('safe error logging', () => {
  it('redacts credentials, URLs, emails, and long token-like values', () => {
    const message = safeErrorMessage(
      new Error(
        'Bearer secret-token https://api.example.test/x?key=secret user@example.com abcdefghijklmnopqrstuvwxyz123456',
      ),
    );

    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('https://');
    expect(message).not.toContain('user@example.com');
    expect(message).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(message).toContain('[redacted]');
    expect(message).toContain('[url]');
    expect(message).toContain('[email]');
  });

  it('bounds unexpected error messages', () => {
    expect(safeErrorMessage(new Error('x'.repeat(500))).length).toBeLessThanOrEqual(240);
  });
});
