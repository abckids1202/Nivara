import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

describe('security headers', () => {
  it('allows only the integrations required by the storefront', async () => {
    const configured = await nextConfig.headers?.();
    const applicationHeaders = configured?.find(
      (entry) => entry.source === '/(.*)',
    )?.headers;
    const csp = applicationHeaders?.find(
      (entry) => entry.key === 'Content-Security-Policy',
    )?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://checkout.razorpay.com');
    expect(csp).toContain('https://*.supabase.co');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
