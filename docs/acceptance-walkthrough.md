# Nivara Acceptance Walkthrough

Use this worksheet after the client-owned Supabase, Razorpay, Resend, Storage,
and Vercel accounts are configured. Do not mark the walkthrough complete from
local mocks alone. Record the deployment URL, test order number, provider event
ID, and email result for the real test run.

## Preconditions

- [ ] `npm run check:env -- --production` passes in the deployment environment.
- [ ] `npm run check:provider -- --url <deployment-url>` returns HTTP 200.
- [ ] `npx prisma migrate deploy` has completed against the client database.
- [ ] Approved catalogue data and product images are imported.
- [ ] Supabase email confirmation and password-reset redirects use the deployed URL.
- [ ] Razorpay test webhook points to `/api/payments/razorpay/webhook`.
- [ ] Resend sender domain is configured, or the run is explicitly email-failure testing.
- [ ] One administrator account is available through the client-owned identity.

Record:

| Field | Value |
| --- | --- |
| Deployment URL | |
| Test customer email | |
| Test product / variant / SKU | |
| Test order number | |
| Razorpay provider order ID | |
| Razorpay provider event ID | |
| Confirmation email message ID | |
| Run date and timezone | |

## Customer journey

1. Open the deployed homepage on desktop and a mobile viewport.
2. Search for a known product, apply category and availability filters, and change sorting. Confirm the URL preserves the selected state after refresh.
3. Open the product page, select a required variant, verify price and available stock, and add it to the cart.
4. Refresh the page. Confirm the cart still contains the same variant and quantity.
5. Start checkout and verify the server-calculated subtotal, ₹79 delivery fee below ₹999, and free delivery at or above ₹999.
6. Submit an India address. Confirm the server rejects changed prices, unavailable stock, invalid address data, and stale cart quantities.
7. Confirm the order is created with immutable product, variant, SKU, price, quantity, and shipping snapshots. Record the order number.
8. Complete a Razorpay test payment. The browser confirmation page must remain informational while payment is being verified.
9. Deliver a signed `payment.captured` or `order.paid` webhook. Confirm the order becomes `PAID`, reservations become `CONVERTED`, stock is decremented, and the receipt is sent by Resend.
10. Replay the same provider event. Confirm it is reported as a duplicate and does not decrement stock or send a second receipt.

## Administration journey

1. Sign in as the administrator and confirm non-administrator accounts receive a server-side `403` from admin routes.
2. Search for the test order by order number and customer email.
3. Move fulfilment from `PROCESSING` to `SHIPPED`, adding courier and tracking reference details.
4. Move fulfilment from `SHIPPED` to `DELIVERED`. Confirm backward and skipped transitions are rejected.
5. Confirm the order history still shows the original product name, variant, SKU, price, and address snapshots.

## Review journey

1. As the customer, open the delivered order and submit one review for an eligible order item.
2. Confirm an undelivered order or a second review for the same order item is rejected.
3. As the administrator, reject the review with a reason, then repeat with a separate test review and approve it.
4. Confirm administrators cannot change the customer rating or review body.
5. Confirm only the approved review affects the public rating and the approved review shows the verified-purchase label.

## Failure-path checks

- [ ] Failed and cancelled Razorpay payments release active reservations.
- [ ] Pending or uncertain provider status enters `PAYMENT_REVIEW` after reconciliation.
- [ ] A reservation expires after ten minutes and releases reserved stock.
- [ ] A late captured payment with available stock is converted safely.
- [ ] A late captured payment without available stock enters `PAID_REVIEW` and is not fulfilled automatically.
- [ ] A failed confirmation email is retried by the protected reconciliation job.
- [ ] An expired guest link returns `404` and cannot access another order.
- [ ] Backup and restore rehearsal succeeds on a non-production target.

## Completion evidence

Attach or link the following before accepting the handover:

- [ ] Browser recording or screenshots for the customer, admin, and review journeys.
- [ ] Razorpay test event IDs and webhook responses.
- [ ] Resend test message result.
- [ ] Test output from `npm run check:quality`.
- [ ] Backup and restore result.
- [ ] Client approval of the production catalogue, policies, sender identity, and administrator access.

If any provider-backed step fails, record the order number, provider event ID,
current payment/fulfilment state, and administrator action. Never manually mark
an order paid from the browser or silently edit historical order snapshots.
