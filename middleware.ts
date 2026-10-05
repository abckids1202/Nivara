import { NextRequest, NextResponse } from 'next/server';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_MUTATION_BODY_BYTES = 2 * 1024 * 1024;
const MAX_MULTIPART_BODY_BYTES = 6 * 1024 * 1024;

function isTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === 'null') return false;

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl)
    return process.env.NODE_ENV !== 'production';

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const originValue = originUrl.origin;
    if (process.env.NODE_ENV !== 'production')
      return (
        originValue === requestUrl.origin ||
        (isLocalDevelopmentHost(originUrl.hostname) &&
          isLocalDevelopmentHost(requestUrl.hostname) &&
          originUrl.protocol === requestUrl.protocol &&
          originUrl.port === requestUrl.port) ||
        originValue === new URL(configuredSiteUrl).origin
      );
    return originValue === new URL(configuredSiteUrl).origin;
  } catch {
    return false;
  }
}

function isLocalDevelopmentHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function middleware(request: NextRequest) {
  if (mutationMethods.has(request.method)) {
    if (!isTrustedOrigin(request))
      return NextResponse.json(
        { error: 'Cross-origin request blocked' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );

    const declaredLength = Number(request.headers.get('content-length'));
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    const maxBytes = contentType.startsWith('multipart/form-data')
      ? MAX_MULTIPART_BODY_BYTES
      : MAX_MUTATION_BODY_BYTES;
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
      return NextResponse.json(
        { error: 'Request body is too large' },
        { status: 413, headers: { 'Cache-Control': 'no-store' } },
      );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
