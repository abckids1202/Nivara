# Nivara provider handoff checklist

Use this checklist with the client before accepting real orders. The client owns
all production accounts; the freelancer receives collaborator access only. Never
paste secret values into GitHub, chat, screenshots, or issue comments.

## Account setup

| Provider | Client action | Values/configuration required | Evidence |
| --- | --- | --- | --- |
| Supabase | Create the production project and invite the freelancer | Pooled `DATABASE_URL`, direct `DIRECT_URL`, project URL, anon key, service-role key, Auth email confirmation, password-reset redirect, `product-images` Storage bucket | Migration status is clean; `/api/health` reports database, Auth, and Storage ready |
| Vercel | Create or connect the production project | Production domain, all environment variables from `.env.example`, Vercel Cron enabled for `/api/jobs/reconcile` every five minutes | HTTPS deployment serves the expected commit |
| Razorpay | Create a test-mode account and webhook | Test key ID/secret, webhook secret, webhook URL `/api/payments/razorpay/webhook` | Signed test event is accepted once and ignored on replay |
| Resend | Verify the client sender domain | API key, `RESEND_FROM_EMAIL`, support address | Captured test payment sends one confirmation email |
| Domain/DNS | Point the client-owned domain to Vercel | `NEXT_PUBLIC_SITE_URL` set to the canonical HTTPS origin | Canonical URL, sitemap, and robots output use the production domain |

## Required sequence

1. Copy `.env.example` into the deployment environment and replace every
   placeholder. Keep secrets server-only.
2. Run `npm run db:validate`, `npm run db:generate`, `npm run db:migrate`, and
   `npm run db:status` against the client-owned Supabase project.
3. Configure Auth email confirmation and password recovery redirects for the
   canonical site. Create and verify the first administrator account.
4. Promote that verified account with
   `npm run admin:promote -- --email verified-user@example.com --confirm`.
5. Import the approved catalogue through the administrator CSV dry-run before
   performing the real import. Do not use demonstration seed data for launch.
6. Run `npm run check:provider -- --url https://your-deployment.example`.
7. Run the acceptance worksheet in
   [`acceptance-walkthrough.md`](./acceptance-walkthrough.md): browse, filter,
   variant selection, cart, checkout, signed payment webhook, email, fulfilment,
   delivered review, and moderation.
8. Run `npm run check:launch -- --url https://your-deployment.example` only after
   the provider-backed walkthrough passes.

## Launch sign-off

Record these values in the private handover record, not in the repository:

- Production URL and deployed commit:
- Supabase migration status:
- First administrator account confirmed:
- Approved catalogue import completed:
- Razorpay test payment and webhook event IDs:
- Confirmation email delivery result:
- Backup/restore rehearsal result:
- Remaining client-approved limitations:
- Client approval date and owner:

Real orders remain disabled until the provider readiness endpoint is healthy,
the canonical domain is verified, the Razorpay test event has been replayed
safely, and the complete acceptance sequence is recorded.
