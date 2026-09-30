import { json, unavailable } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  if (!process.env.DATABASE_URL) return unavailable("Product database is not configured");

  const { slug } = await context.params;
  const product = await prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, pricePaise: true, compareAtPaise: true, stockOnHand: true } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, body: true, displayName: true, createdAt: true },
      },
    },
  });

  if (!product) return json({ error: "Product not found" }, 404);

  const ratings = product.reviews.map((review) => review.rating);
  return json({
    data: {
      ...product,
      minPricePaise: product.variants.length ? Math.min(...product.variants.map((variant) => variant.pricePaise)) : null,
      stockAvailable: product.variants.some((variant) => variant.stockOnHand > 0),
      rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
      reviewCount: ratings.length,
    },
  });
}
