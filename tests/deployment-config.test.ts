import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type VercelConfig = {
  crons?: Array<{ path?: string; schedule?: string }>;
};

describe('deployment configuration', () => {
  it('keeps the protected reconciliation cron on a five-minute schedule', () => {
    const config = JSON.parse(
      readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'),
    ) as VercelConfig;

    expect(config.crons).toContainEqual({
      path: '/api/jobs/reconcile',
      schedule: '*/5 * * * *',
    });
  });
});
