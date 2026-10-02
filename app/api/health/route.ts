import { noStore } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { hasConfiguredValue } from '@/lib/configuration';

function hasHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET() {
  let database = 'not_configured';
  let schemaConfigured = false;
  if (process.env.DATABASE_URL) {
    try {
      const rows = await prisma.$queryRaw<
        Array<{ userTable: string | null; cleanupTable: string | null }>
      >`
        SELECT
          to_regclass('public."User"') AS "userTable",
          to_regclass('public."StorageCleanupTask"') AS "cleanupTable"
      `;
      schemaConfigured = Boolean(rows[0]?.userTable && rows[0]?.cleanupTable);
      database = schemaConfigured ? 'connected' : 'schema_incomplete';
    } catch {
      database = 'unreachable';
    }
  }
  const paymentsConfigured = Boolean(
    hasConfiguredValue(process.env.RAZORPAY_KEY_ID, ['replace-me']) &&
      hasConfiguredValue(process.env.RAZORPAY_KEY_SECRET, ['replace-me']) &&
      hasConfiguredValue(process.env.RAZORPAY_WEBHOOK_SECRET, ['replace-me']),
  );
  const authConfigured = Boolean(
    hasConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_URL, [
      'your-project',
    ]) &&
      hasConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, [
        'replace-me',
      ]),
  );
  const storageConfigured = Boolean(
    hasConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_URL, [
      'your-project',
    ]) &&
      hasConfiguredValue(process.env.SUPABASE_SERVICE_ROLE_KEY, [
        'replace-me',
      ]) &&
      hasConfiguredValue(process.env.SUPABASE_STORAGE_BUCKET, ['replace-me']),
  );
  const emailConfigured = Boolean(
    hasConfiguredValue(process.env.RESEND_API_KEY, ['replace-me']) &&
      hasConfiguredValue(process.env.RESEND_FROM_EMAIL, ['example.com']),
  );
  const supportConfigured = Boolean(
    emailConfigured &&
      hasConfiguredValue(process.env.SUPPORT_EMAIL, ['example.com']),
  );
  const cronConfigured = Boolean(
    hasConfiguredValue(process.env.CRON_SECRET, ['replace-me']),
  );
  const deploymentConfigured = Boolean(
    hasConfiguredValue(process.env.DIRECT_URL, ['localhost']) &&
      hasHttpsUrl(process.env.NEXT_PUBLIC_SITE_URL),
  );
  const ready =
    database === 'connected' &&
    schemaConfigured &&
    deploymentConfigured &&
    authConfigured &&
    paymentsConfigured &&
    storageConfigured &&
    emailConfigured &&
    supportConfigured &&
    cronConfigured;
  const response = {
    service: 'nivara-store',
    status: ready ? 'ok' : 'degraded',
    database,
    schemaConfigured,
    deploymentConfigured,
    paymentsConfigured,
    authConfigured,
    storageConfigured,
    emailConfigured,
    supportConfigured,
    cronConfigured,
    ready,
  } as const;
  return noStore(response, ready ? 200 : 503);
}
