# EmailVerify Build Roadmap

This guide turns the current UX shell into a production-ready email verification SaaS while keeping the first release intentionally small.

## Product decisions

- Launch with pay-as-you-go credit purchases first.
- Fund the initial launch from the exact 2,788,318-credit AppSumo provider balance.
- Allocate 2,500,000 credits for customer sales and hold 288,318 credits as the provider reserve.
- Use the same package sizes shown in the reference product: 5K, 10K, 25K, 50K, 100K, 250K, 500K, and 1M credits.
- Set retail prices in Stripe. Keep Stripe Price IDs in our server-side package catalog and read the amount from Stripe when creating the purchase record. Do not calculate prices from the upstream provider or trust an amount sent by the browser.
- Add subscriptions only after pay-as-you-go checkout, credits, refunds, and reconciliation are proven.
- Use Stripe Checkout for payment collection and Stripe Customer Portal for billing management.
- Use Resend for transactional and internal admin email.
- Use Supabase for authentication and PostgreSQL. Keep the existing Express server as the only service allowed to call Stripe, Resend, the database, and the verification provider.
- Start with three workspace roles: `owner`, `admin`, and `member`.

## Package catalog

These package quantities match the supplied screenshots and the current public Emailable package selector.

| Package ID | Credits | PAYG price | Subscription price | Status |
| --- | ---: | ---: | ---: | --- |
| `credits_5k` | 5,000 | Configure | Later | MVP |
| `credits_10k` | 10,000 | Configure | Later | MVP |
| `credits_25k` | 25,000 | $141 reference | Later | MVP |
| `credits_50k` | 50,000 | Configure | Later | MVP |
| `credits_100k` | 100,000 | Configure | Later | MVP |
| `credits_250k` | 250,000 | Configure | Later | MVP |
| `credits_500k` | 500,000 | Configure | Later | MVP |
| `credits_1m` | 1,000,000 | Configure | Later | MVP |

The `$141` value is taken from the supplied 25K screenshot and is only a reference. EmailVerify will be priced slightly below the reference product, with final prices managed in Stripe. Before launch, confirm every sell price and decide the free signup allowance. Keep `retail_price_cents`, `provider_cost_cents`, and `stripe_price_id` separate for reporting even though Stripe is the authority for the charged amount.

The initial provider credits were prepaid through AppSumo, so the useful first metric is cash recovered per provider credit sold. Still reserve for Stripe fees, refunds, support, infrastructure, free credits, and unbillable results. Approve a floor price for every package even when Stripe contains the editable retail price.

Suggested server-side record:

```js
{
  id: 'credits_25k',
  name: '25,000 credits',
  credits: 25000,
  retailPriceCents: null, // synchronized from Stripe for reporting
  providerCostCents: null,
  stripePriceId: 'price_...',
  active: true
}
```

## Simple architecture

```text
React + Vite
    |
    v
Express API
    |-- Supabase Auth + PostgreSQL
    |-- Stripe Checkout + webhooks
    |-- Resend transactional email
    `-- Verification provider API
```

The browser never receives private provider, Stripe secret, Resend, or database service keys.

## Core data model

Use an append-only credit ledger as the source of truth. A cached balance may be stored for fast reads, but every adjustment must have a ledger entry.

| Table | Purpose | Important fields |
| --- | --- | --- |
| `profiles` | User identity and app role | `user_id`, `name`, `email`, `system_role` |
| `workspaces` | Customer account | `id`, `name`, `stripe_customer_id`, `status` |
| `workspace_members` | User access | `workspace_id`, `user_id`, `role` |
| `credit_accounts` | Fast current balance | `workspace_id`, `available`, `reserved` |
| `credit_ledger` | Auditable credit history | `id`, `workspace_id`, `type`, `amount`, `reference_type`, `reference_id`, `created_at` |
| `provider_inventory` | Tracks the prepaid provider pool | `provider`, `starting_credits`, `sales_allocation`, `reported_available`, `allocated_to_customers`, `safety_reserve`, `synced_at` |
| `packages` | Server-controlled catalog | `id`, `credits`, `retail_price_cents`, `stripe_price_id`, `active` |
| `purchases` | Stripe checkout state | `id`, `workspace_id`, `package_id`, `stripe_session_id`, `amount_cents`, `status` |
| `webhook_events` | Webhook idempotency | `provider`, `event_id`, `processed_at`, `status` |
| `verification_requests` | Single/API requests | `id`, `workspace_id`, `email_hash`, `state`, `credits_used`, `provider_request_id` |
| `batches` | Uploaded lists | `id`, `workspace_id`, `name`, `status`, `total`, `billable`, `provider_batch_id` |
| `api_keys` | Customer API credentials | `id`, `workspace_id`, `prefix`, `secret_hash`, `last_used_at`, `revoked_at` |
| `email_events` | Resend audit trail | `template`, `recipient`, `reference_id`, `provider_id`, `status` |

Never store customer API keys in plaintext. Show the full secret once, then store only a cryptographic hash and a visible prefix.

## Build phases

### Phase 0: commercial and provider gate

1. Confirm the upstream agreement permits resale and white-label use.
2. Create all eight prices in Stripe. Prices may be edited there before launch without changing application code.
3. Choose the signup credit amount.
4. Choose the production domain, sending subdomain, support address, and `ADMIN_EMAIL`.
5. Define whether unknown results and duplicates are refunded. The recommended policy is to mirror provider settlement exactly.

Exit criteria: an approved package sheet with price, cost, margin, Stripe product name, and refund behavior for every tier.

### Inventory policy for the prepaid credits

Customer balances are obligations against the shared provider pool. Purchased but unused customer credits still count as allocated inventory, even before a verification request reaches the provider.

Use this availability rule:

```text
sellable credits = provider reported balance
                 - customer credits already allocated but unused
                 - pending checkout reservations
                 - operating safety reserve
