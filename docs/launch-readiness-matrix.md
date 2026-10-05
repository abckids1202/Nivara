# Nivara Launch-Readiness Matrix

Use this matrix during the client handover. “Implemented” means the repository
contains the feature and its local tests; “External verification” requires the
client-owned providers and approved production content.

| Area | Current state | Evidence or next action |
| --- | --- | --- |
| Storefront catalogue | Implemented | Database-backed catalogue routes, URL filters, sorting, pagination, product slugs, loading, empty, and error states. Run `npm run test:e2e`. |
| Authentication and accounts | Implemented locally | Supabase Auth session, verification, password reset, profile, addresses, wishlist, order history, and cart merge are covered by route tests. Verify redirects with the client Supabase project. |
| Cart and checkout | Implemented locally | Server-side price/stock validation, shipping calculation, immutable snapshots, and guest access tokens are tested. Run the provider-backed checkout sequence after credentials are configured. |
| Payments and inventory | Implemented locally | Razorpay signature/webhook handling, idempotency, reservations, retries, expiry, and payment-review paths have deterministic tests. Send signed test events through the real Razorpay webhook before launch. |
| Administration | Implemented locally | Product, category, variant, image, stock, order, fulfilment, reports, review, and payment-review routes enforce server authorization. Promote the first verified client account with `npm run admin:promote`. |
| Reviews | Implemented locally | Delivered-order eligibility, verified-purchase labels, moderation, and approved-only public ratings are covered by tests. Confirm them in the full delivered-order walkthrough. |
| Accessibility and resilience | Implemented locally | Offline status, loading/error states, keyboard navigation, focus behavior, live search semantics, and responsive browser checks are covered by Playwright. Review the generated report on the client-approved catalogue. |
| SEO | Implemented locally | Metadata, canonical URLs, product metadata, sitemap, and robots responses are covered by browser checks. Re-run against the final canonical domain. |
| Security | Implemented locally | CodeQL, secret scanning, admin authorization audit, rate limiting, CSP/security headers, and safe logging are present. Review GitHub Actions and run the launch preflight. |
| Backups | Documented, not rehearsed | Follow the Supabase backup/restore runbook against a non-production target and record the result before launch. |
| Production providers | Pending client access | Configure Supabase, Vercel, Razorpay, Resend, Storage, domain, and cron; then run `npm run check:launch -- --url https://your-deployment.example`. |
| Content and handover | Pending client approval | Replace demonstration copy, imagery, policies, contact details, and catalogue data; complete the acceptance walkthrough and administrator handoff. |

## Release decision

Do not accept real orders until the provider readiness endpoint is healthy, the
client-approved catalogue and policies are live, the Razorpay test webhook has
been verified, and the complete browse-to-review acceptance journey has been
recorded.
