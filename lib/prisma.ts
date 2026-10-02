import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  nivaraPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.nivaraPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.nivaraPrisma = prisma;
}
