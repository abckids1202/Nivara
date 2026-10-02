import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/jobs/reconcile/route';

const originalCronSecret = process.env.CRON_SECRET;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('reconciliation job authorization', () => {
  it('rejects requests without the cron bearer token', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile'),
    );

    expect(response.status).toBe(401);
  });

  it('rejects requests with an incorrect cron bearer token', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    );

    expect(response.status).toBe(401);
  });

  it('checks authorization before reporting missing infrastructure', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    delete process.env.DATABASE_URL;
    const response = await GET(
      new Request('https://nivara.example/api/jobs/reconcile', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );

    expect(response.status).toBe(503);
  });
});
