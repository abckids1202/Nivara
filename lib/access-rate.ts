import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export function requestFingerprint(request: Request) {
  const source = `${request.headers.get('x-forwarded-for') ?? 'unknown'}:${request.headers.get('user-agent') ?? 'unknown'}`;
  return createHash('sha256').update(source).digest('hex');
}

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
  const attempts = await prisma.accessRateLog.count({
    where: { endpoint, requestFingerprint: fingerprint, createdAt: { gt: since } },
  });
  if (attempts >= maxAttempts) return false;
  await prisma.accessRateLog.create({ data: { endpoint, requestFingerprint: fingerprint } });
  return true;
}
