import { createHash } from 'node:crypto';

export function requestFingerprint(request: Request) {
  const forwardedFor = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  const clientAddress =
    forwardedFor || request.headers.get('x-real-ip')?.trim() || 'unknown';
  const userAgent = (request.headers.get('user-agent') ?? 'unknown').slice(
    0,
    256,
  );
  const source = `${clientAddress}:${userAgent}`;
  return createHash('sha256').update(source).digest('hex');
}
