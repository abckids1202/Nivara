# Nivara MVP Requirements Checklist

## Customer experience

- [x] Mobile-first homepage with proposition, categories, featured products, promotion, delivery, and returns information.
- [x] Working Shop, New Arrivals, Best Sellers, and About navigation.
- [x] Catalogue search, category, price, and availability filtering.
- [x] Newest, best-rated, low-to-high, and high-to-low sorting.
- [x] URL-persisted catalogue state and useful empty state.
- [x] Product detail with gallery, required variant, price, stock, materials, dimensions, care, delivery, and reviews.
- [x] Persistent cart design with quantity, removal, variant detail, and totals.
- [ ] Connected database cart persistence and authenticated merge behaviour.
- [x] Checkout design with contact, Indian address, delivery rule, order summary, and payment handoff.
- [ ] Connected Razorpay test checkout and server-side order creation.
- [ ] Account registration, email verification, login, password reset, profile, addresses, wishlist, and order history backed by Supabase/Auth and PostgreSQL.
- [ ] Guest order access using a hashed, expiring, rate-limited token limited to one order.
- [ ] Support, FAQ, shipping, returns, privacy, and terms content pages.

## Administration

- [x] Initial admin dashboard preview with paid orders, order value, low stock, and review queue.
- [ ] Product, category, image, variant, price, and stock management.
- [ ] Draft, published, and archived product states.
- [ ] Order search and payment/fulfilment detail.
- [ ] Processing, shipped, and delivered transitions.
- [ ] Courier name and tracking reference fields.
- [ ] Review moderation with approve/reject and reason.
- [ ] Backend-enforced administrator authorization.

## Reliability and policy

- [ ] Immutable order item snapshots.
- [ ] Variant-level inventory and transactional reservations.
- [ ] Price and availability revalidation at checkout.
- [ ] Verified Razorpay webhook handling and duplicate-event idempotency.
- [ ] Late-payment reconciliation with `PAYMENT_REVIEW` and `PAID_REVIEW` paths.
- [ ] Manual refund recording; no automated refund claim.
- [ ] Delivered-order review eligibility and verified-purchase label.
- [ ] Only approved reviews affect the public average.
- [ ] Administrators cannot rewrite rating or review body.
- [ ] Upload type and size restrictions when review photos are added later.
- [ ] No secrets in frontend code and no unnecessary sensitive data in logs.

## Handover

- [ ] Deployed demonstration preview.
- [ ] Source repository, schema, migrations, and seed data.
- [ ] Environment-variable template without secrets.
- [ ] Setup, deployment, backup, and restoration instructions.
- [ ] Secure administrator account handoff.
- [ ] Known limitations and unfinished work list.
- [ ] Purchase, fulfilment, and review-approval walkthrough.
- [ ] Fourteen-day defect-fixing period for agreed requirements.
