'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Package,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { StoreHeader } from '@/components/experience-tools';
import { formatInr } from '@/lib/format';

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  category: { name: string };
  images: Array<{ id: string; url: string; altText: string }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    pricePaise: number;
    stockOnHand: number;
    stockReserved: number;
  }>;
};
type AdminOrder = {
  id: string;
  orderNumber: string;
  guestEmail: string | null;
  paymentStatus: string;
  fulfilmentStatus: 'PROCESSING' | 'SHIPPED' | 'DELIVERED';
  totalPaise: number;
  items: Array<{ productName: string; quantity: number }>;
  shipment: {
    courierName: string | null;
    trackingReference: string | null;
  } | null;
};
type AdminReview = {
  id: string;
  displayName: string;
  rating: number;
  body: string;
  product: { name: string };
};
type AdminCategory = { id: string; name: string; slug: string; _count?: { products: number } };
type CataloguePreview = {
  rowCount: number;
  preview: Array<{
    productName: string;
    productSlug: string;
    variantName: string;
    sku: string;
    priceRupees: number;
    stockOnHand: number;
  }>;
};
type ProductForm = {
  name: string;
  slug: string;
  description: string;
  material: string;
  dimensions: string;
  care: string;
  categoryId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};
type VariantForm = {
  name: string;
  sku: string;
  priceRupees: string;
  compareAtRupees: string;
};
type AdminReport = {
  paidOrderCount: number;
  paidOrderTotalPaise: number;
  paymentReviewCount: number;
  lowStock: Array<{
    id: string;
    name: string;
    sku: string;
    stockOnHand: number;
    stockReserved: number;
    product: { name: string; slug: string };
  }>;
  adjustments: Array<{
    id: string;
    quantityDelta: number;
    beforeQuantity: number;
    afterQuantity: number;
    reason: string;
    createdAt: string;
    variant: { name: string; sku: string; product: { name: string } };
    adminUser: { email: string; displayName: string | null };
  }>;
};
type PaymentReviewOrder = {
  id: string;
  orderNumber: string;
  guestEmail: string | null;
  paymentStatus: string;
  totalPaise: number;
  items: Array<{ productName: string; quantity: number }>;
  payments: Array<{ providerPaymentId: string | null }>;
  paymentReviewResolution: {
    action: string;
    reason: string;
    refundReference: string | null;
  } | null;
};
const formatPaise = (paise: number) => formatInr(Math.round(paise / 100));

