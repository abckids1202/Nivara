# Nivara Technical Foundation — Milestone 1

## Selected services and ownership

The planned production accounts belong to the client. The freelancer receives collaborator access. Local development uses `.env`; production values are configured in the hosting provider and never committed.

| Concern         | Selection                                | Ownership / note                                                                                             |
| --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Web application | Next.js, TypeScript, Node route handlers | Source repository owned by client                                                                            |
| Database        | PostgreSQL through Supabase              | Client-owned project; Prisma manages schema                                                                  |
| Authentication  | Supabase Auth                            | Email verification and password reset in MVP; Google deferred; `User.id` mirrors the Supabase Auth user UUID |
| Object storage  | Supabase Storage                         | Product images in MVP; review images deferred                                                                |
| Order email     | Resend                                   | Client-owned sender/domain configuration                                                                     |
| Payments        | Razorpay test environment                | Client supplies test keys and webhook access                                                                 |
| Hosting         | Vercel target                            | Client-owned deployment account                                                                              |
| Scheduled work  | Protected cron route                     | Expires reservations and retries reconciliation                                                              |

## State transitions

### Payment

`CREATED → PENDING → PAID`

`PENDING → FAILED | CANCELLED | PAYMENT_REVIEW`

`PAYMENT_REVIEW → PAID | FAILED | PAID_REVIEW`

`PAID_REVIEW → manually resolved`

Only verified provider notifications or a trusted reconciliation request may move an order to `PAID`. Browser redirects are informational.

### Inventory reservation

`ACTIVE → CONVERTED` after verified payment.

`ACTIVE → RELEASED` after verified failure/cancellation.

`ACTIVE → EXPIRED` only after the expiry worker checks provider state.

If a late payment arrives after expiry, the system checks stock transactionally. It either restores a valid reservation or marks the order `PAID_REVIEW` for manual resolution.

### Reviews

`PENDING → APPROVED | REJECTED` by an administrator.

The administrator records a reason but cannot edit the customer’s rating or written review. Only `APPROVED` reviews contribute to the public average.

## Implementation boundaries

- Public catalogue reads are separate from authenticated account and order writes.
- Admin routes verify the authenticated user and `isAdmin` on the server.
- Price and stock are authoritative in PostgreSQL; browser state is only a draft until checkout validation.
- Order items snapshot product name, variant name, SKU, unit price, and quantity.
- Guest tokens are stored hashed, expire after a defined period, are rate-limited, and authorize one order only.
- Vercel Cron invokes a protected route every five minutes; each job is retry-safe and idempotent.

## Week-one acceptance

Milestone 1 is ready for client review when the requirements checklist, three key screen designs, selected-service table, schema, state transitions, account ownership plan, and availability-based eight-week schedule are approved.
