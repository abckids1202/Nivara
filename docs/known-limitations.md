# Nivara Known Limitations and Launch Checklist

This document separates the implemented practice MVP from the work that still requires client-owned accounts, approved content, or a later scope decision.

## Required before a real launch

- Configure the client-owned Supabase project, PostgreSQL URLs, Auth settings, Storage bucket, and production service-role key in Vercel.
- Run `npx prisma migrate deploy` and seed only approved catalogue data.
- Configure Razorpay test credentials and verify the webhook with a signed test event before switching to the intended payment mode.
- Configure Resend and verify the client sender domain.
- Set the production `NEXT_PUBLIC_SITE_URL`, deploy to Vercel, and run the complete acceptance journey in the operations runbook.
- Replace demonstration contact details, product copy, imagery, delivery information, returns policy, privacy text, and terms with client-approved content.
- Create and securely transfer the first administrator account through the client-owned identity and hosting accounts.
- Rehearse backup and restore against a non-production target.

## Implemented MVP boundaries

- This is a single-retailer ecommerce website, not a marketplace.
- Razorpay integration is designed for test mode; the browser redirect never confirms payment.
- Order confirmations are receipts; GST invoices are not generated.
- Returns, refunds, and payment-review resolutions are recorded manually.
- Fulfilment is limited to processing, shipped, and delivered states with manual courier and tracking fields.
- Shipping is India-only: ₹79 below ₹999 and free at or above ₹999.
- Guest-order links expire after seven days and expose only one order.
- Product removal is archive-only.
- Review photos, Google sign-in, COD, international shipping, courier APIs, recommendations, mobile apps, chat, push notifications, PWA installation, and advanced analytics are deferred.

## Demonstration limitations

- The repository includes seed/demo data and a storefront browser test suite, but no provider-backed purchase has been completed without client credentials.
- The support form currently confirms that a message was prepared; it does not send email until a client-approved support destination is connected.
- The default sender, contact details, policies, and `nivara.example` fallback URL are placeholders until production configuration is supplied.

## Operational safeguards

- Payment state is changed by verified Razorpay webhooks or protected reconciliation, never by a browser redirect.
- Failed or cancelled account and guest-link orders can retry payment against the same order; a new order is not created.
- Inventory reservations are transactionally locked and expire through the protected reconciliation job.
- Authentication and guest-order access use hashed request fingerprints for rate limiting; old access logs are retained for 30 days.
- Secrets are supplied through environment variables and are not intended for source control or browser responses.
