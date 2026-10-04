'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { ArrowLeft, Check, ShieldCheck, Trash2 } from 'lucide-react';
import { calculateDeliveryFee, formatInrFromPaise } from '@/lib/money';
import { StoreHeader } from '@/components/experience-tools';
import { useCart } from '@/components/cart-provider';
import { trackEvent } from '@/lib/analytics';

const formatPaise = (paise: number) => formatInrFromPaise(paise);

function cartMutationMessage(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : 'Your bag could not be updated. Please try again.';
}

export default function CheckoutPage() {
  const {
    items,
    loading,
    error: cartError,
    refresh: refreshCart,
    updateItem,
    removeItem,
  } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [guestAccessToken, setGuestAccessToken] = useState('');
  const [paymentPending, setPaymentPending] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState('');
  const purchaseTracked = useRef(false);
  const subtotal = items.reduce(
    (sum, item) => sum + item.variant.pricePaise * item.quantity,
    0,
  );
  const delivery = calculateDeliveryFee(subtotal);
  const total = subtotal + delivery;

  useEffect(() => {
    if (!orderNumber || purchaseTracked.current) return;
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const checkPayment = async () => {
      const endpoint = guestAccessToken
        ? `/api/guest-orders/${encodeURIComponent(guestAccessToken)}`
        : `/api/orders/${encodeURIComponent(orderNumber)}`;
      const response = await fetch(endpoint, { cache: 'no-store' }).catch(
        () => null,
      );
      if (!response?.ok) {
        if (!cancelled)
          setVerificationNotice(
            'We could not refresh payment status. We will keep trying.',
          );
        attempts += 1;
        if (!cancelled && attempts < 10)
          timer = window.setTimeout(() => void checkPayment(), 3000);
        return;
      }
      const payload = (await response?.json().catch(() => ({}))) as {
        paymentStatus?: string;
        data?: { paymentStatus?: string };
      };
      const paymentStatus = payload.paymentStatus ?? payload.data?.paymentStatus;
      if (!cancelled && paymentStatus === 'PAID') {
        purchaseTracked.current = true;
        setVerificationNotice('');
        trackEvent('Purchase');
        return;
      }
      if (!cancelled)
        setVerificationNotice(
          'Payment is still being verified by the payment provider.',
        );
      attempts += 1;
      if (!cancelled && attempts < 10)
        timer = window.setTimeout(() => void checkPayment(), 3000);
      else if (!cancelled)
        setVerificationNotice(
          'Verification is taking longer than expected. Open order status to check again later.',
        );
    };
    void checkPayment();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [guestAccessToken, orderNumber]);

  async function openHostedCheckout(details: {
    orderNumber: string;
    razorpayOrderId: string;
    keyId: string;
    amountPaise: number;
    currency: string;
    guestAccessToken?: string | null;
  }) {
    setGuestAccessToken(details.guestAccessToken ?? '');
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          'script[data-razorpay="true"]',
        );
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener(
            'error',
            () => reject(new Error('Razorpay checkout could not load')),
            { once: true },
          );
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.dataset.razorpay = 'true';
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Razorpay checkout could not load'));
        document.body.appendChild(script);
      });
    }
    if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable');
    const checkout = new window.Razorpay({
      key: details.keyId,
      amount: details.amountPaise,
      currency: details.currency,
      name: 'Nivara',
      description: `Order ${details.orderNumber}`,
      order_id: details.razorpayOrderId,
      handler: () => {
        setPaymentPending(true);
        setOrderNumber(details.orderNumber);
      },
      modal: {
        ondismiss: () => {
          setOrderNumber(details.orderNumber);
          setError(
            'Checkout was closed. Your order remains unpaid until a verified payment is received.',
          );
        },
      },
    });
    checkout.on('payment.failed', (response) => {
      setOrderNumber(details.orderNumber);
      setError(
        response.error?.description ??
          'Payment failed. You can retry from the order status page.',
      );
    });
    checkout.open();
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    trackEvent('CheckoutStart');
    setBusy(true);
    setError('');
    try {
      const values = new FormData(event.currentTarget);
      const field = (name: string) => {
        const value = values.get(name);
        return typeof value === 'string' ? value : '';
      };
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: field('email'),
          fullName: field('fullName'),
          line1: field('line1'),
          city: field('city'),
          state: field('state'),
          postalCode: field('postalCode'),
          country: 'IN',
          items: items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        orderNumber?: string;
        razorpayOrderId?: string;
        keyId?: string;
        amountPaise?: number;
        currency?: string;
        guestAccessToken?: string | null;
        error?: string;
      };
      if (!response.ok)
        setError(payload.error ?? 'Checkout could not be started');
      else if (
        payload.orderNumber &&
        payload.razorpayOrderId &&
        payload.keyId &&
        payload.amountPaise &&
        payload.currency
      )
        try {
          await openHostedCheckout({
            orderNumber: payload.orderNumber,
            razorpayOrderId: payload.razorpayOrderId,
            keyId: payload.keyId,
            amountPaise: payload.amountPaise,
            currency: payload.currency,
            guestAccessToken: payload.guestAccessToken,
          });
        } catch (reason: unknown) {
          setOrderNumber(payload.orderNumber);
          setGuestAccessToken(payload.guestAccessToken ?? '');
          throw reason;
        }
      else {
        setOrderNumber(payload.orderNumber ?? '');
        setGuestAccessToken(payload.guestAccessToken ?? '');
      }
      if (payload.guestAccessToken)
        setGuestAccessToken(payload.guestAccessToken);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Checkout could not be opened',
      );
    } finally {
      setBusy(false);
    }
  }

  if (orderNumber)
    return (
      <>
        <StoreHeader compact />
        <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#f8f4ee] px-5 text-[#27362d]">
          <div className="max-w-md rounded-[2rem] bg-[#fffaf3] p-8 text-center shadow-[0_18px_55px_rgba(52,64,53,0.1)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dce9d9] text-[#314338]">
              <Check />
            </span>
            <p className="eyebrow mt-6 justify-center">
              {paymentPending ? 'Payment submitted' : 'Order created'}
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
              Payment is being verified.
            </h1>
            <p className="mt-4 text-sm leading-6 text-[#637268]">
              Order {orderNumber} is not considered paid by the browser.
              Razorpay webhooks must verify the payment on the server first.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-[#f7ddd5] px-4 py-3 text-left text-sm text-[#8f3f31]"
              >
                {error}
              </p>
            )}
            {verificationNotice && (
              <output
                aria-live="polite"
                className="mt-4 block rounded-xl bg-[#e7eee5] px-4 py-3 text-left text-sm text-[#536259]"
              >
                {verificationNotice}
              </output>
            )}
            {guestAccessToken && (
              <Link
                href={`/guest-order/${encodeURIComponent(guestAccessToken)}`}
                className="button-secondary mt-4 w-full justify-center"
              >
                View guest order status
              </Link>
            )}
            <Link href="/" className="button-primary mt-7">
              Return home
            </Link>
          </div>
        </main>
      </>
    );

  if (loading)
    return (
      <>
        <StoreHeader compact />
        <main className="min-h-screen bg-[#f8f4ee] px-5 py-12 text-[#27362d] lg:px-8">
          <div className="mx-auto max-w-[1120px]">
            <div className="skeleton-card h-16 w-full" />
            <div className="mt-8 grid gap-8 lg:grid-cols-2">
              <div className="skeleton-card h-96" />
              <div className="skeleton-card h-96" />
            </div>
          </div>
        </main>
      </>
    );
  if (cartError || !items.length)
    return (
      <>
        <StoreHeader compact />
        <main className="grid min-h-[calc(100vh-4rem)] place-items-center bg-[#f8f4ee] px-5 text-center text-[#27362d]">
          <div>
            <p className="eyebrow justify-center">Your bag is quiet</p>
            <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
              {cartError ? "We couldn't load your bag." : 'Add something before checkout.'}
            </h1>
            <p className="mt-4 text-sm text-[#718078]">
              {cartError ||
                'Browse the collection and choose a piece for your home.'}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {cartError && (
                <button
                  type="button"
                  onClick={() => void refreshCart()}
                  className="button-primary"
                >
                  Try again
                </button>
              )}
              <Link href="/shop" className="button-secondary">
                Browse the collection
              </Link>
            </div>
          </div>
        </main>
      </>
    );

  return (
    <>
      <StoreHeader compact />
      <main className="min-h-screen bg-[#f8f4ee] px-5 pb-20 pt-9 text-[#27362d] lg:px-8 lg:pt-14">
        <div className="mx-auto max-w-[1120px]">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#a6503d]"
          >
            <ArrowLeft size={15} /> Continue shopping
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <p className="eyebrow">Almost yours</p>
              <h1 className="mt-3 font-display text-5xl tracking-[-0.07em]">
                Checkout
              </h1>
              <form className="mt-8 grid gap-7" onSubmit={submit}>
                <fieldset className="grid gap-4">
                  <legend className="text-lg font-semibold">
                    Contact details
                  </legend>
                  <label className="grid gap-2 text-sm font-semibold">
                    Email
                    <input
                      name="email"
                      required
                      type="email"
                      placeholder="you@example.com"
                      className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                    />
                  </label>
                </fieldset>
                <fieldset className="grid gap-4">
                  <legend className="text-lg font-semibold">
                    Delivery address
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                      Full name
                      <input
                        name="fullName"
                        required
                        placeholder="Your name"
                        className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                      Address
                      <input
                        name="line1"
                        required
                        placeholder="House number and street"
                        className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      City
                      <input
                        name="city"
                        required
                        placeholder="City"
                        className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      State
                      <input
                        name="state"
                        required
                        placeholder="State"
                        className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      PIN code
                      <input
                        name="postalCode"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        placeholder="110001"
                        className="h-12 rounded-xl border border-[#d8cec1] bg-[#fffaf3] px-4 font-normal outline-none focus:ring-2 focus:ring-[#c6674f]"
                      />
                    </label>
                  </div>
                </fieldset>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#f7ddd5] px-4 py-3 text-sm text-[#8f3f31]"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="button-primary w-full justify-center disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                >
                  {busy
                    ? 'Preparing secure checkout…'
                    : 'Continue to Razorpay test checkout'}{' '}
                  <span>→</span>
                </button>
              </form>
            </section>
            <aside className="h-fit rounded-[1.5rem] bg-[#314338] p-6 text-[#fffaf3] lg:sticky lg:top-8">
              <p className="eyebrow text-[#d8c6a8]">Order summary</p>
              <div className="mt-6 grid gap-4 border-b border-white/15 pb-5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 text-sm"
                  >
                    <span>
                      <strong className="block">
                        {item.variant.product.name}
                      </strong>
                      <small className="text-[#d7e0d4]">
                        {item.variant.name} · {item.quantity}
                      </small>
                    </span>
                    <span>
                      {formatPaise(item.variant.pricePaise * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void removeItem(item.id)
                          .then(() => setError(''))
                          .catch((reason: unknown) =>
                            setError(cartMutationMessage(reason)),
                          )
                      }
                      aria-label={`Remove ${item.variant.product.name}`}
                      className="text-[#f2c1b2]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 py-5 text-sm text-[#d7e0d4]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatPaise(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>{delivery ? formatPaise(delivery) : 'Free'}</span>
                </div>
              </div>
              <div className="flex justify-between border-t border-white/15 pt-5 text-lg font-bold">
                <span>Total</span>
                <span>{formatPaise(total)}</span>
              </div>
              <div className="mt-6 flex gap-3 rounded-xl bg-white/10 p-3 text-xs leading-5 text-[#d7e0d4]">
                <ShieldCheck size={18} className="shrink-0" /> Prices and stock
                are rechecked on the server before an order is created.
              </div>
              {items.map((item) => (
                <div
                  key={`qty-${item.id}`}
                  className="mt-4 flex items-center justify-between text-xs text-[#d7e0d4]"
                >
                  <span>{item.variant.product.name}</span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void updateItem(
                          item.id,
                          Math.max(1, item.quantity - 1),
                        )
                          .then(() => setError(''))
                          .catch((reason: unknown) =>
                            setError(cartMutationMessage(reason)),
                          )
                      }
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <strong>{item.quantity}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        void updateItem(item.id, item.quantity + 1)
                          .then(() => setError(''))
                          .catch((reason: unknown) =>
                            setError(cartMutationMessage(reason)),
                          )
                      }
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </span>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
