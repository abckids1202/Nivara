import { NextResponse } from 'next/server';

export function authResponse<T>(payload: T, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete('nivara-access-token');
  response.cookies.delete('nivara-refresh-token');
  return response;
}
