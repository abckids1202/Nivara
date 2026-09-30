'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Package, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StoreHeader } from '@/components/experience-tools';
import { formatInr } from '@/lib/demo-data';

type OrderDetail = {
  orderNumber: string;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  createdAt: string;
  shippingFullName: string | null;
  shippingLine1: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    unitPricePaise: number;
    quantity: number;
  }>;
  shipment: {
    courierName: string | null;
    trackingReference: string | null;
  } | null;
};

const money = (paise: number) => formatInr(Math.round(paise / 100));
const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^| )\w/g, (letter) => letter.toUpperCase());

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void params
      .then(({ orderNumber }) =>
        fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
          cache: 'no-store',
        }),
      )
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          data?: OrderDetail;
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? 'Sign in to view this order.'
              : (result.error ?? 'Order could not be loaded.'),
          );
        return result.data;
      })
      .then((data) => {
        if (active && data) setOrder(data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Order could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params]);

  return (
    <>
      <StoreHeader compact />
      <main className="min-h-screen bg-[#f8f4ee] px-5 py-10 text-[#27362d] lg:px-8 lg:py-16">
        <div className="mx-auto max-w-[1000px]">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#a6503d]"
          >
            <ArrowLeft size={15} /> Back to account
          </Link>
          {loading ? (
            <div className="mt-8 grid gap-4">
              <div className="skeleton-card h-32" />
              <div className="skeleton-card h-64" />
            </div>
          ) : error || !order ? (
            <section className="mt-8 rounded-[1.5rem] bg-[#fffaf3] p-8">
              <p className="eyebrow">Order details</p>
              <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
                We couldn’t open this order.
              </h1>
              <p className="mt-4 text-sm text-[#637268]">
                {error || 'The order could not be found.'}
              </p>
              <Link href="/account" className="button-primary mt-7">
                Return to account
              </Link>
            </section>
          ) : (
            <>
              <div className="mt-8 flex flex-col justify-between gap-5 rounded-[1.5rem] bg-[#314338] p-7 text-[#fffaf3] sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow text-[#d8c6a8]">Order details</p>
                  <h1 className="mt-3 font-display text-4xl tracking-[-0.06em]">
                    {order.orderNumber}
                  </h1>
                  <p className="mt-2 text-sm text-[#d7e0d4]">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      dateStyle: 'long',
                    })}
                  </p>
                </div>
                <Package size={30} className="text-[#d8c6a8]" />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[1.5rem] bg-[#fffaf3] p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="eyebrow">Items</p>
                      <h2 className="mt-2 font-display text-3xl tracking-[-0.05em]">
                        What you ordered.
                      </h2>
                    </div>
                    <CheckCircle2 className="text-[#6b8b67]" />
                  </div>
                  <div className="mt-6 grid gap-4">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-5 border-b border-[#e2d9cd] pb-4 text-sm"
                      >
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="mt-1 text-[#718078]">
                            {item.variantName} · SKU {item.sku} · Qty{' '}
                            {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {money(item.unitPricePaise * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 grid gap-3 text-sm text-[#637268]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{money(order.subtotalPaise)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <span>
                        {order.deliveryFeePaise
                          ? money(order.deliveryFeePaise)
                          : 'Free'}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#e2d9cd] pt-4 text-lg font-bold text-[#27362d]">
                      <span>Total</span>
                      <span>{money(order.totalPaise)}</span>
                    </div>
                  </div>
                </section>
                <aside className="grid content-start gap-6">
                  <div className="rounded-[1.5rem] bg-[#fffaf3] p-7">
                    <p className="eyebrow">Status</p>
                    <div className="mt-5 grid gap-3 text-sm">
                      <div>
                        <span className="block text-[#718078]">Payment</span>
                        <strong>{label(order.paymentStatus)}</strong>
                      </div>
                      <div>
                        <span className="block text-[#718078]">Fulfilment</span>
                        <strong>{label(order.fulfilmentStatus)}</strong>
                      </div>
                      {order.shipment?.trackingReference && (
                        <div>
                          <span className="block text-[#718078]">Tracking</span>
                          <strong>
                            {order.shipment.courierName ?? 'Shipment'}:{' '}
                            {order.shipment.trackingReference}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-[1.5rem] bg-[#e7eee5] p-7">
                    <p className="eyebrow">Delivery address</p>
                    <p className="mt-4 text-sm leading-6 text-[#536259]">
                      {order.shippingFullName}
                      <br />
                      {order.shippingLine1}
                      <br />
                      {order.shippingCity}, {order.shippingState}{' '}
                      {order.shippingPostalCode}
                    </p>
                    <div className="mt-5 flex gap-2 text-xs leading-5 text-[#536259]">
                      <ShieldCheck size={16} className="shrink-0" /> This
                      address is the immutable snapshot saved with your order.
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
