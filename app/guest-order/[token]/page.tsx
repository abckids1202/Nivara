'use client';

import Link from 'next/link';
import { ArrowLeft, Package, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StoreHeader } from '@/components/experience-tools';
import { formatInr } from '@/lib/format';

type GuestOrder = {
  orderNumber: string;
  paymentStatus: string;
  fulfilmentStatus: string;
  totalPaise: number;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    unitPricePaise: number;
    quantity: number;
  }>;
  shipment: {
    courierName: string | null;
    trackingReference: string | null;
  } | null;
};

const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export default function GuestOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState('');
  const paymentStatus = order?.paymentStatus;
  async function retryPayment() {
    setRetrying(true);
    setError('');
    try {
      const { token } = await params;
      const response = await fetch(
        `/api/guest-orders/${encodeURIComponent(token)}/retry-payment`,
        { method: 'POST' },
      );
      const result = (await response.json().catch(() => ({}))) as {
        data?: {
          orderNumber: string;
          razorpayOrderId: string;
          keyId: string;
          amountPaise: number;
          currency: string;
        };
        error?: string;
      };
      if (!response.ok || !result.data)
        throw new Error(result.error ?? 'Payment retry could not be started.');
      if (!window.Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.dataset.razorpay = 'true';
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Razorpay checkout could not load'));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error('Razorpay checkout is unavailable');
      const checkout = new window.Razorpay({
        key: result.data.keyId,
        amount: result.data.amountPaise,
        currency: result.data.currency,
        name: 'Nivara',
        description: `Order ${result.data.orderNumber}`,
        order_id: result.data.razorpayOrderId,
        handler: () => {
          setNotice('Payment submitted. It will update after server verification.');
          setOrder((current) =>
            current ? { ...current, paymentStatus: 'PENDING' } : current,
          );
        },
        modal: { ondismiss: () => setError('Checkout was closed. The order remains unpaid.') },
      });
      checkout.on('payment.failed', (paymentError) =>
        setError(paymentError.error?.description ?? 'Payment failed. You can retry again.'),
      );
      checkout.open();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Payment retry could not be started.');
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    let active = true;
    void params
      .then(({ token }) =>
        fetch(`/api/guest-orders/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        }),
      )
      .then(async (response) => {
        const result = (await response.json()) as GuestOrder & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            result.error ?? 'This order link is no longer available.',
          );
        return result;
      })
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Order status could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  useEffect(() => {
    if (paymentStatus !== 'PENDING') return;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    const poll = async () => {
      const { token } = await params;
      const response = await fetch(
        `/api/guest-orders/${encodeURIComponent(token)}`,
        { cache: 'no-store' },
      ).catch(() => null);
      if (!response?.ok) {
        if (active)
          setNotice('Order status is temporarily unavailable. We’ll keep trying.');
      } else {
        const result = (await response.json().catch(() => null)) as GuestOrder | null;
        if (active && result?.paymentStatus) {
          setOrder(result);
          setNotice('');
        }
      }
      attempts += 1;
      if (active && attempts < 10)
        timer = window.setTimeout(() => void poll(), 3000);
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [paymentStatus, params]);

  return (
    <>
      <StoreHeader compact />
      <main className="min-h-[calc(100vh-4rem)] bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[760px]">
          {notice && (
            <output
              aria-live="polite"
              className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#314338] px-5 py-3 text-sm font-semibold text-white shadow-xl"
            >
              {notice}
            </output>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#a6503d]"
          >
            <ArrowLeft size={15} /> Back to Nivara
          </Link>
          {loading ? (
            <div className="mt-8 grid gap-4">
              <div className="skeleton-card h-28" />
              <div className="skeleton-card h-48" />
            </div>
          ) : error || !order ? (
            <section className="mt-8 rounded-[1.5rem] bg-[#fffaf3] p-8">
              <p className="eyebrow">Guest order</p>
              <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
                This link is unavailable.
              </h1>
              <p className="mt-4 text-sm leading-6 text-[#637268]">
                {error || 'The order link may have expired.'}
              </p>
              <Link href="/shop" className="button-primary mt-7">
                Continue shopping
              </Link>
            </section>
          ) : (
            <>
              <section className="mt-8 rounded-[1.5rem] bg-[#314338] p-7 text-[#fffaf3]">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="eyebrow text-[#d8c6a8]">Guest order</p>
                    <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
                      {order.orderNumber}
                    </h1>
                  </div>
                  <Package className="text-[#d8c6a8]" size={28} />
                </div>
                <div className="mt-7 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-[#b9c9b7]">Payment</span>
                    <strong>{label(order.paymentStatus)}</strong>
                    {(order.paymentStatus === 'FAILED' ||
                      order.paymentStatus === 'CANCELLED') && (
                      <button
                        type="button"
                        onClick={() => void retryPayment()}
                        disabled={retrying}
                        className="button-secondary mt-3 border-white/30 text-[#fffaf3] disabled:opacity-60"
                      >
                        {retrying ? 'Preparing payment…' : 'Retry payment'}
                      </button>
                    )}
                  </div>
                  <div>
                    <span className="block text-[#b9c9b7]">Fulfilment</span>
                    <strong>{label(order.fulfilmentStatus)}</strong>
                  </div>
                </div>
                {order.shipment?.trackingReference && (
                  <p className="mt-6 border-t border-white/15 pt-5 text-sm text-[#d7e0d4]">
                    {order.shipment.courierName ?? 'Shipment'}:{' '}
                    {order.shipment.trackingReference}
                  </p>
                )}
              </section>
              <section className="mt-6 rounded-[1.5rem] bg-[#fffaf3] p-7">
                <p className="eyebrow">Order summary</p>
                <div className="mt-5 grid gap-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-5 border-b border-[#e2d9cd] pb-4 text-sm"
                    >
                      <span>
                        <strong className="block">{item.productName}</strong>
                        <span className="text-[#718078]">
                          {item.variantName} · {item.quantity}
                        </span>
                      </span>
                      <span className="font-semibold">
                        {formatInr(
                          Math.round(
                            (item.unitPricePaise * item.quantity) / 100,
                          ),
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatInr(Math.round(order.totalPaise / 100))}</span>
                </div>
                <div className="mt-6 flex gap-3 rounded-xl bg-[#e7eee5] p-3 text-xs leading-5 text-[#536259]">
                  <ShieldCheck size={18} className="shrink-0" /> This private
                  link expires after seven days and only exposes this order.
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
