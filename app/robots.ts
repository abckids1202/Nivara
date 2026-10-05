import type { MetadataRoute } from 'next';
import { normalizeSiteUrl } from '@/lib/site-url';

const baseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/account', '/checkout', '/guest-order/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