```

Recommended launch controls:

1. Record `2,788,318` as the opening provider balance and reconcile it against the provider API before opening checkout.
2. Cap the customer sales allocation at `2,500,000` credits.
3. Hold the remaining `288,318` credits as an operating reserve. This is approximately 10.34% of the current provider balance.
4. Reserve a package's credits when Checkout begins for a short expiration window. Release the reservation when the session expires or fails.
5. Disable packages larger than the current sellable inventory. Never accept a payment that cannot be backed by provider credits.
6. Send admin alerts at 25%, 10%, and 5% of the 2.5M sales allocation remaining.
7. Show total provider balance, sales allocation, allocated customer balances, consumed provider credits, reserve, and remaining sellable credits in admin.
8. When the sales allocation approaches zero, pause checkout. Releasing any part of the 288,318-credit reserve requires an explicit admin adjustment with a recorded reason.

The initial maximum sellable pool is exactly 2,500,000 credits before accounting for free signup credits or credits already consumed. Free signup credits must come out of this allocation so customer liabilities never exceed the approved pool.

### Phase 1: authentication and tenancy

1. Create the Supabase project and migrations.
2. Connect signup, login, logout, password reset, and email confirmation to Supabase Auth.
3. Create a workspace automatically for the first user and assign `owner`.
4. Add Express authentication middleware that validates the Supabase token.
5. Replace all demo profile, balance, list, API key, and usage data with workspace-scoped API calls.
6. Protect `/app` and `/admin`; redirect signed-out users to login.

Exit criteria: two users cannot read or change each other's data, and admin routes reject non-admin users.

### Phase 2: credit ledger

1. Implement database transactions for `grant`, `reserve`, `consume`, `release`, `refund`, and `admin_adjustment` entries.
2. Prevent the available balance from going below zero.
3. Add `GET /api/v1/credits` and `GET /api/v1/credits/ledger` for the signed-in workspace.
4. Add an admin-only credit adjustment endpoint with reason and actor audit fields.
5. Add tests for simultaneous reservations, duplicate settlement, and refunds.

For verification, use a reserve-and-settle flow:

1. Reserve the maximum possible credits in a database transaction.
2. Call the provider.
3. Convert the reservation to consumption for billable results.
4. Release or refund credits for duplicates, unknown results, or failed provider calls according to policy.

Exit criteria: retries and concurrent requests cannot double-charge or create a negative balance.

### Phase 3: Stripe pay-as-you-go billing

1. Create one Stripe Product and one one-time Price for each active package.
2. Seed the package catalog with the corresponding `stripe_price_id` values. Retrieve and store the actual Stripe amount on each purchase so later Stripe price changes do not alter purchase history.
3. Build `GET /api/v1/billing/packages`; render the Buy Credits page from this response.
4. Build `POST /api/v1/billing/checkout-sessions` with only a `packageId` from the browser.
5. On the server, verify sellable inventory, create a short-lived inventory reservation, look up the Stripe Price ID, attach `workspace_id`, `purchase_id`, and `package_id` metadata, then create Checkout.
6. Build `POST /api/v1/webhooks/stripe` using the unmodified raw request body and verify the Stripe signature.
7. On `checkout.session.completed`, record the event, mark the purchase paid, and grant credits in one database transaction.
8. Make fulfillment idempotent using the unique Stripe event ID and Checkout Session ID, then convert the inventory reservation into allocated customer credits.
9. Build `POST /api/v1/billing/portal-sessions` for invoices and payment-method management.
10. Make the success page poll the purchase API. Never grant credits merely because the customer returned to the success URL.

Minimum webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Exit criteria: duplicate webhook delivery grants credits once, failed payment grants none, and refunds create traceable ledger adjustments.

### Phase 4: live verification and batches

1. Put all provider response mapping in `server/services/verificationProvider.js`.
2. Normalize results into EmailVerify-owned states: `deliverable`, `risky`, `undeliverable`, and `unknown`.
3. Persist provider reason, score, and metadata needed by the results UI.
4. Add CSV upload validation, deduplication, background processing, status polling, and result export.
5. Add customer API keys with per-key rate limits and workspace metering.
6. Add retry rules for timeouts and temporary provider failures without double consumption.

Exit criteria: single, bulk, and customer API verification all use the same credit service and normalized result schema.

### Phase 5: Resend and minimal admin

Install Resend on the server and verify a dedicated sending subdomain such as `send.example.com`.

Customer emails:

- Welcome and email confirmation support
- Credits purchased
- Batch complete or failed
- Low credit threshold
- Team invitation

Admin emails sent to `ADMIN_EMAIL`:

- New paid customer
- Purchase or webhook failure
- Provider balance below threshold
- Batch failure after retries
- Support form submission

Use a stable idempotency key such as `purchase-confirmation/{purchaseId}` so a retry does not send a duplicate email. Stripe should remain the source for official payment receipts; our email confirms credits were added.

The first admin screen only needs:

- Searchable users and workspaces
- Balance and credit ledger
- Purchases and webhook status
- Manual credit adjustment with a required reason
- Provider balance and recent failures
- Suspend/reactivate workspace

Exit criteria: admins can resolve common account issues without database access, and every sensitive action is audited.

### Phase 6: subscriptions after PAYG is stable

1. Add recurring Stripe Prices to the same package catalog.
2. Support monthly first; add quarterly/yearly only when needed.
3. Grant the cycle's credits on `invoice.paid`, not when a subscription object is created.
4. Handle `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Let unused credits roll over only if that is the approved product policy.
6. Use Stripe Customer Portal for cancellation and payment method changes.

