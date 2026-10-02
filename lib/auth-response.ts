import { NextResponse } from 'next/server';

export function authResponse<T>(payload: T, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
