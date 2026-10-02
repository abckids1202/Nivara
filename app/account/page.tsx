'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  LogOut,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { useCart } from '@/components/cart-provider';
import { formatInr } from '@/lib/format';

type Mode = 'login' | 'signup' | 'reset';
type OrderItem = {
  id: string;
  productName: string;
  variantName: string;
  unitPricePaise: number;
  quantity: number;
  variant: { productId: string };
};
type AccountOrder = {
  id: string;
  orderNumber: string;
  totalPaise: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  createdAt: string;
  items: OrderItem[];
  shipment: {
    courierName: string | null;
    trackingReference: string | null;
  } | null;
};
type AccountAddress = {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};
type WishlistItem = {
  id: string;
  productId: string;
  product: {
    name: string;
    slug: string;
    images: Array<{ url: string; altText: string }>;
    variants: Array<{ pricePaise: number }>;
  };
};

const inputClass =
  'h-11 rounded-xl border border-[#d8cec1] bg-[#f8f4ee] px-3 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]';
const statusLabel = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export default function AccountPage() {
  const { refresh: refreshCart } = useCart();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [address, setAddress] = useState({
    label: '',
    fullName: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const strength = useMemo(
    () =>
      [
        password.length >= 8,
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^A-Za-z0-9]/.test(password),
      ].filter(Boolean).length,
    [password],
  );

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError('');
    try {
      const results = await Promise.all([
        fetch('/api/account/orders', { cache: 'no-store' }),
        fetch('/api/account/addresses', { cache: 'no-store' }),
        fetch('/api/wishlist', { cache: 'no-store' }),
      ]);
      const [ordersResponse, addressesResponse, wishlistResponse] = results;
      if (!ordersResponse.ok || !addressesResponse.ok || !wishlistResponse.ok)
        throw new Error('Some account details could not be loaded.');

      setOrders(
        ((await ordersResponse.json()) as { data?: AccountOrder[] }).data ?? [],
      );
      setAddresses(
        ((await addressesResponse.json()) as { data?: AccountAddress[] })
          .data ?? [],
      );
      setWishlist(
        ((await wishlistResponse.json()) as { data?: WishlistItem[] }).data ??
          [],
      );
    } catch (reason: unknown) {
      setDashboardError(
        reason instanceof Error
          ? reason.message
          : 'Your account details could not be loaded.',
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    fetch('/api/account/profile', { cache: 'no-store' })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as {
              data?: { email?: string; displayName?: string | null };
            })
          : null,
      )
      .then((result) => {
        if (result?.data?.email) {
          setEmail(result.data.email);
          setDisplayName(result.data.displayName ?? '');
          setSignedIn(true);
          void refreshCart();
          void loadDashboard();
        }
      })
      .catch(() => undefined);
  }, [refreshCart]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!email.includes('@')) return setMessage('Enter a valid email address.');
    if (mode !== 'reset' && password.length < 8)
      return setMessage('Use at least 8 characters for your password.');
    setBusy(true);
    const endpoint =
      mode === 'login'
        ? '/api/auth/login'
        : mode === 'signup'
          ? '/api/auth/signup'
          : '/api/auth/password-reset';
    const body = mode === 'reset' ? { email } : { email, password };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { needsVerification?: boolean };
      };
      if (!response.ok)
        throw new Error(
          result.error ?? 'Something went wrong. Please try again.',
        );
      if (mode === 'reset')
        setMessage(
          'If that address is registered, a reset link is on its way.',
        );
      else if (mode === 'signup' && result.data?.needsVerification)
        setMessage('Check your email to verify your Nivara account.');
      else {
        await fetch('/api/cart/merge', { method: 'POST' });
        await refreshCart();
        setSignedIn(true);
        setMessage('You’re signed in.');
        void loadDashboard();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProfile(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      setMessage(
        response.ok ? 'Profile saved.' : 'Profile could not be saved.',
      );
    } catch {
      setMessage('Profile could not be saved. Please try again.');
    }
  }
  async function saveAddress(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch('/api/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...address, country: 'IN' }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setMessage(result.error ?? 'Address could not be saved.');
        return;
      }
      setAddress({
        label: '',
        fullName: '',
        line1: '',
        city: '',
        state: '',
        postalCode: '',
      });
      setShowAddressForm(false);
      setMessage('Address saved.');
      void loadDashboard();
    } catch {
      setMessage('Address could not be saved. Please try again.');
    }
  }
  async function deleteAddress(id: string) {
    try {
      const response = await fetch(
        `/api/account/addresses?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setMessage('Address could not be removed.');
        return;
      }
      setMessage('Address removed.');
      void loadDashboard();
    } catch {
      setMessage('Address could not be removed. Please try again.');
    }
  }
  async function removeWishlist(productId: string) {
    try {
      const response = await fetch(
        `/api/wishlist?productId=${encodeURIComponent(productId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setMessage('Saved piece could not be removed.');
        return;
      }
      setWishlist((items) =>
        items.filter((item) => item.productId !== productId),
      );
      setMessage('Saved piece removed.');
    } catch {
      setMessage('Saved piece could not be removed. Please try again.');
    }
  }

  if (signedIn)
    return (
      <main className="page-transition min-h-screen bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[1100px]">
          <Link href="/" className="brand-mark">
            <span className="brand-icon">N</span>
            <span className="font-display text-2xl font-semibold tracking-[-0.06em]">
              nivara
            </span>
          </Link>
          <div className="mt-14 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Your account</p>
              <h1 className="mt-3 font-display text-6xl tracking-[-0.08em]">
                Welcome back.
              </h1>
              <p className="mt-4 text-[#637268]">
                Your quiet little corner for orders, saved pieces, and
                addresses.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                setSignedIn(false);
                await refreshCart();
              }}
              className="button-secondary"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
          {message && (
            <output className="mt-6 rounded-xl bg-[#e7eee5] px-4 py-3 text-sm text-[#536259]">
              {message}
            </output>
          )}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <a href="#orders" className="account-card">
              <Package size={20} />
              <span>
                <strong>Order history</strong>
                <small>
                  {orders.length
                    ? `${orders.length} order${orders.length === 1 ? '' : 's'}`
                    : 'No orders yet'}
                </small>
              </span>
              <ArrowRight size={16} />
            </a>
            <a href="#saved" className="account-card">
              <Heart size={20} />
              <span>
                <strong>Saved pieces</strong>
                <small>
                  {wishlist.length
                    ? `${wishlist.length} saved`
                    : 'Keep a list for later'}
                </small>
              </span>
              <ArrowRight size={16} />
            </a>
            <a href="#addresses" className="account-card">
              <MapPin size={20} />
              <span>
                <strong>Addresses</strong>
                <small>
                  {addresses.length
                    ? `${addresses.length} saved`
                    : 'Add a delivery address'}
                </small>
              </span>
              <ArrowRight size={16} />
            </a>
          </div>
          {dashboardLoading && (
            <output className="mt-8 block text-sm text-[#718078]">
              Loading your account details…
            </output>
          )}
          {dashboardError && !dashboardLoading && (
            <div
              role="alert"
              className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f7ddd5] p-5 text-sm text-[#8f3f31]"
            >
              <span>{dashboardError}</span>
              <button
                type="button"
                onClick={() => void loadDashboard()}
                className="rounded-full border border-[#c98271] px-4 py-2 font-semibold text-[#8f3f31] hover:bg-[#f1cfc5]"
              >
                Try again
              </button>
            </div>
          )}
          <section
            id="orders"
            className="mt-10 rounded-[1.5rem] bg-[#fffaf3] p-7"
          >
            <p className="eyebrow">Order history</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.05em]">
              Your recent orders
            </h2>
            {orders.length ? (
              <div className="mt-5 grid gap-4">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-[#e2d9cd] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
                          className="font-semibold text-[#a6503d] hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="text-sm text-[#718078]">
                          {new Date(order.createdAt).toLocaleDateString(
                            'en-IN',
                            { dateStyle: 'medium' },
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatInr(Math.round(order.totalPaise / 100))}
                        </p>
                        <p className="text-xs uppercase tracking-[0.12em] text-[#a6503d]">
                          {statusLabel(order.paymentStatus)} ·{' '}
                          {statusLabel(order.fulfilmentStatus)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-[#637268]">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-4"
                        >
                          <span>
                            {item.productName} · {item.variantName} ×{' '}
                            {item.quantity}
                          </span>
                          <span>
                            {formatInr(Math.round(item.unitPricePaise / 100))}
                          </span>
                        </div>
                      ))}
                    </div>
                    {order.shipment?.trackingReference && (
                      <p className="mt-4 text-sm text-[#637268]">
                        {order.shipment.courierName ?? 'Shipment'}:{' '}
                        {order.shipment.trackingReference}
                      </p>
                    )}
                    {order.paymentStatus === 'PAID' &&
                      order.fulfilmentStatus === 'DELIVERED' &&
                      order.items.map((item) => (
                        <ReviewForm key={`review-${item.id}`} item={item} />
                      ))}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[#718078]">
                Completed orders will appear here.
              </p>
            )}
          </section>
          <section
            id="saved"
            className="mt-6 rounded-[1.5rem] bg-[#fffaf3] p-7"
          >
            <p className="eyebrow">Wishlist</p>
            <h2 className="mt-2 font-display text-3xl tracking-[-0.05em]">
              Saved pieces
            </h2>
            {wishlist.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {wishlist.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 rounded-2xl border border-[#e2d9cd] p-3"
                  >
                    <img
                      src={
                        item.product.images[0]?.url ?? '/nivara-editorial.png'
                      }
                      alt={item.product.images[0]?.altText ?? item.product.name}
                      className="h-24 w-20 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="font-semibold hover:text-[#a6503d]"
                      >
                        {item.product.name}
                      </Link>
                      <p className="mt-1 text-sm text-[#718078]">
                        {item.product.variants[0]
                          ? formatInr(
                              Math.round(
                                item.product.variants[0].pricePaise / 100,
                              ),
                            )
                          : 'Price unavailable'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void removeWishlist(item.productId)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#a6503d]"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-[#718078]">
                Save pieces from the product page to find them here.
              </p>
            )}
          </section>
          <section
            id="addresses"
            className="mt-6 rounded-[1.5rem] bg-[#fffaf3] p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Delivery addresses</p>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.05em]">
                  Where should we deliver?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressForm((value) => !value)}
                className="button-secondary"
              >
                <Plus size={16} /> {showAddressForm ? 'Close' : 'Add address'}
              </button>
            </div>
            {showAddressForm && (
              <form
                onSubmit={saveAddress}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                <input
                  required
                  aria-label="Address label"
                  placeholder="Label (e.g. Home)"
                  value={address.label}
                  onChange={(event) =>
                    setAddress({ ...address, label: event.target.value })
                  }
                  className={inputClass}
                />
                <input
                  required
                  aria-label="Full name"
                  placeholder="Full name"
                  value={address.fullName}
                  onChange={(event) =>
                    setAddress({ ...address, fullName: event.target.value })
                  }
                  className={inputClass}
                />
                <input
                  required
                  aria-label="Address line"
                  placeholder="Address line"
                  value={address.line1}
                  onChange={(event) =>
                    setAddress({ ...address, line1: event.target.value })
                  }
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  required
                  aria-label="City"
                  placeholder="City"
                  value={address.city}
                  onChange={(event) =>
                    setAddress({ ...address, city: event.target.value })
                  }
                  className={inputClass}
                />
                <input
                  required
                  aria-label="State"
                  placeholder="State"
                  value={address.state}
                  onChange={(event) =>
                    setAddress({ ...address, state: event.target.value })
                  }
                  className={inputClass}
                />
                <input
                  required
                  aria-label="PIN code"
                  pattern="[0-9]{6}"
                  placeholder="PIN code"
                  value={address.postalCode}
                  onChange={(event) =>
                    setAddress({ ...address, postalCode: event.target.value })
                  }
                  className={inputClass}
                />
                <button type="submit" className="button-primary sm:col-span-2">
                  Save address
                </button>
              </form>
            )}
            {addresses.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {addresses.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 rounded-2xl border border-[#e2d9cd] p-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {item.label || 'Address'} · {item.fullName}
                      </p>
                      <p className="mt-1 leading-6 text-[#637268]">
                        {item.line1}, {item.city}, {item.state}{' '}
                        {item.postalCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${item.label || 'address'}`}
                      onClick={() => void deleteAddress(item.id)}
                      className="text-[#a6503d]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              !showAddressForm && (
                <p className="mt-5 text-sm text-[#718078]">
                  No saved addresses yet.
                </p>
              )
            )}
          </section>
          <section className="mt-6 rounded-[1.5rem] bg-[#fffaf3] p-7">
            <p className="eyebrow">Personal details</p>
            <form
              onSubmit={saveProfile}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <input
                aria-label="Display name"
                placeholder="Your display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={`${inputClass} flex-1`}
              />
              <button type="submit" className="button-secondary">
                Save profile
              </button>
            </form>
            <p className="mt-4 text-sm text-[#718078]">
              Email:{' '}
              <span className="font-semibold text-[#27362d]">{email}</span>
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-[#637268]">
              <ShieldCheck size={16} className="text-[#a6503d]" /> Email
              verification is managed securely by Supabase Auth.
            </div>
          </section>
        </div>
      </main>
    );

  return (
    <main className="page-transition grid min-h-screen place-items-center bg-[#f8f4ee] px-5 py-10 text-[#27362d]">
      <div className="w-full max-w-md rounded-[2rem] bg-[#fffaf3] p-8 shadow-[0_18px_55px_rgba(52,64,53,0.1)]">
        <Link href="/" className="brand-mark">
          <span className="brand-icon">N</span>
          <span className="font-display text-2xl font-semibold tracking-[-0.06em]">
            nivara
          </span>
        </Link>
        <p className="eyebrow mt-10">Your Nivara account</p>
        <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
          {mode === 'login'
            ? 'Welcome back.'
            : mode === 'signup'
              ? 'Make it yours.'
              : 'Reset your password.'}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#637268]">
          {mode === 'login'
            ? 'Sign in to see orders, saved pieces, and delivery details.'
            : mode === 'signup'
              ? 'Create an account for a faster, calmer checkout.'
              : 'We’ll send a secure reset link to your email.'}
        </p>
        <form onSubmit={submit} className="mt-7 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
          {mode !== 'reset' && (
            <label className="grid gap-2 text-sm font-semibold">
              Password
              <input
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="At least 8 characters"
                className={inputClass}
              />
              {mode === 'signup' && (
                <span className="password-meter" aria-live="polite">
                  <span style={{ width: `${strength * 25}%` }} />
                  {strength < 2
                    ? 'Use a mix of letters, numbers, and symbols'
                    : strength < 4
                      ? 'Almost there'
                      : 'Strong password'}
                </span>
              )}
            </label>
          )}
          {message && (
            <output
              aria-live="polite"
              className="rounded-xl bg-[#e7eee5] px-4 py-3 text-sm leading-5 text-[#536259]"
            >
              {message}
            </output>
          )}
          <button
            type="submit"
            disabled={busy}
            className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-60"
          >
            {busy
              ? 'Working…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>
        </form>
        <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm font-semibold text-[#a6503d]">
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => setMode('signup')}>
                Create account
              </button>
              <button type="button" onClick={() => setMode('reset')}>
                Forgot password?
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button type="button" onClick={() => setMode('login')}>
              Back to sign in
            </button>
          )}
        </div>
        <Link
          href="/"
          className="mt-7 block text-center text-sm font-semibold text-[#a6503d]"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}

function ReviewForm({ item }: { item: OrderItem }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: item.variant.productId,
        orderItemId: item.id,
        rating,
        body,
        displayName,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (response.ok) setSubmitted(true);
    else setMessage(result.error ?? 'Review could not be submitted.');
    setBusy(false);
  }
  if (submitted)
    return (
      <output
        aria-live="polite"
        className="mt-5 block rounded-xl bg-[#e7eee5] p-4 text-sm text-[#536259]"
      >
        Review submitted for moderation. Thank you for sharing how it feels in
        your home.
      </output>
    );
  return (
    <form onSubmit={submit} className="mt-5 rounded-xl bg-[#f8f4ee] p-4">
      <p className="text-sm font-semibold">Review {item.productName}</p>
      <div className="mt-3 flex gap-1">
        <select
          aria-label="Review rating"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className={inputClass}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} stars
            </option>
          ))}
        </select>
        <input
          required
          aria-label="Review display name"
          minLength={2}
          maxLength={40}
          placeholder="Name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      <textarea
        required
        aria-label="Review text"
        minLength={10}
        maxLength={2000}
        placeholder="How did it feel in your home?"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-3 min-h-20 w-full rounded-xl border border-[#d8cec1] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={busy}
          className="button-secondary disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Submit review'}
        </button>
        {message && (
          <output className="text-xs text-[#637268]">{message}</output>
        )}
      </div>
    </form>
  );
}
