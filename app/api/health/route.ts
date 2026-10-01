import { json } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function GET() {
  let database = 'not_configured';
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'unreachable';
    }
  }
  const paymentsConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'replace-me',
  );
  const storageConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY !== 'replace-me-server-only' &&
      process.env.SUPABASE_STORAGE_BUCKET,
  );
  const emailConfigured = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_API_KEY !== 'replace-me' &&
      process.env.RESEND_FROM_EMAIL &&
      !process.env.RESEND_FROM_EMAIL.includes('example.com'),
  );
  const cronConfigured = Boolean(
    process.env.CRON_SECRET &&
      process.env.CRON_SECRET !== 'replace-me-server-only',
  );
  const response = {
    service: 'nivara-store',
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    paymentsConfigured,
    authConfigured,
    storageConfigured,
    emailConfigured,
    cronConfigured,
    ready:
      database === 'connected' &&
      authConfigured &&
      paymentsConfigured &&
      storageConfigured &&
      emailConfigured &&
      cronConfigured,
  } as const;
  return json(response, response.status === 'ok' ? 200 : 503);
}
