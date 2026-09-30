"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Package, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { StoreHeader } from "@/components/experience-tools";
import { formatInr } from "@/lib/demo-data";

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  category: { name: string };
  variants: Array<{ id: string; name: string; sku: string; pricePaise: number; stockOnHand: number; stockReserved: number }>;
};

const formatPaise = (paise: number) => formatInr(Math.round(paise / 100));

export default function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [deltas, setDeltas] = useState<Record<string, string>>({});

  async function loadProducts() {
    setLoading(true);
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { data?: AdminProduct[]; error?: string };
    if (!response.ok) setError(response.status === 401 || response.status === 403 ? "Administrator authentication is required to manage the catalogue." : payload.error ?? "Catalogue could not be loaded");
    else { setProducts(payload.data ?? []); setError(""); }
    setLoading(false);
  }

  useEffect(() => { queueMicrotask(() => { void loadProducts(); }); }, []);

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.category.name} ${product.slug}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const stats = useMemo(() => {
    const variants = products.flatMap((product) => product.variants);
    return { published: products.filter((product) => product.status === "PUBLISHED").length, lowStock: variants.filter((variant) => variant.stockOnHand - variant.stockReserved < 7).length, units: variants.reduce((sum, variant) => sum + variant.stockOnHand, 0) };
  }, [products]);

  async function updateStatus(product: AdminProduct) {
    setBusyId(product.id);
    const nextStatus = product.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setNotice(payload.error ?? "Product status could not be updated");
    else { setNotice(`${product.name} is now ${nextStatus.toLowerCase()}.`); await loadProducts(); }
    setBusyId("");
  }

  async function archive(product: AdminProduct) {
    if (!window.confirm(`Archive ${product.name}? It will no longer appear in the storefront.`)) return;
    setBusyId(product.id);
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setNotice(payload.error ?? "Product could not be archived");
    else { setNotice(`${product.name} was archived.`); await loadProducts(); }
    setBusyId("");
  }

  async function adjustStock(variantId: string) {
    const delta = Number(deltas[variantId]);
    if (!Number.isInteger(delta) || delta === 0) { setNotice("Enter a non-zero whole-number stock adjustment."); return; }
    const response = await fetch("/api/admin/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantityDelta: delta, reason: "Admin catalogue adjustment" }) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setNotice(payload.error ?? "Stock could not be adjusted");
    else { setNotice("Stock adjustment saved and audited."); setDeltas((current) => ({ ...current, [variantId]: "" })); await loadProducts(); }
  }

  return <><StoreHeader compact /><main className="min-h-screen bg-[#f3f5f0] px-5 pb-20 pt-10 text-[#27362d] lg:px-8"><div className="mx-auto max-w-[1240px]"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a6503d]"><ArrowLeft size={15} /> Storefront</Link><p className="eyebrow mt-8">Store operations</p><h1 className="mt-3 font-display text-5xl tracking-[-0.07em]">Catalogue control.</h1><p className="mt-3 text-[#718078]">Changes are protected, auditable, and reflected in the storefront.</p></div><div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 text-xs font-semibold text-[#536259]"><ShieldCheck size={16} className="text-[#6b8b67]" /> Server-authorized admin area</div></div>{error && <div role="alert" className="mt-8 rounded-2xl border border-[#e5b7aa] bg-[#f7ddd5] p-6"><p className="font-semibold text-[#8f3f31]">{error}</p><p className="mt-2 text-sm text-[#718078]">Sign in with an administrator account, then return here.</p><Link href="/account" className="button-secondary mt-5">Open account</Link><button type="button" onClick={() => void loadProducts()} className="button-primary ml-3 mt-5">Try again</button></div>}{!error && <><div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-[#314338] p-5 text-white"><ShoppingBag size={20} className="text-[#f2c1b2]" /><p className="mt-7 text-sm text-[#d7e0d4]">Published products</p><p className="mt-1 text-3xl font-bold">{stats.published}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><AlertTriangle size={20} className="text-[#b87939]" /><p className="mt-7 text-sm text-[#718078]">Low-stock variants</p><p className="mt-1 text-3xl font-bold">{stats.lowStock}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><Package size={20} className="text-[#a6503d]" /><p className="mt-7 text-sm text-[#718078]">Units on hand</p><p className="mt-1 text-3xl font-bold">{stats.units}</p></div></div><div className="mt-8 rounded-2xl bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="eyebrow">Products</p><h2 className="mt-2 text-xl font-semibold">Manage the collection.</h2></div><label className="relative block sm:w-80"><span className="sr-only">Search products</span><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9a90]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, category, or slug" className="h-11 w-full rounded-full border border-[#d8e0d5] bg-[#f3f5f0] pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]" /></label></div>{loading ? <div className="mt-6 grid gap-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton-card h-20" />)}</div> : filteredProducts.length === 0 ? <p className="mt-6 rounded-xl bg-[#f3f5f0] p-6 text-sm text-[#718078]">No products match this search.</p> : <div className="mt-6 grid gap-3">{filteredProducts.map((product) => <article key={product.id} className="rounded-xl border border-[#e5ebe2] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{product.name}</h3><span className="rounded-full bg-[#e7eee5] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#536259]">{product.status}</span></div><p className="mt-1 text-sm text-[#718078]">{product.category.name} · {product.slug} · {product.variants.length} variants</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setExpandedId((current) => current === product.id ? "" : product.id)} className="button-secondary">{expandedId === product.id ? "Hide variants" : "View variants"}</button>{product.status !== "ARCHIVED" && <button type="button" disabled={busyId === product.id} onClick={() => void updateStatus(product)} className="button-secondary">{product.status === "PUBLISHED" ? "Set draft" : "Publish"}</button>}{product.status !== "ARCHIVED" && <button type="button" disabled={busyId === product.id} onClick={() => void archive(product)} className="button-secondary text-[#a6503d]">Archive</button>}</div></div>{expandedId === product.id && <div className="mt-4 grid gap-3 border-t border-[#e5ebe2] pt-4">{product.variants.map((variant) => <div key={variant.id} className="flex flex-col gap-3 rounded-xl bg-[#f3f5f0] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{variant.name} · {variant.sku}</p><p className="mt-1 text-xs text-[#718078]">{formatPaise(variant.pricePaise)} · {variant.stockOnHand - variant.stockReserved} available ({variant.stockReserved} reserved)</p></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor={`delta-${variant.id}`}>Stock adjustment for {variant.name}</label><input id={`delta-${variant.id}`} value={deltas[variant.id] ?? ""} onChange={(event) => setDeltas((current) => ({ ...current, [variant.id]: event.target.value }))} inputMode="numeric" placeholder="± stock" className="h-9 w-24 rounded-full border border-[#d8e0d5] bg-white px-3 text-xs" /><button type="button" onClick={() => void adjustStock(variant.id)} className="rounded-full bg-[#314338] px-3 py-2 text-xs font-semibold text-white">Adjust</button></div></div>)}</div>}</article>)}</div>}</div></>}</div>{notice && <output aria-live="polite" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#314338] px-5 py-3 text-sm font-semibold text-white shadow-xl">{notice}</output>}</main></>;
}
