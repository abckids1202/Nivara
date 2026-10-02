import { afterEach, describe, expect, it, vi } from 'vitest';

const { consumeRateLimit, logServerError } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/access-rate', () => ({ consumeRateLimit }));
vi.mock('@/lib/provider-fetch', () => ({ providerFetch: vi.fn() }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { POST } from '@/app/api/support/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  consumeRateLimit.mockReset();
  logServerError.mockReset();
});

describe('support route resilience', () => {
  it('returns a safe response when rate-limit storage fails', async () => {
    process.env.RESEND_API_KEY = 'resend-test-key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.test>';
    process.env.SUPPORT_EMAIL = 'support@nivara.test';
    consumeRateLimit.mockRejectedValue(new Error('private rate log details'));

    const response = await POST(
      new Request('https://nivara.example/api/support', { method: 'POST' }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Support messaging is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'support_rate_limit_failed',
      expect.any(Error),
    );
  });
});
