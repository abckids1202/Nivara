import { PrismaClient } from '@prisma/client';

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
} finally {
  await prisma.$disconnect();
}