export default function AdminPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [paymentReviews, setPaymentReviews] = useState<PaymentReviewOrder[]>(
    [],
  );
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [query, setQuery] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [orderStatus, setOrderStatus] = useState<Record<string, string>>({});
  const [tracking, setTracking] = useState<
    Record<string, { courierName: string; trackingReference: string }>
  >({});
  const [editingProductId, setEditingProductId] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '',
    slug: '',
    description: '',
    material: '',
    dimensions: '',
    care: '',
    categoryId: '',
    status: 'DRAFT',
  });
  const [variantForms, setVariantForms] = useState<Record<string, VariantForm>>(
    {},
  );
  const [imageFiles, setImageFiles] = useState<
    Record<string, File | undefined>
  >({});
  const [imageAlt, setImageAlt] = useState<Record<string, string>>({});
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', slug: '' });
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [catalogueCsv, setCatalogueCsv] = useState('');
  const [catalogueFileName, setCatalogueFileName] = useState('');
  const [cataloguePreview, setCataloguePreview] =
    useState<CataloguePreview | null>(null);
  const [catalogueBusy, setCatalogueBusy] = useState(false);

  async function loadProducts() {
    setLoading(true);
    const response = await fetch('/api/admin/products', { cache: 'no-store' });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: AdminProduct[];
      error?: string;
    };
    if (!response.ok)
      setError(
        response.status === 401 || response.status === 403
          ? 'Administrator authentication is required to manage the store.'
          : (payload.error ?? 'Catalogue could not be loaded'),
      );
    else {
      setProducts(payload.data ?? []);
      setError('');
    }
    setLoading(false);
  }

  async function loadOrders() {
    const response = await fetch(
      `/api/admin/orders${orderQuery ? `?q=${encodeURIComponent(orderQuery)}` : ''}`,
      { cache: 'no-store' },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      data?: AdminOrder[];
    };
    if (response.ok) setOrders(payload.data ?? []);
  }

  async function loadReviews() {
    const response = await fetch('/api/admin/reviews', { cache: 'no-store' });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: AdminReview[];
    };
    if (response.ok) setReviews(payload.data ?? []);
  }

  async function loadCategories() {
    const response = await fetch('/api/admin/categories', {
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: AdminCategory[];
    };
    if (response.ok) setCategories(payload.data ?? []);
  }

  async function createCategory(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : '/api/admin/categories',
      {
      method: editingCategoryId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryForm),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setNotice(
      response.ok
        ? editingCategoryId ? 'Category updated.' : 'Category created.'
        : (payload.error ?? 'Category could not be created.'),
    );
    if (response.ok) {
      setCategoryForm({ name: '', slug: '' });
      setEditingCategoryId('');
      setShowCategoryForm(false);
      await loadCategories();
    }
  }

  async function deleteCategory(category: AdminCategory) {
    if (!window.confirm(`Delete ${category.name}? Categories with products cannot be deleted.`)) return;
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setNotice(response.ok ? 'Category deleted.' : (payload.error ?? 'Category could not be deleted.'));
    if (response.ok) await loadCategories();
  }

  async function loadReport() {
    const response = await fetch('/api/admin/reports', { cache: 'no-store' });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: AdminReport;
    };
    if (response.ok) setReport(payload.data ?? null);
  }

  async function loadPaymentReviews() {
    const response = await fetch('/api/admin/orders/payment-review', {
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: PaymentReviewOrder[];
    };
    if (response.ok) setPaymentReviews(payload.data ?? []);
  }

  async function previewCatalogue() {
    if (!catalogueCsv.trim()) {
      setNotice('Choose a CSV file before previewing.');
      return;
    }
    setCatalogueBusy(true);
    const response = await fetch('/api/admin/catalogue/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: catalogueCsv,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      preview?: CataloguePreview['preview'];
      rowCount?: number;
    };
    if (!response.ok) {
      setCataloguePreview(null);
      setNotice(payload.error ?? 'Catalogue preview failed.');
    } else {
      setCataloguePreview({
        rowCount: payload.rowCount ?? 0,
        preview: payload.preview ?? [],
      });
      setNotice('Catalogue preview validated.');
    }
    setCatalogueBusy(false);
  }

  async function importCatalogue() {
    if (!catalogueCsv.trim() || !cataloguePreview) return;
    if (
      !window.confirm(
        `Import ${cataloguePreview.rowCount} validated catalogue rows? Existing matching products and SKUs will be updated.`,
      )
    )
      return;
    setCatalogueBusy(true);
    const response = await fetch('/api/admin/catalogue/import?dryRun=false', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: catalogueCsv,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      imported?: number;
    };
    setNotice(
      response.ok
        ? `${payload.imported ?? 0} catalogue rows imported.`
        : (payload.error ?? 'Catalogue import failed.'),
    );
    if (response.ok) {
      setCatalogueCsv('');
      setCatalogueFileName('');
      setCataloguePreview(null);
      await Promise.all([loadProducts(), loadCategories()]);
    }
    setCatalogueBusy(false);
  }

  // The loaders intentionally read the current query and are invoked only when the search changes.
  // oxlint-disable react-hooks/exhaustive-deps
  useEffect(() => {
    queueMicrotask(() => {
      void loadProducts();
      void loadOrders();
      void loadReviews();
      void loadCategories();
      void loadReport();
      void loadPaymentReviews();
    });
  }, [orderQuery]);
  // oxlint-enable react-hooks/exhaustive-deps

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.category.name} ${product.slug}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [products, query],
  );
  const stats = useMemo(() => {
    const variants = products.flatMap((product) => product.variants);
    return {
      published: products.filter((product) => product.status === 'PUBLISHED')
        .length,
      lowStock: variants.filter(
        (variant) => variant.stockOnHand - variant.stockReserved < 7,
      ).length,
      units: variants.reduce((sum, variant) => sum + variant.stockOnHand, 0),
    };
  }, [products]);

  async function updateStatus(product: AdminProduct) {
    const status = product.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok)
      setNotice(payload.error ?? 'Product status could not be updated');
    else {
      setNotice(`${product.name} is now ${status.toLowerCase()}.`);
      await loadProducts();
    }
  }

  async function archive(product: AdminProduct) {
    if (
      !window.confirm(`Archive ${product.name}? It will leave the storefront.`)
    )
      return;
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: 'DELETE',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok)
      setNotice(payload.error ?? 'Product could not be archived');
    else {
      setNotice(`${product.name} was archived.`);
      await loadProducts();
    }
  }

  async function adjustStock(variantId: string) {
    const quantityDelta = Number(deltas[variantId]);
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setNotice('Enter a non-zero whole-number stock adjustment.');
      return;
    }
    const response = await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId,
        quantityDelta,
        reason: 'Admin catalogue adjustment',
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setNotice(payload.error ?? 'Stock could not be adjusted');
    else {
      setNotice('Stock adjustment saved and audited.');
      setDeltas((current) => ({ ...current, [variantId]: '' }));
      await loadProducts();
      await loadReport();
    }
  }

  function beginCreate() {
    setShowProductForm(true);
    setEditingProductId('');
    setProductForm({
      name: '',
      slug: '',
      description: '',
      material: '',
      dimensions: '',
      care: '',
      categoryId: categories[0]?.id ?? '',
      status: 'DRAFT',
    });
  }

  function beginEdit(product: AdminProduct) {
    setShowProductForm(true);
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      slug: product.slug,
      description: '',
      material: '',
      dimensions: '',
      care: '',
      categoryId:
        categories.find((category) => category.name === product.category.name)
          ?.id ?? '',
      status: product.status,
    });
    setExpandedId(product.id);
  }

  async function saveProduct(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = editingProductId
      ? {
          name: productForm.name,
          slug: productForm.slug,
          status: productForm.status,
          ...(productForm.categoryId
            ? { categoryId: productForm.categoryId }
            : {}),
          ...(productForm.description.length >= 10
            ? { description: productForm.description }
            : {}),
          ...(productForm.material ? { material: productForm.material } : {}),
          ...(productForm.dimensions
            ? { dimensions: productForm.dimensions }
            : {}),
          ...(productForm.care ? { care: productForm.care } : {}),
        }
      : {
          ...productForm,
          material: productForm.material || undefined,
          dimensions: productForm.dimensions || undefined,
          care: productForm.care || undefined,
        };
    const response = await fetch(
      editingProductId
        ? `/api/admin/products/${editingProductId}`
        : '/api/admin/products',
      {
        method: editingProductId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setNotice(payload.error ?? 'Product could not be saved');
    else {
      setNotice(
        editingProductId
          ? 'Product updated.'
          : 'Product created. Add a variant before publishing.',
      );
      setEditingProductId('');
      setShowProductForm(false);
      await loadProducts();
    }
  }

  async function saveVariant(productId: string, variantId: string) {
    const form = variantForms[variantId];
    if (!form) return;
    const response = await fetch(
      `/api/admin/products/${productId}/variants/${variantId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sku: form.sku,
          priceRupees: Number(form.priceRupees),
          compareAtRupees: form.compareAtRupees
            ? Number(form.compareAtRupees)
            : null,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setNotice(
      response.ok
        ? 'Variant updated.'
        : (payload.error ?? 'Variant could not be updated.'),
    );
    if (response.ok) await loadProducts();
  }

  async function createVariant(productId: string) {
    const response = await fetch(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Standard',
        sku: `NIV-${Date.now()}`,
        priceRupees: 0,
        stockOnHand: 0,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setNotice(
      response.ok
        ? 'Variant created. Update its price and SKU.'
        : (payload.error ?? 'Variant could not be created.'),
    );
    if (response.ok) await loadProducts();
  }

  async function uploadImage(productId: string) {
    const file = imageFiles[productId];
    if (!file) {
      setNotice('Choose an image first.');
      return;
    }
    const form = new FormData();
    form.set('file', file);
    form.set('altText', imageAlt[productId] ?? '');
    const response = await fetch(`/api/admin/products/${productId}/images`, {
      method: 'POST',
      body: form,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setNotice(
      response.ok
        ? 'Product image uploaded.'
        : (payload.error ?? 'Image upload failed.'),
    );
    if (response.ok) {
      setImageFiles((current) => ({ ...current, [productId]: undefined }));
      await loadProducts();
    }
  }

  async function deleteImage(productId: string, imageId: string) {
    const response = await fetch(
      `/api/admin/products/${productId}/images?imageId=${encodeURIComponent(imageId)}`,
      { method: 'DELETE' },
    );
    setNotice(
      response.ok ? 'Product image removed.' : 'Image could not be removed.',
    );
    if (response.ok) await loadProducts();
  }

  async function updateOrder(order: AdminOrder) {
    const details = tracking[order.id] ?? {
      courierName: order.shipment?.courierName ?? '',
      trackingReference: order.shipment?.trackingReference ?? '',
    };
    const response = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        status: orderStatus[order.id] ?? order.fulfilmentStatus,
        ...details,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setNotice(payload.error ?? 'Order update failed');
    else {
      setNotice(`${order.orderNumber} updated.`);
      await loadOrders();
    }
  }

  async function moderate(reviewId: string, status: 'APPROVED' | 'REJECTED') {
    const reason = window.prompt(
      status === 'APPROVED' ? 'Moderation note' : 'Reason for rejection',
      status === 'APPROVED'
        ? 'Approved after moderation'
        : 'Does not meet review policy',
    );
    if (!reason) return;
    const response = await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, status, reason }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) setNotice(payload.error ?? 'Review decision failed');
    else {
      setNotice(`Review ${status.toLowerCase()}.`);
      await loadReviews();
    }
  }

  async function resolvePaymentReview(
    order: PaymentReviewOrder,
    action: 'REFUND' | 'FULFIL' | 'CANCEL',
  ) {
    const reason = window.prompt(
      'Resolution reason',
      action === 'REFUND'
        ? 'Captured payment requires manual refund.'
        : action === 'FULFIL'
          ? 'Captured payment confirmed and stock is available.'
          : 'Payment review cancelled by administrator.',
    );
    if (!reason) return;
    const refundReference =
      action === 'REFUND'
        ? (window.prompt('Razorpay refund reference (optional)', '') ?? '')
        : '';
    const response = await fetch('/api/admin/orders/payment-review', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        action,
        reason,
        refundReference: refundReference || undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setNotice(
      response.ok
        ? `${order.orderNumber} resolved.`
        : (payload.error ?? 'Payment review could not be resolved.'),
    );
    if (response.ok) {
      await loadPaymentReviews();
      await loadOrders();
      await loadReport();
    }
  }

  return (
    <>
      <StoreHeader compact />
      <main className="min-h-screen bg-[#f3f5f0] px-5 pb-20 pt-10 text-[#27362d] lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#a6503d]"
              >
                <ArrowLeft size={15} /> Storefront
              </Link>
              <p className="eyebrow mt-8">Store operations</p>
              <h1 className="mt-3 font-display text-5xl tracking-[-0.07em]">
                Store control.
              </h1>
              <p className="mt-3 text-[#718078]">
                Catalogue, fulfilment, and moderation in one protected
                workspace.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 text-xs font-semibold text-[#536259]">
              <ShieldCheck size={16} className="text-[#6b8b67]" />{' '}
              Server-authorized admin area
            </div>
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-8 rounded-2xl border border-[#e5b7aa] bg-[#f7ddd5] p-6"
            >
              <p className="font-semibold text-[#8f3f31]">{error}</p>
              <Link href="/account" className="button-secondary mt-5">
                Open account
              </Link>
              <button
                type="button"
                onClick={() => void loadProducts()}
                className="button-primary ml-3 mt-5"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#314338] p-5 text-white">
                  <ShoppingBag size={20} className="text-[#f2c1b2]" />
                  <p className="mt-7 text-sm text-[#d7e0d4]">
                    Published products
                  </p>
                  <p className="mt-1 text-3xl font-bold">{stats.published}</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <AlertTriangle size={20} className="text-[#b87939]" />
                  <p className="mt-7 text-sm text-[#718078]">
                    Low-stock variants
                  </p>
                  <p className="mt-1 text-3xl font-bold">{stats.lowStock}</p>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <Package size={20} className="text-[#a6503d]" />
                  <p className="mt-7 text-sm text-[#718078]">Units on hand</p>
                  <p className="mt-1 text-3xl font-bold">{stats.units}</p>
                </div>
              </div>
              {report && (
                <section className="mt-8 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="eyebrow">Reporting</p>
                        <h2 className="mt-2 text-xl font-semibold">
                          Paid-order performance.
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadReport()}
                        className="button-secondary"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-[#f3f5f0] p-4">
                        <p className="text-xs text-[#718078]">Paid orders</p>
                        <p className="mt-1 text-2xl font-bold">
                          {report.paidOrderCount}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#f3f5f0] p-4">
                        <p className="text-xs text-[#718078]">Paid total</p>
                        <p className="mt-1 text-2xl font-bold">
                          {formatPaise(report.paidOrderTotalPaise)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#f3f5f0] p-4">
                        <p className="text-xs text-[#718078]">Payment review</p>
                        <p className="mt-1 text-2xl font-bold">
                          {report.paymentReviewCount}
                        </p>
                      </div>
                    </div>
                    <p className="mt-5 text-sm font-semibold">
                      Low-stock published variants
                    </p>
                    <div className="mt-3 grid gap-2">
                      {report.lowStock.length ? (
                        report.lowStock.map((variant) => (
                          <div
                            key={variant.id}
                            className="flex justify-between gap-3 rounded-lg border border-[#e5ebe2] px-3 py-2 text-sm"
                          >
                            <span>
                              {variant.product.name} · {variant.name}
                            </span>
                            <span className="font-semibold text-[#a6503d]">
                              {variant.stockOnHand - variant.stockReserved}{' '}
                              available
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg bg-[#e7eee5] p-3 text-sm text-[#536259]">
                          No published variants are below the low-stock
                          threshold.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <p className="eyebrow">Audit history</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Recent stock adjustments.
                    </h2>
                    <div className="mt-5 grid gap-2">
                      {report.adjustments.length ? (
                        report.adjustments.slice(0, 8).map((adjustment) => (
                          <div
                            key={adjustment.id}
                            className="rounded-lg border border-[#e5ebe2] p-3 text-sm"
                          >
                            <div className="flex justify-between gap-3">
                              <span className="font-semibold">
                                {adjustment.variant.product.name} ·{' '}
                                {adjustment.variant.name}
                              </span>
                              <span
                                className={
                                  adjustment.quantityDelta > 0
                                    ? 'text-[#536259]'
                                    : 'text-[#a6503d]'
                                }
                              >
                                {adjustment.quantityDelta > 0 ? '+' : ''}
                                {adjustment.quantityDelta}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#718078]">
                              {adjustment.reason} ·{' '}
                              {adjustment.adminUser.displayName ??
                                adjustment.adminUser.email}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-lg bg-[#f3f5f0] p-3 text-sm text-[#718078]">
                          No stock adjustments recorded yet.
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <p className="eyebrow">Catalogue import</p>
                <h2 className="mt-2 text-xl font-semibold">
                  Preview before updating products.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">
                  Upload the approved CSV, validate it without writing to the
                  database, then confirm the import. Matching SKUs update their
                  existing variants; reserved stock is protected server-side.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid gap-2 text-sm font-semibold">
                    CSV file
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setCatalogueFileName(file.name);
                        setCataloguePreview(null);
                        void file.text().then(setCatalogueCsv);
                      }}
                      className="block max-w-full text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-[#e7eee5] file:px-4 file:py-2 file:font-semibold file:text-[#314338]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!catalogueCsv || catalogueBusy}
                    onClick={() => void previewCatalogue()}
                    className="button-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {catalogueBusy ? 'Checking…' : 'Preview CSV'}
                  </button>
                  {cataloguePreview && (
                    <button
                      type="button"
                      disabled={catalogueBusy}
                      onClick={() => void importCatalogue()}
                      className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Import validated rows
                    </button>
                  )}
                </div>
                {catalogueFileName && (
                  <p className="mt-3 text-xs text-[#718078]">
                    Selected: {catalogueFileName}
                  </p>
                )}
                {cataloguePreview && (
                  <div className="mt-5 overflow-x-auto rounded-xl border border-[#e5ebe2]">
                    <p className="border-b border-[#e5ebe2] bg-[#f3f5f0] px-4 py-3 text-sm font-semibold">
                      {cataloguePreview.rowCount} rows validated successfully
                    </p>
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="text-[#718078]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Product</th>
                          <th className="px-4 py-3 font-semibold">Variant</th>
                          <th className="px-4 py-3 font-semibold">SKU</th>
                          <th className="px-4 py-3 font-semibold">Price</th>
                          <th className="px-4 py-3 font-semibold">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cataloguePreview.preview.slice(0, 8).map((row) => (
                          <tr key={row.sku} className="border-t border-[#eef1eb]">
                            <td className="px-4 py-3 font-semibold">
                              {row.productName}
                            </td>
                            <td className="px-4 py-3">{row.variantName}</td>
                            <td className="px-4 py-3">{row.sku}</td>
                            <td className="px-4 py-3">₹{row.priceRupees}</td>
                            <td className="px-4 py-3">{row.stockOnHand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cataloguePreview.rowCount > 8 && (
                      <p className="border-t border-[#e5ebe2] px-4 py-3 text-xs text-[#718078]">
                        Showing the first 8 rows.
                      </p>
                    )}
                  </div>
                )}
              </section>
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Categories</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Organize the collection.
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryForm((value) => !value)}
                    className="button-secondary"
                  >
                    <Plus size={15} />{' '}
                    {showCategoryForm ? 'Close' : 'New category'}
                  </button>
                </div>
                {showCategoryForm && (
                  <form
                    onSubmit={createCategory}
                    className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      required
                      minLength={2}
                      value={categoryForm.name}
                      onChange={(event) =>
                        setCategoryForm({
                          ...categoryForm,
                          name: event.target.value,
                        })
                      }
                      placeholder="Category name"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-[#f3f5f0] px-3 text-sm"
                    />
                    <input
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={categoryForm.slug}
                      onChange={(event) =>
                        setCategoryForm({
                          ...categoryForm,
                          slug: event.target.value,
                        })
                      }
                      placeholder="category-slug"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-[#f3f5f0] px-3 text-sm"
                    />
                    <button type="submit" className="button-primary">
                      {editingCategoryId ? 'Save' : 'Create'}
                    </button>
                  </form>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <span
                      key={category.id}
                      className="flex items-center gap-2 rounded-full bg-[#e7eee5] px-3 py-2 text-xs font-semibold text-[#536259]"
                    >
                      <span>{category.name} · {category.slug} · {category._count?.products ?? 0} products</span>
                      <button type="button" className="underline" onClick={() => { setEditingCategoryId(category.id); setCategoryForm({ name: category.name, slug: category.slug }); setShowCategoryForm(true); }}>Edit</button>
                      <button type="button" className="text-[#a84b3e] underline" onClick={() => deleteCategory(category)}>Delete</button>
                    </span>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-sm text-[#718078]">
                      No categories available.
                    </p>
                  )}
                </div>
              </section>
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="eyebrow">Products</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Manage the collection.
                    </h2>
                  </div>
                  <label className="relative block sm:w-80">
                    <span className="sr-only">Search products</span>
                    <Search
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9a90]"
                    />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search products"
                      className="h-11 w-full rounded-full border border-[#d8e0d5] bg-[#f3f5f0] pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={beginCreate}
                    className="button-primary"
                  >
                    <Plus size={16} /> New product
                  </button>
                </div>
                {showProductForm ? (
                  <form
                    onSubmit={saveProduct}
                    className="mt-6 grid gap-3 rounded-xl bg-[#f3f5f0] p-4 sm:grid-cols-2"
                  >
                    <p className="eyebrow sm:col-span-2">
                      {editingProductId ? 'Edit product' : 'New product'}
                    </p>
                    <input
                      required
                      value={productForm.name}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          name: event.target.value,
                        })
                      }
                      placeholder="Product name"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    />
                    <input
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      value={productForm.slug}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          slug: event.target.value,
                        })
                      }
                      placeholder="product-slug"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    />
                    <select
                      required
                      value={productForm.categoryId}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          categoryId: event.target.value,
                        })
                      }
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    >
                      <option value="">Choose category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={productForm.status}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          status: event.target.value as ProductForm['status'],
                        })
                      }
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                    <textarea
                      required
                      minLength={10}
                      value={productForm.description}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          description: event.target.value,
                        })
                      }
                      placeholder="Description"
                      className="min-h-24 rounded-lg border border-[#d8e0d5] bg-white px-3 py-2 text-sm sm:col-span-2"
                    />
                    <input
                      value={productForm.material}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          material: event.target.value,
                        })
                      }
                      placeholder="Material"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    />
                    <input
                      value={productForm.dimensions}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          dimensions: event.target.value,
                        })
                      }
                      placeholder="Dimensions"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                    />
                    <input
                      value={productForm.care}
                      onChange={(event) =>
                        setProductForm({
                          ...productForm,
                          care: event.target.value,
                        })
                      }
                      placeholder="Care information"
                      className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm sm:col-span-2"
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="submit" className="button-primary">
                        <Save size={15} /> Save product
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProductId('');
                          setShowProductForm(false);
                          setProductForm({
                            name: '',
                            slug: '',
                            description: '',
                            material: '',
                            dimensions: '',
                            care: '',
                            categoryId: '',
                            status: 'DRAFT',
                          });
                        }}
                        className="button-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {loading ? (
                  <div className="mt-6 grid gap-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="skeleton-card h-20" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3">
                    {filteredProducts.length === 0 ? (
                      <p className="rounded-xl bg-[#f3f5f0] p-6 text-sm text-[#718078]">
                        No products match this search.
                      </p>
                    ) : (
                      filteredProducts.map((product) => (
                        <article
                          key={product.id}
                          className="rounded-xl border border-[#e5ebe2] p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">
                                  {product.name}
                                </h3>
                                <span className="rounded-full bg-[#e7eee5] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#536259]">
                                  {product.status}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-[#718078]">
                                {product.category.name} · {product.slug} ·{' '}
                                {product.variants.length} variants
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => beginEdit(product)}
                                className="button-secondary"
                              >
                                Edit product
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId((current) =>
                                    current === product.id ? '' : product.id,
                                  )
                                }
                                className="button-secondary"
                              >
                                {expandedId === product.id
                                  ? 'Hide variants'
                                  : 'View variants'}
                              </button>
                              {product.status !== 'ARCHIVED' && (
                                <button
                                  type="button"
                                  onClick={() => void updateStatus(product)}
                                  className="button-secondary"
                                >
                                  {product.status === 'PUBLISHED'
                                    ? 'Set draft'
                                    : 'Publish'}
                                </button>
                              )}
                              {product.status !== 'ARCHIVED' && (
                                <button
                                  type="button"
                                  onClick={() => void archive(product)}
                                  className="button-secondary text-[#a6503d]"
                                >
                                  Archive
                                </button>
                              )}
                            </div>
                          </div>
                          {expandedId === product.id && (
                            <div className="mt-4 grid gap-3 border-t border-[#e5ebe2] pt-4">
                              <div className="rounded-xl bg-[#e7eee5] p-3">
                                <p className="text-sm font-semibold">
                                  Product images
                                </p>
                                <div className="mt-3 flex flex-wrap gap-3">
                                  {product.images.map((image) => (
                                    <div key={image.id} className="relative">
                                      <img
                                        src={image.url}
                                        alt={image.altText}
                                        className="h-20 w-20 rounded-lg object-cover"
                                      />
                                      <button
                                        type="button"
                                        aria-label={`Remove ${image.altText}`}
                                        onClick={() =>
                                          void deleteImage(product.id, image.id)
                                        }
                                        className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#a6503d] text-xs font-bold text-white"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) =>
                                      setImageFiles((current) => ({
                                        ...current,
                                        [product.id]: event.target.files?.[0],
                                      }))
                                    }
                                    className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-2 py-2 text-xs"
                                  />
                                  <input
                                    value={imageAlt[product.id] ?? ''}
                                    onChange={(event) =>
                                      setImageAlt((current) => ({
                                        ...current,
                                        [product.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Image alt text"
                                    className="h-10 rounded-lg border border-[#d8e0d5] bg-white px-3 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void uploadImage(product.id)}
                                    className="button-secondary"
                                  >
                                    Upload image
                                  </button>
                                </div>
                              </div>
                              {product.variants.map((variant) => (
                                <div
                                  key={variant.id}
                                  className="flex flex-col gap-3 rounded-xl bg-[#f3f5f0] p-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {variant.name} · {variant.sku}
                                    </p>
                                    <p className="mt-1 text-xs text-[#718078]">
                                      {formatPaise(variant.pricePaise)} ·{' '}
                                      {variant.stockOnHand -
                                        variant.stockReserved}{' '}
                                      available ({variant.stockReserved}{' '}
                                      reserved)
                                    </p>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-4">
                                    <input
                                      aria-label={`Name for ${variant.name}`}
                                      value={
                                        variantForms[variant.id]?.name ??
                                        variant.name
                                      }
                                      onChange={(event) =>
                                        setVariantForms((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            name: event.target.value,
                                            sku:
                                              current[variant.id]?.sku ??
                                              variant.sku,
                                            priceRupees:
                                              current[variant.id]
                                                ?.priceRupees ??
                                              String(variant.pricePaise / 100),
                                            compareAtRupees:
                                              current[variant.id]
                                                ?.compareAtRupees ?? '',
                                          },
                                        }))
                                      }
                                      className="h-9 rounded-full border border-[#d8e0d5] bg-white px-3 text-xs"
                                    />
                                    <input
                                      aria-label={`SKU for ${variant.name}`}
                                      value={
                                        variantForms[variant.id]?.sku ??
                                        variant.sku
                                      }
                                      onChange={(event) =>
                                        setVariantForms((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            name:
                                              current[variant.id]?.name ??
                                              variant.name,
                                            sku: event.target.value,
                                            priceRupees:
                                              current[variant.id]
                                                ?.priceRupees ??
                                              String(variant.pricePaise / 100),
                                            compareAtRupees:
                                              current[variant.id]
                                                ?.compareAtRupees ?? '',
                                          },
                                        }))
                                      }
                                      className="h-9 rounded-full border border-[#d8e0d5] bg-white px-3 text-xs"
                                    />
                                    <input
                                      aria-label={`Price for ${variant.name}`}
                                      inputMode="decimal"
                                      value={
                                        variantForms[variant.id]?.priceRupees ??
                                        String(variant.pricePaise / 100)
                                      }
                                      onChange={(event) =>
                                        setVariantForms((current) => ({
                                          ...current,
                                          [variant.id]: {
                                            name:
                                              current[variant.id]?.name ??
                                              variant.name,
                                            sku:
                                              current[variant.id]?.sku ??
                                              variant.sku,
                                            priceRupees: event.target.value,
                                            compareAtRupees:
                                              current[variant.id]
                                                ?.compareAtRupees ?? '',
                                          },
                                        }))
                                      }
                                      className="h-9 rounded-full border border-[#d8e0d5] bg-white px-3 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void saveVariant(product.id, variant.id)
                                      }
                                      className="rounded-full bg-[#314338] px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Save variant
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label
                                      className="sr-only"
                                      htmlFor={`delta-${variant.id}`}
                                    >
                                      Stock adjustment for {variant.name}
                                    </label>
                                    <input
                                      id={`delta-${variant.id}`}
                                      value={deltas[variant.id] ?? ''}
                                      onChange={(event) =>
                                        setDeltas((current) => ({
                                          ...current,
                                          [variant.id]: event.target.value,
                                        }))
                                      }
                                      inputMode="numeric"
                                      placeholder="± stock"
                                      className="h-9 w-24 rounded-full border border-[#d8e0d5] bg-white px-3 text-xs"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void adjustStock(variant.id)
                                      }
                                      className="rounded-full bg-[#314338] px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Adjust
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => void createVariant(product.id)}
                                className="button-secondary justify-center"
                              >
                                <Plus size={15} /> Add variant
                              </button>
                            </div>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                )}
              </section>
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <p className="eyebrow">Payment exceptions</p>
                <h2 className="mt-2 text-xl font-semibold">
                  Resolve uncertain payments.
                </h2>
                <div className="mt-6 grid gap-3">
                  {paymentReviews.length === 0 ? (
                    <p className="rounded-xl bg-[#f3f5f0] p-5 text-sm text-[#718078]">
                      No orders need payment review.
                    </p>
                  ) : (
                    paymentReviews.map((order) => (
                      <article
                        key={order.id}
                        className="rounded-xl border border-[#e5ebe2] p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold">
                              {order.orderNumber} ·{' '}
                              {formatPaise(order.totalPaise)}
                            </p>
                            <p className="mt-1 text-sm text-[#718078]">
                              {order.guestEmail ?? 'Account customer'} ·{' '}
                              {order.paymentStatus}
                            </p>
                            <p className="mt-2 text-xs text-[#8b998e]">
                              {order.items
                                .map(
                                  (item) =>
                                    `${item.productName} × ${item.quantity}`,
                                )
                                .join(', ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void resolvePaymentReview(order, 'REFUND')
                              }
                              className="button-secondary"
                            >
                              Record refund
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void resolvePaymentReview(order, 'FULFIL')
                              }
                              className="button-secondary"
                            >
                              Fulfil
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void resolvePaymentReview(order, 'CANCEL')
                              }
                              className="button-secondary text-[#a6503d]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {order.payments[0]?.providerPaymentId && (
                          <p className="mt-3 text-xs text-[#718078]">
                            Provider payment:{' '}
                            {order.payments[0].providerPaymentId}
                          </p>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </section>
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="eyebrow">Fulfilment</p>
                    <h2 className="mt-2 text-xl font-semibold">
                      Orders that need attention.
                    </h2>
                  </div>
                  <label className="relative block sm:w-80">
                    <span className="sr-only">Search orders</span>
                    <Search
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8d9a90]"
                    />
                    <input
                      value={orderQuery}
                      onChange={(event) => setOrderQuery(event.target.value)}
                      placeholder="Order or customer email"
                      className="h-11 w-full rounded-full border border-[#d8e0d5] bg-[#f3f5f0] pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#c6674f]"
                    />
                  </label>
                </div>
                <div className="mt-6 grid gap-3">
                  {orders.length === 0 ? (
                    <p className="rounded-xl bg-[#f3f5f0] p-5 text-sm text-[#718078]">
                      No orders matched the search.
                    </p>
                  ) : (
                    orders.map((order) => (
                      <article
                        key={order.id}
                        className="rounded-xl border border-[#e5ebe2] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="font-semibold">
                              {order.orderNumber}
                            </h3>
                            <p className="mt-1 text-sm text-[#718078]">
                              {order.guestEmail ?? 'Account customer'} ·{' '}
                              {formatPaise(order.totalPaise)} ·{' '}
                              {order.paymentStatus}
                            </p>
                            <p className="mt-1 text-xs text-[#8b998e]">
                              {order.items
                                .map(
                                  (item) =>
                                    `${item.productName} × ${item.quantity}`,
                                )
                                .join(', ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Fulfilment status for ${order.orderNumber}`}
                              value={
                                orderStatus[order.id] ?? order.fulfilmentStatus
                              }
                              onChange={(event) =>
                                setOrderStatus((current) => ({
                                  ...current,
                                  [order.id]: event.target.value,
                                }))
                              }
                              className="h-10 rounded-full border border-[#d8e0d5] bg-[#f3f5f0] px-3 text-xs"
                            >
                              <option value="PROCESSING">Processing</option>
                              <option value="SHIPPED">Shipped</option>
                              <option value="DELIVERED">Delivered</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void updateOrder(order)}
                              className="button-secondary"
                            >
                              Save status
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs font-semibold">
                            Courier
                            <input
                              value={
                                tracking[order.id]?.courierName ??
                                order.shipment?.courierName ??
                                ''
                              }
                              onChange={(event) =>
                                setTracking((current) => ({
                                  ...current,
                                  [order.id]: {
                                    courierName: event.target.value,
                                    trackingReference:
                                      current[order.id]?.trackingReference ??
                                      order.shipment?.trackingReference ??
                                      '',
                                  },
                                }))
                              }
                              placeholder="Courier name"
                              className="h-10 rounded-lg border border-[#d8e0d5] bg-[#f3f5f0] px-3 font-normal"
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-semibold">
                            Tracking reference
                            <input
                              value={
                                tracking[order.id]?.trackingReference ??
                                order.shipment?.trackingReference ??
                                ''
                              }
                              onChange={(event) =>
                                setTracking((current) => ({
                                  ...current,
                                  [order.id]: {
                                    courierName:
                                      current[order.id]?.courierName ??
                                      order.shipment?.courierName ??
                                      '',
                                    trackingReference: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Tracking number"
                              className="h-10 rounded-lg border border-[#d8e0d5] bg-[#f3f5f0] px-3 font-normal"
                            />
                          </label>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
              <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm">
                <p className="eyebrow">Moderation</p>
                <h2 className="mt-2 text-xl font-semibold">Review queue.</h2>
                <div className="mt-6 grid gap-3">
                  {reviews.length === 0 ? (
                    <p className="rounded-xl bg-[#f3f5f0] p-5 text-sm text-[#718078]">
                      No reviews are waiting for moderation.
                    </p>
                  ) : (
                    reviews.map((review) => (
                      <article
                        key={review.id}
                        className="rounded-xl border border-[#e5ebe2] p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                          <div>
                            <p className="font-semibold">
                              {review.product.name} ·{' '}
                              {'★'.repeat(review.rating)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[#637268]">
                              “{review.body}”
                            </p>
                            <p className="mt-2 text-xs text-[#8b998e]">
                              {review.displayName}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void moderate(review.id, 'APPROVED')
                              }
                              className="button-secondary"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void moderate(review.id, 'REJECTED')
                              }
                              className="button-secondary text-[#a6503d]"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
        {notice && (
          <output
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#314338] px-5 py-3 text-sm font-semibold text-white shadow-xl"
          >
            {notice}
          </output>
        )}
      </main>
    </>
  );
}
