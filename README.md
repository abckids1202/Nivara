# Nivara Store

Responsive ecommerce storefront and administration-panel prototype for Nivara, a focused Indian home and everyday-living retailer.

## Current milestone

Milestone 1 foundation and storefront slice:

- Mobile-first homepage.
- Catalogue discovery with URL-persisted filters.
- Product detail design with required variant selection.
- Checkout design with delivery calculation and Razorpay test handoff state.
- Initial administration dashboard.
- Demo product data and generated editorial image.
- Requirements checklist, PostgreSQL/Prisma schema, and payment/inventory state transitions.

The database, authentication, Razorpay, email, admin authorization, and scheduled reconciliation integrations are scaffolded as the next connected implementation layer. The current UI uses demonstration data and clearly labels demonstration states.

## Run locally

```bash
npm install
npm run dev
```

Use the local URL printed by the dev server. Do not add real credentials to the repository; copy `.env.example` to `.env` and fill only local/test values.

## Routes

- `/` — mobile-first storefront homepage.
- `/shop` — searchable and filterable catalogue.
- `/product/arc-desk-organizer` — product detail and variant interaction.
- `/checkout` — checkout design and test payment handoff state.
- `/admin` — administration dashboard preview.

## Delivery assumptions

India-only delivery, ₹79 below ₹999, free above that threshold, no COD, no automated refunds, no courier API, no marketplace sellers, and no mobile apps in this phase.
