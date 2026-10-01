import type { Metadata } from 'next';
import { ProductDetail } from '@/components/product-detail';
import { prisma } from '@/lib/prisma';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nivara.example';

async function getSeoProduct(slug: string) {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await prisma.product.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        name: true,
        slug: true,
        description: true,
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
        variants: { select: { pricePaise: true, stockOnHand: true } },
        reviews: { where: { status: 'APPROVED' }, select: { rating: true } },
      },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getSeoProduct(slug);
  if (!product) {
    return {
      title: 'Product | Nivara',
      alternates: { canonical: `/product/${slug}` },
    };
  }

  return {
    title: `${product.name} | Nivara`,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: `${product.name} | Nivara`,
      description: product.description,
      type: 'website',
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getSeoProduct(slug);
  const prices = product?.variants.map((variant) => variant.pricePaise) ?? [];
  const ratings = product?.reviews.map((review) => review.rating) ?? [];
  const structuredData = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        url: `${siteUrl}/product/${product.slug}`,
        image: product.images.map((image) => image.url),
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: prices.length ? Math.min(...prices) / 100 : undefined,
          highPrice: prices.length ? Math.max(...prices) / 100 : undefined,
          offerCount: product.variants.length,
          availability: product.variants.some(
            (variant) => variant.stockOnHand > 0,
          )
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
        ...(ratings.length
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue:
                  ratings.reduce((sum, rating) => sum + rating, 0) /
                  ratings.length,
                reviewCount: ratings.length,
              },
            }
          : {}),
      }
    : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
        />
      )}
      <ProductDetail slug={slug} />
    </>
  );
}
