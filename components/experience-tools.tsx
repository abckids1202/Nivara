'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/prefer-tag-over-role */

import Link from 'next/link';
import {
  ArrowUp,
  ChevronRight,
  Menu,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/cart-provider';

type SearchSuggestion = {
  id: string;
  name: string;
  slug: string;
  category: { name: string };
};

export function StoreHeader({
  cartCount = 0,
  compact = false,
}: {
  cartCount?: number;
  compact?: boolean;
}) {
  const cart = useCart();
  const displayedCartCount = cartCount || cart.count;
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const [dark, setDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.localStorage.getItem('nivara-theme') === 'dark' ||
        (!window.localStorage.getItem('nivara-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)),
  );

  useEffect(() => {
    const stored = window.localStorage.getItem('nivara-theme');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!searchOpen || !query.trim()) {
      const resetTimer = window.setTimeout(() => {
        setSuggestions([]);
        setSuggestionsLoading(false);
        setSuggestionsError(false);
        setActiveSuggestion(-1);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSuggestionsLoading(true);
      setSuggestionsError(false);
      setActiveSuggestion(-1);
      void fetch(`/api/catalogue?q=${encodeURIComponent(query.trim())}&pageSize=4`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((response) => {
          if (!response.ok) throw new Error('Search suggestions unavailable');
          return response.json();
        })
        .then((payload: { data?: SearchSuggestion[] } | null) =>
          setSuggestions(payload?.data ?? []),
        )
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setActiveSuggestion(-1);
            setSuggestionsError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSuggestionsLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    if (!mobileOpen) return;
    const firstControl = mobileMenuRef.current?.querySelector<HTMLElement>(
      'a, button',
    );
    firstControl?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);
  const selectSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    window.location.href = `/product/${suggestion.slug}`;
  };
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
      setActiveSuggestion(-1);
      searchButtonRef.current?.focus();
      return;
    }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
    }
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('nivara-theme', next ? 'dark' : 'light');
  };
  const closeMenu = () => setMobileOpen(false);

  return (
    <>
      {!compact && (
        <div className="announcement-bar">
          Free delivery on orders over ₹999 <span aria-hidden="true">·</span>{' '}
          Thoughtful things for everyday living
        </div>
      )}
      <header className={`site-nav ${scrolled ? 'site-nav-scrolled' : ''}`}>
        <div className="mx-auto flex h-[4.75rem] max-w-[1240px] items-center justify-between gap-4 px-5 lg:px-8">
          <Link href="/" className="brand-mark" aria-label="Nivara home">
            <span className="brand-icon">N</span>
            <span className="font-display text-2xl font-semibold tracking-[-0.06em]">
              nivara
            </span>
          </Link>
          <nav
            className="hidden items-center gap-7 text-sm font-semibold text-[#536259] md:flex"
            aria-label="Primary navigation"
          >
            <Link href="/shop" className="nav-link">
              Shop
            </Link>
            <Link href="/shop?sort=newest" className="nav-link">
              New arrivals
            </Link>
            <Link href="/shop?sort=best" className="nav-link">
              Best sellers
            </Link>
            <Link href="/about" className="nav-link">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Search the collection"
              aria-expanded={searchOpen}
              aria-controls="header-product-search-panel"
              ref={searchButtonRef}
              onClick={() => setSearchOpen((open) => !open)}
              className="icon-button"
            >
              <Search size={18} />
            </button>
            <Link
              href="/account"
              aria-label="Your account"
              className="icon-button hidden sm:grid"
            >
              <span aria-hidden="true" className="text-sm font-semibold">
                ◌
              </span>
            </Link>
            <button
              type="button"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              className="icon-button hidden sm:grid"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link
              href="/checkout"
              aria-label={`Bag with ${displayedCartCount} items`}
              className="icon-button relative"
            >
              <ShoppingBag size={18} />
              {displayedCartCount > 0 && (
                <span className="cart-badge">{displayedCartCount}</span>
              )}
            </Link>
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              ref={menuButtonRef}
              onClick={() => setMobileOpen((open) => !open)}
              className="icon-button md:hidden"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {searchOpen && (
          <search id="header-product-search-panel" className="search-panel">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                window.location.href = `/shop${query ? `?q=${encodeURIComponent(query)}` : ''}`;
              }}
              className="mx-auto max-w-[1240px] px-5 pb-4 lg:px-8"
            >
              <label className="relative block">
                <span className="sr-only">Search products</span>
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9a90]"
                />
                <input
                  id="header-product-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="header-search-suggestions"
                  aria-expanded={suggestions.length > 0}
                  aria-activedescendant={
                    activeSuggestion >= 0
                      ? `header-search-option-${activeSuggestion}`
                      : undefined
                  }
                  aria-busy={suggestionsLoading}
                  ref={searchInputRef}
                  placeholder="Search products, rooms, materials"
                  onKeyDown={handleSearchKeyDown}
                  className="h-12 w-full rounded-full border border-[#d8cec1] bg-[#fffaf3] px-11 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]"
                />
              </label>
              {suggestionsLoading && (
                <output className="mt-2 block px-4 text-xs text-[#718078]">
                  Loading suggestions…
                </output>
              )}
              {suggestionsError && !suggestionsLoading && (
                <output className="mt-2 block px-4 text-xs text-[#a44f3d]">
                  Suggestions are temporarily unavailable. Press Enter to search.
                </output>
              )}
              {suggestions.length > 0 && (
                <nav
                  id="header-search-suggestions"
                  role="listbox"
                  aria-label="Product suggestions"
                  className="search-suggestions"
                >
                  <ul>
                    {suggestions.map((product, index) => (
                      <li key={product.id}>
                        <Link
                          href={`/product/${product.slug}`}
                          onClick={() => setSearchOpen(false)}
                          id={`header-search-option-${index}`}
                          role="option"
                          aria-selected={activeSuggestion === index}
                          onMouseEnter={() => setActiveSuggestion(index)}
                          className="search-suggestion"
                        >
                          <span>
                            <strong>{product.name}</strong>
                            <small>{product.category.name}</small>
                          </span>
                          <ChevronRight size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </form>
          </search>
        )}
        {mobileOpen && (
          <nav
            id="mobile-navigation"
            ref={mobileMenuRef}
            className="mobile-nav md:hidden"
            aria-label="Mobile navigation"
          >
            <Link href="/shop" onClick={closeMenu}>
              Shop
            </Link>
            <Link href="/shop?sort=newest" onClick={closeMenu}>
              New arrivals
            </Link>
            <Link href="/shop?sort=best" onClick={closeMenu}>
              Best sellers
            </Link>
            <Link href="/about" onClick={closeMenu}>
              About
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-2 text-left"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}{' '}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
          </nav>
        )}
      </header>
    </>
  );
}

export function ExperienceTools() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
      setShowTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        }),
      { threshold: 0.12 },
    );
    document
      .querySelectorAll('.reveal')
      .forEach((element) => revealObserver.observe(element));
    return () => {
      window.removeEventListener('scroll', update);
      revealObserver.disconnect();
    };
  }, []);
  return (
    <>
      <div
        className="scroll-progress"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden="true"
      />
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="back-to-top"
          aria-label="Back to top"
        >
          <ArrowUp size={17} />
        </button>
      )}
    </>
  );
}

export function MagneticLink({
  href,
  children,
  className = 'button-primary',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${className} magnetic-link`}
      onPointerMove={(event) => {
        const target = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - target.left - target.width / 2) * 0.12;
        const y = (event.clientY - target.top - target.height / 2) * 0.12;
        event.currentTarget.style.transform = `translate(${x}px, ${y}px)`;
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.transform = '';
      }}
    >
      {children}
    </Link>
  );
}
