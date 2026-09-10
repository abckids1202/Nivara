import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProduct, products } from "@/lib/demo-data";

export function generateStaticParams() { return products.map((product) => ({ slug: product.slug })); }

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product || product.slug !== slug) notFound();
  return <ProductDetail product={product} />;
}
