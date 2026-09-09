import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProduct, products } from "@/lib/demo-data";

export function generateStaticParams() { return products.map((product) => ({ slug: product.slug })); }

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product || product.slug !== params.slug) notFound();
  return <ProductDetail product={product} />;
}
