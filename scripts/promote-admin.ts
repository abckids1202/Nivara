import { PrismaClient } from '@prisma/client';
import {
  canPromoteAdmin,
  type SupabaseAdminUser,
} from '../lib/admin-bootstrap.ts';
import { hasConfiguredValue } from '../lib/configuration.ts';
import { providerFetch } from '../lib/provider-fetch.ts';
import { loadLocalEnvironment } from './load-env.ts';

loadLocalEnvironment();

const emailIndex = process.argv.findIndex((value) => value === '--email');
const email = emailIndex >= 0 ? process.argv[emailIndex + 1]?.trim() : undefined;
const confirmed = process.argv.includes('--confirm');
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

if (!email || !emailPattern.test(email) || !confirmed) {
  console.error(
    'Usage: npm run admin:promote -- --email verified-user@example.com --confirm',
  );
  console.error(
    'The account must already exist in the application database and Supabase Auth.',
  );
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No administrator was changed.');
  process.exit(2);
}

const prisma = new PrismaClient();

async function readSupabaseUser(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !hasConfiguredValue(supabaseUrl, ['your-project']) ||
    !hasConfiguredValue(serviceRoleKey)
  )
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to verify the account',
    );

  const response = await providerFetch(
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: 'no-store',
    },
  );
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as SupabaseAdminUser | null;
}

try {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, isAdmin: true },
  });

  if (!user) {
    console.error(
      `No application account found for ${email}. Have the user sign up and verify their email first.`,
    );
    process.exitCode = 1;
  } else if (user.isAdmin) {
    console.log(`${user.email} is already an administrator.`);
  } else {
    try {
      const supabaseUser = await readSupabaseUser(user.id);
      if (
        !supabaseUser ||
        !canPromoteAdmin({
          applicationUserId: user.id,
          applicationEmail: user.email,
          supabaseUser,
        })
      ) {
        console.error(
          'The application account was not verified in Supabase Auth. No administrator was changed.',
        );
        process.exitCode = 1;
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { isAdmin: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: user.id,
              action: 'user.admin_granted',
              entityType: 'User',
              entityId: user.id,
              details: { source: 'promote-admin-script' },
            },
          });
        });
        console.log(`${user.email} is now an administrator.`);
      }
    } catch (error) {
      console.error(
        `Supabase account verification failed: ${error instanceof Error ? error.message : 'provider request failed'}. No administrator was changed.`,
      );
      process.exitCode = 1;
    }
  }
} finally {
  await prisma.$disconnect();
}
