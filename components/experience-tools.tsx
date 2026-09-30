"use client";

import Link from "next/link";
import { ArrowUp, ChevronRight, Menu, Moon, Search, ShoppingBag, Sun, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { products } from "@/lib/demo-data";
import { useCart } from "@/components/cart-provider";

export function StoreHeader({ cartCount = 0, compact = false }: { cartCount?: number; compact?: boolean }) {
  const cart = useCart();
  const displayedCartCount = cartCount || cart.count;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(() => typeof window !== "undefined" && (window.localStorage.getItem("nivara-theme") === "dark" || (!window.localStorage.getItem("nivara-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)));

  useEffect(() => {
    const stored = window.localStorage.getItem("nivara-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const suggestions = useMemo(() => query.trim() ? products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : [], [query]);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("nivara-theme", next ? "dark" : "light");
  };
  const closeMenu = () => setMobileOpen(false);

  return <>
    {!compact && <div className="announcement-bar">Free delivery on orders over ₹999 <span aria-hidden="true">·</span> Thoughtful things for everyday living</div>}
    <header className={`site-nav ${scrolled ? "site-nav-scrolled" : ""}`}>
      <div className="mx-auto flex h-[4.75rem] max-w-[1240px] items-center justify-between gap-4 px-5 lg:px-8">
        <Link href="/" className="brand-mark" aria-label="Nivara home"><span className="brand-icon">N</span><span className="font-display text-2xl font-semibold tracking-[-0.06em]">nivara</span></Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-[#536259] md:flex" aria-label="Primary navigation">
          <Link href="/shop" className="nav-link">Shop</Link><Link href="/shop?sort=newest" className="nav-link">New arrivals</Link><Link href="/shop?sort=best" className="nav-link">Best sellers</Link><Link href="/about" className="nav-link">About</Link>
        </nav>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Search the collection" aria-expanded={searchOpen} onClick={() => setSearchOpen((open) => !open)} className="icon-button"><Search size={18} /></button>
          <Link href="/account" aria-label="Your account" className="icon-button hidden sm:grid"><span aria-hidden="true" className="text-sm font-semibold">◌</span></Link>
          <button type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme} className="icon-button hidden sm:grid">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <Link href="/checkout" aria-label={`Bag with ${displayedCartCount} items`} className="icon-button relative"><ShoppingBag size={18} />{displayedCartCount > 0 && <span className="cart-badge">{displayedCartCount}</span>}</Link>
          <button type="button" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className="icon-button md:hidden">{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </div>
      {searchOpen && <search className="search-panel"><form onSubmit={(event) => { event.preventDefault(); window.location.href = `/shop${query ? `?q=${encodeURIComponent(query)}` : ""}`; }} className="mx-auto max-w-[1240px] px-5 pb-4 lg:px-8"><label className="relative block"><span className="sr-only">Search products</span><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9a90]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, rooms, materials" className="h-12 w-full rounded-full border border-[#d8cec1] bg-[#fffaf3] px-11 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]" /></label>{suggestions.length > 0 && <div className="search-suggestions">{suggestions.map((product) => <Link key={product.id} href={`/product/${product.slug}`} onClick={() => setSearchOpen(false)} className="search-suggestion"><span><strong>{product.name}</strong><small>{product.category}</small></span><ChevronRight size={16} /></Link>)}</div>}</form></search>}
      {mobileOpen && <nav className="mobile-nav md:hidden" aria-label="Mobile navigation"><Link href="/shop" onClick={closeMenu}>Shop</Link><Link href="/shop?sort=newest" onClick={closeMenu}>New arrivals</Link><Link href="/shop?sort=best" onClick={closeMenu}>Best sellers</Link><Link href="/about" onClick={closeMenu}>About</Link><button type="button" onClick={toggleTheme} className="flex items-center gap-2 text-left">{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Light mode" : "Dark mode"}</button></nav>}
    </header>
  </>;
}

export function ExperienceTools() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; setProgress(max > 0 ? (window.scrollY / max) * 100 : 0); setShowTop(window.scrollY > 500); };
    window.addEventListener("scroll", update, { passive: true });
    update();
    const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add("is-visible"); }), { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
    return () => { window.removeEventListener("scroll", update); revealObserver.disconnect(); };
  }, []);
  return <><div className="scroll-progress" style={{ transform: `scaleX(${progress / 100})` }} aria-hidden="true" />{showTop && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="back-to-top" aria-label="Back to top"><ArrowUp size={17} /></button>}</>;
}

export function MagneticLink({ href, children, className = "button-primary" }: { href: string; children: React.ReactNode; className?: string }) {
  return <Link href={href} className={`${className} magnetic-link`} onPointerMove={(event) => { const target = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - target.left - target.width / 2) * 0.12; const y = (event.clientY - target.top - target.height / 2) * 0.12; event.currentTarget.style.transform = `translate(${x}px, ${y}px)`; }} onPointerLeave={(event) => { event.currentTarget.style.transform = ""; }}>{children}</Link>;
}
