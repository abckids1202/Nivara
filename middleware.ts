import { NextRequest, NextResponse } from 'next/server';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === 'null') return false;

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl)
    return process.env.NODE_ENV !== 'production';

  try {
    return new URL(origin).origin === new URL(configuredSiteUrl).origin;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (
    mutationMethods.has(request.method) &&
    !isTrustedOrigin(request)
  )
    return NextResponse.json(
      { error: 'Cross-origin request blocked' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
