import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { normalizeSiteUrl } from '@/lib/site-url';

const baseUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ['', '/shop', '/support', '/policies', '/about'].map(
    (path) => ({ url: `${baseUrl}${path}`, lastModified: new Date() }),
  );
  if (!process.env.DATABASE_URL) return staticRoutes;
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    products = await prisma.product.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
    });
  } catch {
    return staticRoutes;
  }
  return [
    ...staticRoutes,
    ...products.map((product) => ({
      url: `${baseUrl}/product/${product.slug}`,
      lastModified: product.updatedAt,
    })),
  ];
}
