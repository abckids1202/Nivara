"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heart, Search, SlidersHorizontal, Star } from "lucide-react";
import { formatInr } from "@/lib/demo-data";

type CatalogueProduct = {
  id: string;
  name: string;
  slug: string;
  category: { name: string; slug: string };
  image: { url: string; altText: string } | null;
  variants: Array<{ id: string; name: string; pricePaise: number; compareAtPaise: number | null; stockOnHand: number }>;
  minPricePaise: number | null;
  stockAvailable: boolean;
  rating: number | null;
  reviewCount: number;
};

const categoryOptions = [
  ["All pieces", ""],
  ["Desk & study", "desk-and-study"],
  ["Storage", "storage"],
  ["Soft furnishings", "soft-furnishings"],
  ["Planters", "planters"],
  ["Kitchen", "kitchen"],
] as const;

const formatPaise = (paise: number | null) => formatInr(Math.round((paise ?? 0) / 100));

export default function ShopPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "");
  const [availability, setAvailability] = useState(() => searchParams.get("availability") ?? "all");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "newest");
  const [maxPrice, setMaxPrice] = useState(() => {
    const price = Number(searchParams.get("maxPrice"));
    return Number.isFinite(price) && price >= 300 ? price : 2500;
  });
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (availability !== "all") params.set("availability", availability);
    if (sort !== "newest") params.set("sort", sort);
    if (maxPrice !== 2500) params.set("maxPrice", String(maxPrice));
    window.history.replaceState({}, "", `/shop${params.toString() ? `?${params}` : ""}`);
  }, [availability, category, maxPrice, query, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pageSize: "48", sort, maxPricePaise: String(maxPrice * 100) });
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (availability !== "all") params.set("availability", availability);

    queueMicrotask(() => {
      setLoading(true);
      setError("");
    });
    fetch(`/api/catalogue?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { data?: CatalogueProduct[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Catalogue could not be loaded");
        return payload.data ?? [];
      })
      .then(setProducts)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Catalogue could not be loaded");
        setProducts([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [availability, category, maxPrice, query, sort]);

  const selectedCategoryLabel = useMemo(() => categoryOptions.find(([, slug]) => slug === category)?.[0] ?? "All pieces", [category]);
  const add = (name: string) => {
    setNotice(`${name} is ready to add once your bag is connected.`);
    window.setTimeout(() => setNotice(""), 2400);
  };

  return <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 pb-20 pt-8 text-[#27362d] lg:px-8 lg:pt-14">
    <div className="mx-auto max-w-[1240px]">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="eyebrow">The full collection</p><h1 className="section-title">Useful things, thoughtfully chosen.</h1></div><p className="max-w-[290px] text-sm leading-6 text-[#718078]">Small upgrades for desks, kitchens, shelves, and the spaces between.</p></div>
      <div className="mt-10 grid gap-3 rounded-[1.25rem] border border-[#e2d9cd] bg-[#fffaf3] p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:p-4"><label className="relative flex items-center"><Search size={17} className="absolute left-3 text-[#8d9a90]" /><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" className="h-11 w-full rounded-full bg-[#f5efe6] pl-10 pr-4 text-sm outline-none ring-[#b25d49] placeholder:text-[#9b9084] focus:ring-2" /></label><label className="sr-only" htmlFor="category">Category</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-full bg-[#f5efe6] px-4 text-sm text-[#536259] outline-none focus:ring-2 focus:ring-[#b25d49]">{categoryOptions.map(([label, slug]) => <option key={slug} value={slug}>{label}</option>)}</select><label className="sr-only" htmlFor="availability">Availability</label><select id="availability" value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-11 rounded-full bg-[#f5efe6] px-4 text-sm text-[#536259] outline-none focus:ring-2 focus:ring-[#b25d49]"><option value="all">All availability</option><option value="available">In stock</option><option value="soldout">Sold out</option></select><label className="sr-only" htmlFor="sort">Sort products</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-full bg-[#f5efe6] px-4 text-sm text-[#536259] outline-none focus:ring-2 focus:ring-[#b25d49]"><option value="newest">Newest</option><option value="best">Best rated</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#718078]"><p>{loading ? "Loading collection…" : `${products.length} pieces`}</p><label className="flex items-center gap-3">Up to {formatInr(maxPrice)}<input type="range" min="300" max="2500" step="50" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} className="accent-[#a6503d]" aria-label="Maximum price" /></label><button type="button" onClick={() => { setQuery(""); setCategory(""); setAvailability("all"); setSort("newest"); setMaxPrice(2500); }} className="inline-flex items-center gap-2 font-semibold text-[#a6503d]"><SlidersHorizontal size={15} /> Reset filters</button></div>
      {error && <div role="alert" className="mt-8 rounded-[1.5rem] border border-[#e5b7aa] bg-[#f7ddd5] px-6 py-10 text-center"><p className="eyebrow justify-center">Catalogue unavailable</p><h2 className="mt-3 font-display text-3xl tracking-[-0.05em]">The collection is taking a moment.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#718078]">{error}. Check your database configuration and try again.</p><button type="button" onClick={() => window.location.reload()} className="button-secondary mt-6">Try again</button></div>}
      {!error && loading && <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading products">{[1, 2, 3, 4].map((item) => <div key={item} className="skeleton-card" />)}</div>}
      {!error && !loading && products.length === 0 && <div className="mt-8 rounded-[1.5rem] border border-dashed border-[#cbbfb1] bg-[#fffaf3] px-6 py-20 text-center"><p className="eyebrow justify-center">Nothing matched</p><h2 className="mt-3 font-display text-3xl tracking-[-0.05em]">Try a softer search.</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#718078]">Clear a filter or search for a room, material, or product name.</p><p className="mt-2 text-xs text-[#9b9084]">Current category: {selectedCategoryLabel}</p></div>}
      {!error && !loading && products.length > 0 && <div className="mt-8 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => { const price = product.minPricePaise ?? 0; return <article key={product.id} className="group"><div className="product-image relative overflow-hidden rounded-[1.5rem] bg-[#e8e0d4]"><img src={product.image?.url ?? "/nivara-editorial.png"} alt={product.image?.altText ?? product.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-3 top-3 rounded-full bg-[#fffaf3]/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#314338]">{product.stockAvailable ? product.category.name : "Sold out"}</span><button type="button" aria-label={`Save ${product.name}`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-[#fffaf3]/90"><Heart size={16} /></button>{product.stockAvailable && <button type="button" onClick={() => add(product.name)} className="absolute bottom-3 left-3 right-3 rounded-full bg-[#314338] px-4 py-3 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">Add to bag</button>}</div><div className="mt-4 flex justify-between gap-3"><div><Link href={`/product/${product.slug}`} className="font-semibold hover:text-[#a6503d]">{product.name}</Link><p className="mt-1 flex items-center gap-1 text-sm text-[#718078]">{product.category.name}{product.rating !== null && <><span>·</span><Star size={12} fill="#c6674f" color="#c6674f" /> {product.rating.toFixed(1)}</>}</p></div><p className="font-semibold">{formatPaise(price)}</p></div></article>; })}</div>}
    </div>
    {notice && <output aria-live="polite" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#314338] px-5 py-3 text-sm font-semibold text-white shadow-xl">{notice}</output>}
  </main>;
}
