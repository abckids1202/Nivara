import { afterEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock('../lib/prisma', () => ({ prisma: { $queryRaw: queryRaw } }));

import { GET } from '../app/api/health/route';

const originalEnv = { ...process.env };

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
}

afterEach(() => {
  restoreEnvironment();
  queryRaw.mockReset();
});

describe('health readiness', () => {
  it('returns degraded readiness for placeholder provider configuration', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.DIRECT_URL = 'postgresql://database.example/nivara';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_replace_me';
    process.env.RAZORPAY_KEY_SECRET = 'replace-me-server-only';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'replace-me-server-only';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'replace-me';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'replace-me-server-only';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
    process.env.RESEND_API_KEY = 'replace-me';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@example.com>';
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.CRON_SECRET = 'replace-me-server-only';
    queryRaw.mockResolvedValue([
      { userTable: 'User', cleanupTable: 'StorageCleanupTask' },
    ]);

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.ready).toBe(false);
    expect(body.paymentsConfigured).toBe(false);
    expect(body.authConfigured).toBe(false);
    expect(JSON.stringify(body)).not.toContain('replace-me');
  });

  it('returns ready only when the database and all required providers are configured', async () => {
    process.env.DATABASE_URL = 'postgresql://database.example/nivara';
    process.env.DIRECT_URL = 'postgresql://database.example/nivara';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    process.env.RAZORPAY_KEY_ID = 'provider-test-id';
    process.env.RAZORPAY_KEY_SECRET = 'provider-test-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'provider-test-webhook';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'supabase-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-service-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'product-images';
    process.env.RESEND_API_KEY = 're_test_api-key';
    process.env.RESEND_FROM_EMAIL = 'Nivara <orders@nivara.in>';
    process.env.SUPPORT_EMAIL = 'support@nivara.in';
    process.env.CRON_SECRET = 'cron-secret';
    queryRaw.mockResolvedValue([
      { userTable: 'User', cleanupTable: 'StorageCleanupTask' },
    ]);

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.ready).toBe(true);
    expect(body.database).toBe('connected');
    expect(body.schemaConfigured).toBe(true);
    expect(body.deploymentConfigured).toBe(true);
    expect(body.paymentsConfigured).toBe(true);
    expect(body.authConfigured).toBe(true);
    expect(body.storageConfigured).toBe(true);
    expect(body.emailConfigured).toBe(true);
    expect(body.supportConfigured).toBe(true);
    expect(body.cronConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain('provider-test-secret');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
