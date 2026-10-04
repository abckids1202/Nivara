'use client';

import Link from 'next/link';
import { ArrowRight, Heart, Sparkles, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatInr } from '@/lib/format';
import { MagneticLink, StoreHeader } from '@/components/experience-tools';
import { useCart } from '@/components/cart-provider';
import { isSellable } from '@/lib/inventory';

type FeaturedProduct = {
  id: string;
  name: string;
  slug: string;
  category: { name: string; slug: string };
  image: { url: string; altText: string } | null;
  variants: Array<{
    id: string;
    pricePaise: number;
    compareAtPaise: number | null;
    stockOnHand: number;
    stockReserved: number;
  }>;
  minPricePaise: number | null;
  stockAvailable: boolean;
};

const categoryAccents = ['sage', 'clay', 'ink', 'olive', 'sand'] as const;
type HomepageCategory = { id: string; name: string; slug: string };

function ProductCard({
  product,
  onAdd,
  wishlisted,
  onToggleWishlist,
}: {
  product: FeaturedProduct;
  onAdd: () => void;
  wishlisted: boolean;
  onToggleWishlist: () => void;
}) {
  const variant =
    product.variants.find(
      (item) => isSellable(item.stockOnHand, item.stockReserved),
    ) ??
    product.variants[0];
  return (
    <article className="group reveal">
      <div className="product-image relative overflow-hidden rounded-[1.5rem] bg-[#e8e0d4]">
        <img
          src={product.image?.url ?? '/nivara-editorial.png'}
          alt={product.image?.altText ?? product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1d2820]/25 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-[#fffaf3]/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#314338]">
          {product.stockAvailable ? product.category.name : 'Sold out'}
        </span>
        <button
          type="button"
          aria-label={
            wishlisted
              ? `Remove ${product.name} from wishlist`
              : `Save ${product.name} to wishlist`
          }
          onClick={onToggleWishlist}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#fffaf3]/90 text-[#314338] transition hover:scale-110"
        >
          <Heart
            size={16}
            strokeWidth={1.8}
            fill={wishlisted ? 'currentColor' : 'none'}
          />
        </button>
        {product.stockAvailable && variant && (
          <button
            type="button"
            onClick={onAdd}
            className="absolute bottom-3 left-3 right-3 rounded-full bg-[#314338] px-4 py-3 text-sm font-semibold text-[#fffaf3] opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100 hover:bg-[#26372c]"
          >
            Add to bag
          </button>
        )}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/product/${product.slug}`}
            className="font-semibold tracking-[-0.02em] hover:text-[#a6503d]"
          >
            {product.name}
          </Link>
          <p className="mt-1 text-sm text-[#718078]">{product.category.name}</p>
        </div>
        <div className="text-right text-sm font-semibold">
          <p>{formatInr(Math.round((product.minPricePaise ?? 0) / 100))}</p>
          {variant?.compareAtPaise && (
            <p className="mt-1 text-xs font-normal text-[#9b9084] line-through">
              {formatInr(Math.round(variant.compareAtPaise / 100))}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [categories, setCategories] = useState<HomepageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [productReload, setProductReload] = useState(0);
  const [categoryError, setCategoryError] = useState('');
  const [categoryReload, setCategoryReload] = useState(0);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/api/catalogue?pageSize=4&sort=newest', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          data?: FeaturedProduct[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            payload.error ?? 'Featured products could not be loaded',
          );
        return payload.data ?? [];
      })
      .then(setProducts)
      .catch((reason: unknown) => {
        setProducts([]);
        setError(
          reason instanceof Error && !(reason instanceof TypeError)
            ? reason.message
            : 'Featured products could not be loaded',
        );
      })
      .finally(() => setLoading(false));
  }, [productReload]);

  useEffect(() => {
    fetch('/api/categories', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          data?: HomepageCategory[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error ?? 'Categories could not be loaded');
        return payload.data ?? [];
      })
      .then((nextCategories) => {
        setCategories(nextCategories);
        setCategoryError('');
      })
      .catch((reason: unknown) => {
        setCategories([]);
        setCategoryError(
          reason instanceof Error
            ? reason.message
            : 'Categories could not be loaded',
        );
      });
  }, [categoryReload]);

  useEffect(() => {
    fetch('/api/wishlist', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return [];
        if (!response.ok) throw new Error('Wishlist status could not be loaded');
        const payload = (await response.json()) as {
          data?: Array<{ productId: string }>;
        };
        return payload.data?.map((item) => item.productId) ?? [];
      })
      .then((ids) => setWishlistIds(new Set(ids)))
      .catch((reason: unknown) => {
        setNotice(
          reason instanceof Error
            ? reason.message
            : 'Wishlist status could not be loaded',
        );
        window.setTimeout(() => setNotice(''), 2600);
      });
  }, []);

  const addToBag = async (product: FeaturedProduct) => {
    const variant = product.variants.find(
      (item) => isSellable(item.stockOnHand, item.stockReserved),
    );
    if (!variant) return;
    try {
      await addItem(variant.id);
      setNotice(`${product.name} added to your bag.`);
    } catch (reason: unknown) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : 'Your bag could not be updated.',
      );
    }
    window.setTimeout(() => setNotice(''), 2600);
  };

  const toggleWishlist = async (product: FeaturedProduct) => {
    const saved = wishlistIds.has(product.id);
    const response = await fetch(
      saved
        ? `/api/wishlist?productId=${encodeURIComponent(product.id)}`
        : '/api/wishlist',
      {
        method: saved ? 'DELETE' : 'POST',
        headers: saved ? undefined : { 'Content-Type': 'application/json' },
        body: saved ? undefined : JSON.stringify({ productId: product.id }),
      },
    );
    if (response.status === 401) {
      setNotice('Sign in to save pieces to your wishlist.');
    } else if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setNotice(payload.error ?? 'Wishlist could not be updated.');
    } else {
      setWishlistIds((current) => {
        const next = new Set(current);
        if (saved) next.delete(product.id);
        else next.add(product.id);
        return next;
      });
      setNotice(saved ? `${product.name} removed from your wishlist.` : `${product.name} saved.`);
    }
    window.setTimeout(() => setNotice(''), 2600);
  };

  return (
    <main className="page-transition min-h-screen bg-[#f8f4ee] text-[#27362d]">
      <StoreHeader />
      {notice && (
        <output
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#314338] px-5 py-3 text-sm font-semibold text-white shadow-xl"
        >
          {notice}
        </output>
      )}
      <section className="mx-auto grid max-w-[1240px] gap-8 px-5 pb-16 pt-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-16">
        <div className="reveal max-w-[530px]">
          <p className="eyebrow">
            <Sparkles size={14} /> Small comforts, considered well
          </p>
          <h1 className="font-display mt-5 text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.08em]">
            Make space for{' '}
            <em className="font-normal text-[#b25d49]">everyday.</em>
          </h1>
          <p className="mt-7 max-w-[430px] text-lg leading-8 text-[#64726a]">
            Practical, well-made pieces for desks, kitchens, and the first
            little corners that make a place feel like home.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <MagneticLink href="/shop">
              Shop the collection <ArrowRight size={16} />
            </MagneticLink>
            <a href="#categories" className="button-secondary">
              Explore categories
            </a>
          </div>
          <div className="mt-10 flex items-center gap-4 text-sm text-[#718078]">
            <span className="flex -space-x-2">
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f4ee] bg-[#d6b49c] text-xs">
                A
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f4ee] bg-[#aebca6] text-xs">
                R
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f8f4ee] bg-[#d8cfb9] text-xs">
                M
              </span>
            </span>
            <span>Made for first homes and fresh starts</span>
          </div>
        </div>
        <div className="reveal relative min-h-[420px] overflow-hidden rounded-[2rem] bg-[#c6d0c0] shadow-[0_20px_60px_rgba(52,64,53,0.12)] lg:min-h-[580px]">
          <img
            src="/nivara-editorial.png"
            alt="A calm first-apartment corner with a planter and desk essentials"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#27362d]/40 via-transparent to-transparent" />
          <div className="absolute bottom-7 left-7 max-w-[220px] text-[#fffaf3]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f2d4c8]">
              The soft landing edit
            </p>
            <p className="mt-2 font-display text-3xl leading-none tracking-[-0.05em]">
              A little order, a little warmth.
            </p>
          </div>
          <span className="absolute right-7 top-7 grid h-16 w-16 place-items-center rounded-full bg-[#e48a6f] text-center text-xs font-bold uppercase leading-4 tracking-[0.08em] text-[#fffaf3]">
            New
            <br />
            season
          </span>
        </div>
      </section>
      <section
        id="categories"
        className="border-y border-[#e3dbd0] bg-[#fffaf3] px-5 py-12 lg:px-8"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="reveal flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Browse by room</p>
              <h2 className="section-title">
                Start with the corner you’re making yours.
              </h2>
            </div>
            <Link
              href="/shop"
              className="hidden items-center gap-2 text-sm font-bold text-[#a6503d] sm:flex"
            >
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {categoryError && (
            <div
              role="alert"
              className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f7ddd5] p-5 text-sm text-[#8f3f31]"
            >
              <span>{categoryError}</span>
              <button
                type="button"
                onClick={() => setCategoryReload((value) => value + 1)}
                className="rounded-full border border-[#c98271] px-4 py-2 font-semibold hover:bg-[#f1cfc5]"
              >
                Try again
              </button>
            </div>
          )}
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/shop?category=${category.slug}`}
                className={`category-card category-${categoryAccents[index % categoryAccents.length]} reveal`}
              >
                <span className="text-xs font-bold uppercase tracking-[0.14em]">
                  0{index + 1}
                </span>
                <span className="mt-16 block text-xl font-semibold tracking-[-0.04em]">
                  {category.name}
                </span>
                <span className="mt-2 block text-sm opacity-75">
                  Explore the edit
                </span>
                <ArrowRight size={17} className="absolute bottom-5 right-5" />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1240px] px-5 py-16 lg:px-8 lg:py-24">
        <div className="reveal flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">A considered few</p>
            <h2 className="section-title">Good things to come home to.</h2>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-2 text-sm font-bold text-[#a6503d] sm:flex"
          >
            Shop all pieces <ArrowRight size={15} />
          </Link>
        </div>
        {error && (
          <div
            role="alert"
            className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f7ddd5] p-6 text-sm text-[#8f3f31]"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setProductReload((value) => value + 1)}
              className="rounded-full border border-[#c98271] px-4 py-2 font-semibold hover:bg-[#f1cfc5]"
            >
              Try again
            </button>
          </div>
        )}
        {!error && loading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton-card" />
            ))}
          </div>
        )}
        {!error && !loading && products.length === 0 && (
          <p className="mt-8 rounded-2xl bg-[#fffaf3] p-8 text-sm text-[#718078]">
            The collection is being prepared. Please check back soon.
          </p>
        )}
        {!error && !loading && products.length > 0 && (
          <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={() => void addToBag(product)}
                wishlisted={wishlistIds.has(product.id)}
                onToggleWishlist={() => void toggleWishlist(product)}
              />
            ))}
          </div>
        )}
      </section>
      <section
        id="about"
        className="reveal mx-auto grid max-w-[1240px] gap-5 px-5 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-24"
      >
        <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[#d3daca]">
          <img
            src="/nivara-editorial.png"
            alt="A plant, basket, and desk objects styled in a calm home"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: '78% 38%' }}
          />
        </div>
        <div className="flex flex-col justify-center rounded-[2rem] bg-[#314338] p-8 text-[#fffaf3] lg:p-12">
          <p className="eyebrow text-[#d8c6a8]">Why Nivara</p>
          <h2 className="mt-5 font-display text-4xl leading-[0.95] tracking-[-0.07em] lg:text-5xl">
            Useful can still feel personal.
          </h2>
          <p className="mt-6 max-w-[390px] leading-7 text-[#d7e0d4]">
            We look for the pieces that do their job quietly, wear in
            beautifully, and make the everyday feel a touch more considered.
          </p>
          <Link
            href="/shop"
            className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#f3c4b4]"
          >
            Meet the collection <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="border-y border-[#e3dbd0] bg-[#e7eee5] px-5 py-10 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 sm:grid-cols-3">
          <div className="flex gap-4">
            <Truck className="mt-1 shrink-0 text-[#a6503d]" size={22} />
            <div>
              <p className="font-semibold">Easy delivery</p>
              <p className="mt-1 text-sm leading-6 text-[#637268]">
                Free over ₹999, otherwise ₹79 across India.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="mt-1 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-[#a6503d] text-xs font-bold text-[#a6503d]">
              ↺
            </span>
            <div>
              <p className="font-semibold">Thoughtful returns</p>
              <p className="mt-1 text-sm leading-6 text-[#637268]">
                Clear policies, no confusing fine print.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <span className="mt-1 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-[#a6503d] text-xs font-bold text-[#a6503d]">
              ✦
            </span>
            <div>
              <p className="font-semibold">Made for real homes</p>
              <p className="mt-1 text-sm leading-6 text-[#637268]">
                Practical objects with a little personality.
              </p>
            </div>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-10 text-sm text-[#718078] sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>© 2026 Nivara. Demonstration storefront.</p>
        <div className="flex gap-5">
          <Link href="/support" className="hover:text-[#a6503d]">
            Support
          </Link>
          <Link href="/policies" className="hover:text-[#a6503d]">
            Policies
          </Link>
          <Link href="/admin" className="hover:text-[#a6503d]">
            Admin preview
          </Link>
        </div>
      </footer>
    </main>
  );
}
