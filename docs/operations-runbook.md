# Nivara Operations Runbook

This runbook covers the remaining client-owned setup and the repeatable checks for the Nivara single-retailer store. Production credentials belong in Vercel or a local `.env`; never commit them.

## First deployment

1. Create the client-owned Supabase project and copy its pooled PostgreSQL URL to `DATABASE_URL` and direct connection URL to `DIRECT_URL`.
2. Run `npx prisma migrate deploy` against the production database, then run `npm run db:seed` only when demonstration catalogue data is intentionally wanted.
   This applies the access-rate log migration used by authentication and other sensitive endpoints.
3. Enable Supabase Auth email/password, email confirmation, and password recovery redirects for the deployed site.
4. Create a private Supabase service-role key and a `product-images` Storage bucket with public reads and admin-only application writes. Set `SUPABASE_STORAGE_BUCKET` if using another bucket name.
5. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Keep the service-role key server-only.
6. Configure Razorpay test keys and webhook secret. Point the webhook to `/api/payments/razorpay/webhook` and set `CRON_SECRET`.
7. Configure Resend and verify the client sender domain before sending real order mail.
8. Set `NEXT_PUBLIC_SITE_URL` to the deployed canonical URL and configure the Vercel Cron job for `/api/jobs/reconcile` every five minutes with `Authorization: Bearer $CRON_SECRET`.
   The same job retains rate-limit and guest-access-attempt records for 30 days, then removes older entries.

## Acceptance sequence

Run the following with seeded data and Razorpay test credentials:

1. Browse, search, filter, select a required variant, add to cart, refresh, and confirm the cart persists.
2. Submit checkout and verify the server rechecks price, stock, address, shipping, and creates a ten-minute reservation.
3. Complete a Razorpay test payment. Confirm the browser only reports “being verified”; the webhook changes payment state.
4. Replay the same webhook and confirm the provider event is ignored as a duplicate.
5. Verify confirmation email is sent only after captured payment is processed.
6. Use the admin workspace to update fulfilment and tracking, then mark the order delivered.
7. Submit a customer review, confirm it is pending, approve it as admin, and confirm only the approved review affects the product average.
8. Test a failed, cancelled, expired, and late payment. Resolve uncertain orders through the payment-review queue and record any manual refund reference.
   For an authenticated failed or cancelled order, use `POST /api/orders/{orderNumber}/retry-payment`; it reuses the original order and creates a fresh payment attempt after rechecking stock.

The repository includes `npm run test:e2e` for desktop/mobile storefront checks and `npm run test` for deterministic business rules. Provider-backed acceptance requires the client credentials above.

## Backup and restore

Use Supabase’s scheduled backups and retain an independent export before schema changes. For a manual logical backup, use the Supabase/PostgreSQL `pg_dump` connection from the client project:

```cmd
pg_dump --format=custom --file=nivara-backup.dump "%DIRECT_URL%"
```

Restore only into a confirmed maintenance target after checking the destination:

```cmd
pg_restore --clean --if-exists --dbname="%DIRECT_URL%" nivara-backup.dump
```

After restoration, run `npx prisma migrate deploy`, check `/api/health`, verify a published product, and run the acceptance sequence. Do not restore production over a live database without a maintenance window and an additional backup.

## Incident rules

- Never mark an order paid from a browser redirect.
- Treat `PAYMENT_REVIEW` and `PAID_REVIEW` as manual operational queues.
- Do not edit historical order snapshots to correct catalogue data.
- Use archive status instead of deleting published products.
- Rotate provider secrets if they appear in logs or a local file is shared.
- Rate-limit logs contain only a hashed request fingerprint and endpoint name; do not add email, password, token, or payment details to them.
- Record administrator reasons and refund references for every payment-review decision.
