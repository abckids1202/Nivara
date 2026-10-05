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
The standalone seed and administrator-bootstrap scripts automatically load `.env.local` and `.env` when those files exist; already-exported environment variables remain authoritative.

For Windows CMD:

```cmd
cd /d C:\path\to\nivara-store
npm install
copy .env.example .env
npm run db:seed
npm run dev
```

For a local PostgreSQL rehearsal database with Docker Desktop:

```cmd
cd /d C:\path\to\nivara-store
docker compose up -d postgres
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

The committed [`compose.yaml`](compose.yaml) is local-only convenience
configuration. It uses demonstration credentials and binds PostgreSQL to
loopback only; it must not be used for the client production database,
which uses the client-owned Supabase URLs.
Stop the local database with `docker compose down` and remove its persisted
demonstration data only when intentionally resetting the rehearsal environment
with `docker compose down -v`.

`npm run db:seed` is safe to run repeatedly on a development or rehearsal database. It upserts the demonstration catalogue, categories, variants, and placeholder product images; existing variant stock and existing product publication status are preserved so a repeat seed cannot silently reset inventory or republish an archived product, while newly created variants receive the demonstration stock quantity and newly created products start as published. It requires a reachable `DATABASE_URL`. In `NODE_ENV=production`, the script refuses to run unless `ALLOW_DEMO_SEED=true` is explicitly set.

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

Run the complete local release gate before sharing a preview or deploying. It
also runs the secret scan, administrator authorization audit, Prisma schema
validation, and desktop/mobile browser acceptance tests:

```cmd
npm run check:quality
```

Review dependency advisories separately before launch:

```cmd
npm audit --omit=dev
```

See [`docs/dependency-security.md`](docs/dependency-security.md) for the
current findings and upgrade decision. Do not run `npm audit fix --force`.

This gate does not replace provider-backed acceptance. After it passes, the
client-owned Supabase, Razorpay, Resend, Storage, and Vercel configuration must
still be verified with the test payment journey in the operations runbook.

For a client-owned Supabase project, validate the schema, generate the Prisma
client, apply committed migrations, and then seed only demonstration data when
that is explicitly intended:

```cmd
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:seed
```

Run `db:seed` only against a non-production or intentionally seeded database. For an intentional production-mode rehearsal, set `ALLOW_DEMO_SEED=true` for that command only; never use it for the approved launch catalogue.
Production catalogue data should be imported through the protected admin CSV
dry-run/import flow after the client approves the content.
Use [`docs/catalogue-import-template.csv`](docs/catalogue-import-template.csv) as
the starting format; replace its example row before uploading it.

With local placeholder database variables, validate the Prisma schema with:

```cmd
set DATABASE_URL=postgresql://postgres:password@localhost:5432/nivara
set DIRECT_URL=postgresql://postgres:password@localhost:5432/nivara
npx prisma validate
```

Before deployment, create the Prisma migration against the client-owned Supabase project, configure Vercel environment variables, configure the Razorpay webhook URL, and verify the Resend sender domain. No provider secret belongs in Git.

To bootstrap the first administrator, first create and verify the account through Supabase Auth, then run `npm run admin:promote -- --email verified-user@example.com --confirm` from a controlled environment with the production `DATABASE_URL`. The command does not create accounts or accept unknown emails.

Run the production environment preflight in the deployment environment before
running migrations or accepting payments:

```cmd
npm run check:env
```

It checks variable presence, placeholder values, required URL formats, and
transactional/support email shape without printing secret contents.

After deployment, verify the live provider configuration without exposing
secrets:

```cmd
npm run check:provider -- --url https://your-deployment.example
```

The check calls `/api/health` and requires a connected database, direct
migration URL, canonical HTTPS site URL, and configured Auth, Storage,
Razorpay, Resend, support email, and cron secret. A degraded response is a
launch blocker.

See [`docs/operations-runbook.md`](docs/operations-runbook.md) for provider setup, cron, backup, restore, acceptance testing, and handover steps.
Use [`docs/acceptance-walkthrough.md`](docs/acceptance-walkthrough.md) as the
client-facing evidence worksheet for the provider-backed acceptance run.

## Delivery assumptions

India-only delivery, ₹79 below ₹999, free above that threshold, no COD, no automated refunds, no courier API, no marketplace sellers, and no mobile apps in this phase.
