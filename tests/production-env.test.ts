import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from '@/lib/production-env';

const validEnvironment = {
  NODE_ENV: 'production' as const,
  DATABASE_URL: 'postgresql://user:password@db.example.test:5432/store',
  DIRECT_URL: 'postgres://user:password@db.example.test:5432/store',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_STORAGE_BUCKET: 'product-images',
  RESEND_API_KEY: 'resend-key',
  RESEND_FROM_EMAIL: 'Nivara <orders@nivara.test>',
  SUPPORT_EMAIL: 'support@nivara.test',
  RAZORPAY_KEY_ID: 'provider-test-id',
  RAZORPAY_KEY_SECRET: 'provider-test-secret',
  RAZORPAY_WEBHOOK_SECRET: 'provider-test-webhook',
  CRON_SECRET: 'cron-secret',
  NEXT_PUBLIC_SITE_URL: 'https://nivara.test',
};

describe('production environment validation', () => {
  it('accepts a complete production-shaped environment', () => {
    expect(validateProductionEnvironment(validEnvironment)).toEqual([]);
  });

  it('rejects non-PostgreSQL database URLs', () => {
    const failures = validateProductionEnvironment({
      ...validEnvironment,
      DATABASE_URL: 'https://db.example.test',
      DIRECT_URL: 'mysql://db.example.test/store',
    });

    expect(failures).toContain('DATABASE_URL must use a PostgreSQL URL');
    expect(failures).toContain('DIRECT_URL must use a PostgreSQL URL');
  });

  it('rejects an insecure production site URL', () => {
    const failures = validateProductionEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SITE_URL: 'http://nivara.test',
    });

    expect(failures).toContain('NEXT_PUBLIC_SITE_URL must use HTTPS');
  });

  it('rejects malformed transactional and support email addresses', () => {
    const failures = validateProductionEnvironment({
      ...validEnvironment,
      RESEND_FROM_EMAIL: 'Nivara orders',
      SUPPORT_EMAIL: 'support-at-nivara.test',
    });

    expect(failures).toContain(
      'RESEND_FROM_EMAIL must contain a valid email address',
    );
    expect(failures).toContain(
      'SUPPORT_EMAIL must contain a valid email address',
    );
  });

  it('keeps the local site URL aligned with the documented Next port', () => {
    const envExample = readFileSync(
      fileURLToPath(new URL('../.env.example', import.meta.url)),
      'utf8',
    );
    expect(envExample).toContain(
      'NEXT_PUBLIC_SITE_URL="http://localhost:3000"',
    );
  });
});
