import { createHash } from 'node:crypto';

export function requestFingerprint(request: Request) {
  const source = `${request.headers.get('x-forwarded-for') ?? 'unknown'}:${request.headers.get('user-agent') ?? 'unknown'}`;
  return createHash('sha256').update(source).digest('hex');
}
