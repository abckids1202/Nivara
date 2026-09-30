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
  const response = {
    service: 'nivara-store',
    status: database === 'connected' ? 'ok' : 'degraded',
    database,
    paymentsConfigured,
    authConfigured,
    ready: database === 'connected' && authConfigured && paymentsConfigured,
  } as const;
  return json(response, response.status === 'ok' ? 200 : 503);
}
