import { afterEach, describe, expect, it, vi } from 'vitest';

const { transaction, logServerError } = vi.hoisted(() => ({
  transaction: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: transaction } }));
vi.mock('@/lib/safe-logging', () => ({ logServerError }));

import { GET } from '@/app/api/jobs/reconcile/route';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
  transaction.mockReset();
  logServerError.mockReset();
});

describe('reconciliation job resilience', () => {
  it('returns a safe response when retention cleanup fails', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.RAZORPAY_KEY_ID = 'razorpay-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'test-secret';
    transaction.mockRejectedValue(new Error('private database details'));

    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('Reconciliation is temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('private');
    expect(logServerError).toHaveBeenCalledWith(
      'reconciliation_job_failed',
      expect.any(Error),
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
