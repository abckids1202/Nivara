import { ProductDetail } from "@/components/product-detail";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
