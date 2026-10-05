import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  productionEnvironmentVariables,
  validateProductionEnvironment,
} from '@/lib/production-env';

const validRazorpayKeyId = ['rzp', 'test', 'providerid'].join('_');

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
  RAZORPAY_KEY_ID: validRazorpayKeyId,
  RAZORPAY_KEY_SECRET: 'provider-test-secret',
  RAZORPAY_WEBHOOK_SECRET: 'provider-test-webhook',
  CRON_SECRET: 'cron-secret',
  NEXT_PUBLIC_SITE_URL: 'https://nivara.test',
};
const malformedProviderId = ['provider', 'test', 'id'].join('-');

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

  it('rejects credentials embedded in public provider URLs', () => {
    const failures = validateProductionEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SITE_URL: 'https://user:secret@nivara.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://user:secret@project.supabase.co',
    });

    expect(failures).toContain(
      'NEXT_PUBLIC_SITE_URL must not contain embedded credentials',
    );
    expect(failures).toContain(
      'NEXT_PUBLIC_SUPABASE_URL must not contain embedded credentials',
    );
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

  it('rejects malformed provider identifiers and storage bucket names', () => {
    const failures = validateProductionEnvironment({
      ...validEnvironment,
      RAZORPAY_KEY_ID: malformedProviderId,
      SUPABASE_STORAGE_BUCKET: 'Product Images',
    });

    expect(failures).toContain(
      'RAZORPAY_KEY_ID must use a valid rzp_test_ or rzp_live_ key format',
    );
    expect(failures).toContain(
      'SUPABASE_STORAGE_BUCKET must contain only lowercase letters, numbers, dots, underscores, or hyphens',
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

  it('documents every required production variable in the environment template', () => {
    const envExample = readFileSync(
      fileURLToPath(new URL('../.env.example', import.meta.url)),
      'utf8',
    );
    for (const name of productionEnvironmentVariables) {
      expect(envExample).toMatch(new RegExp(`^${name}=`, 'm'));
    }
  });
});