Exit criteria: renewals grant once, failed renewals grant none, and cancellation does not remove previously purchased credits.

## API surface

```text
POST   /api/v1/auth/workspace-bootstrap
GET    /api/v1/me
GET    /api/v1/credits
GET    /api/v1/credits/ledger
GET    /api/v1/billing/packages
POST   /api/v1/billing/checkout-sessions
POST   /api/v1/billing/portal-sessions
GET    /api/v1/billing/purchases/:id
POST   /api/v1/webhooks/stripe
POST   /api/v1/verify
POST   /api/v1/batches
GET    /api/v1/batches/:id
GET    /api/v1/batches/:id/export
GET    /api/v1/admin/workspaces
POST   /api/v1/admin/workspaces/:id/credit-adjustments
POST   /api/v1/support/requests
```

## Environment variables

```dotenv
# App
NODE_ENV=development
APP_URL=http://127.0.0.1:5173
API_PORT=8787
ADMIN_EMAIL=admin@example.com

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
EMAIL_FROM=EmailVerify <notifications@example.com>
SUPPORT_EMAIL=support@example.com

# Verification provider
EMAILABLE_API_KEY=
EMAILABLE_BASE_URL=https://api.emailable.com/v1
PROVIDER_LOW_CREDIT_THRESHOLD=25000
```

Only `VITE_` variables are exposed to browser code. No secret in this list should use that prefix.

## Test and launch checklist

- Unit test package lookup, credit math, response normalization, and role checks.
- Integration test checkout creation, webhook replay, refund adjustment, and insufficient credits.
- Test Stripe locally with the Stripe CLI and test clocks where applicable.
- Verify Stripe webhook signatures against the raw body.
- Rate-limit login, verification, API-key, upload, and support endpoints.
- Validate CSV type, size, row count, and column mapping.
- Add request IDs and structured logs without recording full email lists or secrets.
- Encrypt sensitive provider metadata and define data retention/deletion rules.
- Configure database backups and restore testing.
- Verify SPF, DKIM, and DMARC for the Resend sending domain.
- Add Terms, Privacy, Acceptable Use, refund terms, and consent language before launch.
- Run desktop and mobile browser tests for signup, purchase, single verification, bulk upload, export, billing, and admin.
- Reconcile total purchased credits, manual adjustments, consumed credits, and current balances before launch.

## Recommended implementation order

1. Supabase auth and schema.
2. Workspace access middleware.
3. Credit ledger service and tests.
4. Server-side package catalog.
5. Stripe Checkout and webhook fulfillment.
6. Resend purchase/admin notifications.
7. Live single verification with credit settlement.
8. Bulk processing and exports.
9. Customer API keys and rate limits.
10. Minimal admin dashboard.
11. Subscription billing.

This order gets a sellable PAYG product online without making subscriptions, team management, or advanced automation prerequisites for launch.

## Reference documentation

- [Emailable pricing](https://emailable.com/pricing/)
- [Emailable credit behavior](https://emailable.com/docs/manage-your-account/billing/how-credits-work/)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Resend Node.js guide](https://resend.com/nodejs)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
