'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, Star } from 'lucide-react';
import { formatInr } from '@/lib/demo-data';
import { StoreHeader } from '@/components/experience-tools';
import { useCart } from '@/components/cart-provider';

type ProductRecord = {
  id: string;
  name: string;
  description: string;
  material: string | null;
  dimensions: string | null;
  care: string | null;
  category: { name: string };
  images: Array<{ id: string; url: string; altText: string }>;
  variants: Array<{
    id: string;
    name: string;
    pricePaise: number;
    compareAtPaise: number | null;
    stockOnHand: number;
  }>;
  rating: number | null;
  reviewCount: number;
  reviews: Array<{
    id: string;
    rating: number;
    body: string;
    displayName: string;
    verifiedPurchase: boolean;
  }>;
};

const formatPaise = (paise: number) => formatInr(Math.round(paise / 100));

export function ProductDetail({ slug }: { slug: string }) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: ProductRecord;
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error ?? 'Product could not be loaded');
        return payload.data;
      })
      .then((data) => {
        if (!data) throw new Error('Product not found');
        setProduct(data);
        setSelectedVariantId(data.variants[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError')
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'Product could not be loaded',
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [slug]);

  if (loading)
    return (
      <>
        <StoreHeader />
        <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8">
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-2">
            <div className="skeleton-card min-h-[520px]" />
            <div className="grid content-center gap-5">
              <div className="h-4 w-24 rounded bg-[#e8e0d4]" />
              <div className="h-16 max-w-lg rounded bg-[#e8e0d4]" />
              <div className="h-24 max-w-lg rounded bg-[#e8e0d4]" />
            </div>
          </div>
        </main>
      </>
    );
  if (error || !product)
    return (
      <>
        <StoreHeader />
        <main className="grid min-h-screen place-items-center bg-[#f8f4ee] px-5 text-center text-[#27362d]">
          <div>
            <p className="eyebrow justify-center">Product unavailable</p>
            <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
              We couldn’t find that piece.
            </h1>
            <p className="mt-4 text-sm text-[#718078]">
              {error || 'This product may have been archived.'}
            </p>
            <Link href="/shop" className="button-primary mt-7">
              Back to shop
            </Link>
          </div>
        </main>
      </>
    );

  const variant =
    product.variants.find((item) => item.id === selectedVariantId) ??
    product.variants[0];
  const soldOut = !variant || variant.stockOnHand <= 0;
  const image = product.images[0];

  const addToBag = async () => {
    if (!variant) return;
    try {
      await addItem(variant.id, quantity);
      setAdded(true);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Your bag could not be updated',
      );
    }
  };

  const toggleWishlist = async () => {
    const response = await fetch(
      wishlisted
        ? `/api/wishlist?productId=${encodeURIComponent(product.id)}`
        : '/api/wishlist',
      {
        method: wishlisted ? 'DELETE' : 'POST',
        headers: wishlisted
          ? undefined
          : { 'Content-Type': 'application/json' },
        body: wishlisted
          ? undefined
          : JSON.stringify({ productId: product.id }),
      },
    );
    if (response.status === 401) {
      setError('Sign in to save pieces to your wishlist.');
      return;
    }
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(result.error ?? 'Wishlist could not be updated.');
      return;
    }
    setWishlisted((value) => !value);
  };

  return (
    <>
      <StoreHeader />
      <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 pb-20 pt-8 text-[#27362d] lg:px-8 lg:pt-12">
        <div className="mx-auto max-w-[1240px]">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#a6503d]"
          >
            <ArrowLeft size={15} /> Back to shop
          </Link>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="product-detail-image overflow-hidden rounded-[2rem] bg-[#d4ded0]">
              <img
                src={image?.url ?? '/nivara-editorial.png'}
                alt={image?.altText ?? product.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="lg:pt-4">
              <p className="eyebrow">{product.category.name}</p>
              <h1 className="mt-4 font-display text-5xl leading-[0.95] tracking-[-0.07em] lg:text-6xl">
                {product.name}
              </h1>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <Star size={15} fill="#c6674f" color="#c6674f" />{' '}
                  {product.rating?.toFixed(1) ?? 'New'}
                </span>
                <span className="text-sm text-[#718078]">
                  {product.reviewCount} approved reviews
                </span>
              </div>
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-2xl font-bold">
                  {variant
                    ? formatPaise(variant.pricePaise)
                    : 'Price unavailable'}
                </span>
                {variant?.compareAtPaise && (
                  <span className="text-sm text-[#9b9084] line-through">
                    {formatPaise(variant.compareAtPaise)}
                  </span>
                )}
              </div>
              <p className="mt-5 max-w-[500px] leading-7 text-[#637268]">
                {product.description}
              </p>
              <div className="mt-7 border-y border-[#e2d9cd] py-6">
                <p className="text-sm font-semibold">
                  Variant{' '}
                  <span className="font-normal text-[#637268]">
                    {variant?.name ?? 'Unavailable'}
                  </span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(item.id);
                        setQuantity(1);
                        setAdded(false);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm transition ${selectedVariantId === item.id ? 'border-[#314338] bg-[#314338] text-white' : 'border-[#d8cec1] bg-[#fffaf3] hover:border-[#a6503d]'}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <div className="flex h-12 items-center rounded-full border border-[#d8cec1] bg-[#fffaf3]">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setQuantity((value) => Math.max(1, value - 1))
                    }
                    className="grid h-12 w-11 place-items-center"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity((value) =>
                        Math.min(variant?.stockOnHand || 1, value + 1),
                      )
                    }
                    className="grid h-12 w-11 place-items-center"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={soldOut}
                  onClick={() => void addToBag()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#314338] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#9b9084]"
                >
                  {soldOut ? (
                    'Currently sold out'
                  ) : added ? (
                    <>
                      <Check size={16} /> Added to bag
                    </>
                  ) : (
                    'Add to bag'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleWishlist()}
                  aria-label={
                    wishlisted ? 'Remove from wishlist' : 'Save to wishlist'
                  }
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#d8cec1] bg-[#fffaf3] ${wishlisted ? 'text-[#a6503d]' : ''}`}
                >
                  <Heart
                    size={18}
                    fill={wishlisted ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-3 text-sm text-[#a6503d]">
                  {error}
                </p>
              )}
              <div className="mt-6 grid gap-3 rounded-2xl bg-[#e7eee5] p-4 text-sm text-[#536259] sm:grid-cols-3">
                <span>
                  <strong className="block text-[#27362d]">Delivery</strong>₹79
                  under ₹999
                </span>
                <span>
                  <strong className="block text-[#27362d]">Materials</strong>
                  {product.material ?? 'Made for everyday use'}
                </span>
                <span>
                  <strong className="block text-[#27362d]">Size</strong>
                  {product.dimensions ?? 'See product details'}
                </span>
              </div>
            </div>
          </div>
          <section className="mt-16 grid gap-8 border-t border-[#e2d9cd] pt-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">Details</p>
              <h2 className="mt-3 font-display text-3xl tracking-[-0.05em]">
                Made to settle in.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#637268]">
                {product.care ??
                  'Care instructions will be provided with your order.'}
              </p>
            </div>
            <div className="grid gap-4">
              {product.reviews.length ? (
                product.reviews.slice(0, 3).map((review) => (
                  <blockquote
                    key={review.id}
                    className="rounded-2xl bg-[#fffaf3] p-5 text-sm leading-6"
                  >
                    <p className="flex items-center gap-1 text-[#a6503d]">
                      {'★'.repeat(review.rating)}
                    </p>
                    <p className="mt-2 text-[#637268]">“{review.body}”</p>
                    <cite className="mt-3 flex items-center gap-2 not-italic font-semibold">
                      {review.displayName}
                      {review.verifiedPurchase && (
                        <span className="rounded-full bg-[#e7eee5] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#536259]">
                          Verified purchase
                        </span>
                      )}
                    </cite>
                  </blockquote>
                ))
              ) : (
                <p className="rounded-2xl bg-[#fffaf3] p-5 text-sm text-[#718078]">
                  Reviews will appear here after customers receive their orders.
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
