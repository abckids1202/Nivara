import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

function request(method: string, origin?: string) {
  return new NextRequest('https://store.nivara.in/api/checkout', {
    method,
    headers: origin ? { origin } : undefined,
  });
}

describe('API origin protection', () => {
  it('allows same-origin mutation requests', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    expect(middleware(request('POST', 'https://store.nivara.in')).status).toBe(200);
  });

  it('rejects cross-origin mutation requests', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    const response = middleware(request('POST', 'https://attacker.example'));
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: 'Cross-origin request blocked',
    });
  });

  it('allows provider webhooks without a browser origin', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    expect(middleware(request('POST')).status).toBe(200);
  });

  it('rejects null origins for mutation requests', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    expect(middleware(request('POST', 'null')).status).toBe(403);
  });

  it('does not block read requests from another origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://store.nivara.in';
    expect(middleware(request('GET', 'https://attacker.example')).status).toBe(200);
  });
});
