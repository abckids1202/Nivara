# Nivara Store

Responsive ecommerce storefront and administration-panel prototype for Nivara, a focused Indian home and everyday-living retailer.

## Implementation status

This repository contains the production backend foundation for the Nivara single-retailer ecommerce plan and the existing visual preview. It includes the expanded Prisma data model, validated API route groups, transactional inventory reservations, Razorpay webhook verification, payment reconciliation, guest-order token isolation, administrator audit trails, CSV catalogue import, payment-review resolution, sitemap/robots generation, and automated tests for the deterministic business rules.

The current storefront screens still use the original demonstration catalogue. Connecting them to the Supabase-backed APIs, adding Supabase cookie sessions, wiring the real Razorpay browser checkout, and completing the authenticated admin UI are the next integration slices before production launch. The preview must not be treated as a live store until those slices are configured and acceptance-tested.

## Run locally

```bash
npm install
npm run dev
```

Use the local URL printed by the dev server. Do not add real credentials to the repository; copy `.env.example` to `.env` and fill only local/test values. Prisma commands require both `DATABASE_URL` and `DIRECT_URL`; use the Supabase pooled URL for the former and the Supabase direct connection URL for the latter.

For Windows CMD:

```cmd
cd /d C:\path\to\nivara-store
npm install
copy .env.example .env
npm run dev
```

Then open `http://localhost:3000`.

## Routes

- `/` — mobile-first storefront homepage.
- `/shop` — searchable and filterable catalogue.
- `/product/arc-desk-organizer` — product detail and variant interaction.
- `/checkout` — checkout design and test payment handoff state.
- `/admin` — administration dashboard preview.
- `/api/health` — deployment health endpoint.
- `/api/catalogue` — public catalogue query API.
- `/api/checkout` — server-validated order and Razorpay-order creation.
- `/api/payments/razorpay/webhook` — verified, idempotent payment notifications.
- `/api/jobs/reconcile` — protected five-minute reconciliation job.

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

## Delivery assumptions

India-only delivery, ₹79 below ₹999, free above that threshold, no COD, no automated refunds, no courier API, no marketplace sellers, and no mobile apps in this phase.
