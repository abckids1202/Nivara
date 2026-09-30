# Nivara MVP Requirements Checklist

## Customer experience

- [x] Mobile-first homepage with proposition, categories, featured products, promotion, delivery, and returns information.
- [x] Working Shop, New Arrivals, Best Sellers, and About navigation.
- [x] Catalogue search, category, price, and availability filtering.
- [x] Newest, best-rated, low-to-high, and high-to-low sorting.
- [x] URL-persisted catalogue state and useful empty state.
- [x] Product detail with gallery, required variant, price, stock, materials, dimensions, care, delivery, and reviews.
- [x] Persistent cart design with quantity, removal, variant detail, and totals.
- [x] Connected database cart persistence and authenticated merge behaviour.
- [x] Checkout design with contact, Indian address, delivery rule, order summary, and payment handoff.
- [x] Connected Razorpay test checkout and server-side order creation; live provider verification remains deployment work.
- [x] Account registration, email verification, login, password reset, profile, addresses, wishlist, and order history backed by Supabase/Auth and PostgreSQL routes.
- [x] Guest order access using a hashed, expiring, rate-limited token limited to one order.
- [ ] Support, FAQ, shipping, returns, privacy, and terms content pages.

## Administration

- [x] Protected admin dashboard with paid orders, order value, low stock, adjustment history, and review queue.
- [x] Product, category, image, variant, price, and stock management.
- [x] Draft, published, and archived product states.
- [x] Order search and payment/fulfilment detail.
- [x] Processing, shipped, and delivered transitions.
- [x] Courier name and tracking reference fields.
- [x] Review moderation with approve/reject and reason.
- [x] Backend-enforced administrator authorization.
- [x] Payment-review resolution with recorded reason and refund reference.

## Reliability and policy

- [x] Immutable order item snapshots.
- [x] Variant-level inventory and transactional reservations.
- [x] Price and availability revalidation at checkout.
- [x] Verified Razorpay webhook handling and duplicate-event idempotency.
- [x] Late-payment reconciliation with `PAYMENT_REVIEW` and `PAID_REVIEW` paths.
- [x] Manual refund recording; no automated refund claim.
- [x] Delivered-order review eligibility and verified-purchase label.
- [x] Only approved reviews affect the public average.
- [x] Administrators cannot rewrite rating or review body.
- [ ] Upload type and size restrictions when review photos are added later.
- [ ] No secrets in frontend code and no unnecessary sensitive data in logs.

## Handover

- [ ] Deployed demonstration preview.
- [x] Source repository, schema, migrations, and seed data.
- [x] Environment-variable template without secrets.
- [x] Setup, deployment, backup, and restoration instructions.
- [ ] Secure administrator account handoff.
- [ ] Known limitations and unfinished work list.
- [ ] Purchase, fulfilment, and review-approval walkthrough.
- [ ] Fourteen-day defect-fixing period for agreed requirements.
