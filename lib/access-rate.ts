import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requestFingerprint } from '@/lib/request-fingerprint';

export { requestFingerprint } from '@/lib/request-fingerprint';

export async function consumeRateLimit({
  request,
  endpoint,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000,
}: {
  request: Request;
  endpoint: string;
  maxAttempts?: number;
  windowMs?: number;
}) {
  if (!process.env.DATABASE_URL) return true;
  const fingerprint = requestFingerprint(request);
  const since = new Date(Date.now() - windowMs);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const attempts = await tx.accessRateLog.count({
            where: {
              endpoint,
              requestFingerprint: fingerprint,
              createdAt: { gt: since },
            },
          });
          if (attempts >= maxAttempts) return false;
          await tx.accessRateLog.create({
            data: { endpoint, requestFingerprint: fingerprint },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const serializationConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!serializationConflict || attempt === 1) throw error;
    }
  }
  return false;
}
