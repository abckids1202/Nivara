# Nivara Store

Responsive ecommerce storefront and protected administration panel for Nivara, a focused Indian home and everyday-living retailer.

## Implementation status

This repository contains the production backend foundation for the Nivara single-retailer ecommerce plan and the existing visual preview. It includes the expanded Prisma data model, validated API route groups, transactional inventory reservations, Razorpay webhook verification, payment reconciliation, guest-order token isolation, administrator audit trails, CSV catalogue import, payment-review resolution, sitemap/robots generation, and automated tests for the deterministic business rules.

The storefront, cart, checkout handoff, account area, guest-order access, authenticated admin catalogue, image upload, fulfilment, reporting, review moderation, payment-review workflow, and browser acceptance tests are implemented. The repository is still not production-ready until the client-owned Supabase, Razorpay, Resend, Storage, and Vercel accounts are configured and the seeded end-to-end payment journey is run with test credentials.

## Run locally

```bash
npm install
npm run dev

# Browser acceptance tests (starts a local dev server when needed)
npm run test:e2e
```

Use the local URL printed by the dev server. Do not add real credentials to the repository; copy `.env.example` to `.env` and fill only local/test values. Prisma commands require both `DATABASE_URL` and `DIRECT_URL`; use the Supabase pooled URL for the former and the Supabase direct connection URL for the latter.

For Windows CMD:

```cmd
cd /d C:\path\to\nivara-store
npm install
copy .env.example .env
npm run db:seed
npm run dev
```

`npm run db:seed` is safe to run repeatedly. It upserts the demonstration catalogue, categories, variants, and placeholder product images; it requires a reachable `DATABASE_URL`.

Then open `http://localhost:3000`.

## Routes

- `/` — mobile-first storefront homepage.
- `/shop` — searchable and filterable catalogue.
- `/product/arc-desk-organizer` — product detail and variant interaction.
- `/checkout` — server-validated checkout and Razorpay test handoff.
- `/account` — authenticated profile, addresses, wishlist, orders, and reviews.
- `/account/orders/[orderNumber]` — authenticated order detail view.
- `/guest-order/[token]` — expiring, limited-scope guest order status.
- `/admin` — protected catalogue, image, fulfilment, reporting, moderation, and payment-review workspace.
- `/api/health` — deployment health endpoint.
- `/api/catalogue` — public catalogue query API.
- `/api/products/[slug]` — public published-product detail API with approved reviews.
- `/api/checkout` — server-validated order and Razorpay-order creation.
- `/api/payments/razorpay/webhook` — verified, idempotent payment notifications.
- `/api/jobs/reconcile` — protected five-minute reconciliation job.
- `/api/admin/reports` — protected paid-order, low-stock, and adjustment reporting.

## Verification

```cmd
npm run lint
npm run test
npm run build
```

With local placeholder database variables, validate the Prisma schema with:

```cmd
set DATABASE_URL=postgresql://postgres:password@localhost:5432/nivara
set DIRECT_URL=postgresql://postgres:password@localhost:5432/nivara
npx prisma validate
```

Before deployment, create the Prisma migration against the client-owned Supabase project, configure Vercel environment variables, configure the Razorpay webhook URL, and verify the Resend sender domain. No provider secret belongs in Git.

See [`docs/operations-runbook.md`](docs/operations-runbook.md) for provider setup, cron, backup, restore, acceptance testing, and handover steps.

## Delivery assumptions

India-only delivery, ₹79 below ₹999, free above that threshold, no COD, no automated refunds, no courier API, no marketplace sellers, and no mobile apps in this phase.
