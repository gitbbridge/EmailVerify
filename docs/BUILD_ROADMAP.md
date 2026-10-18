# EmailVerify Build Roadmap

## Delivery rule

### Render release preparation (October 18)

Added a single-service Express runtime serving the built React frontend, JSON API fallbacks, private-file/asset handling, container health checks, a non-root Docker image, Render Blueprint, production environment validation and graceful shutdown. The app derives its initial public origin from Render's `RENDER_EXTERNAL_URL`. Signup IP fingerprinting uses the configured trusted proxy boundary. Checkout returns to the Billing route on reload.

Local verification passed: frontend build; three deployment tests covering serving, headers, API errors, private files, proxy identity and production configuration; upload parser/permission tests; upload retry-storage tests; existing Stripe unit tests. GitHub Actions repeats these checks without private credentials. Docker image build, Render deployment and hosted acceptance are not yet verified. Render account connection is required to provision and inspect the service. See `RENDER_DEPLOYMENT.md`.

### Live billing reporting (September 22)

The billing page now reads a service-only, workspace-scoped database summary instead of demo metrics. It reports available/reserved credits, the latest credit addition, settled consumption by channel, UTC daily/monthly buckets, and the latest 20 purchases. Filters, refresh, loading, empty and failure states are wired. The existing Stripe portal endpoint is connected for linked customers; failures remain on the billing page without clearing the session. Nonfunctional auto-refill controls and the unsupported depletion estimate were removed.

Billing HTTP routes require an active workspace and owner/admin role. Purchase/subscription RLS now applies the same role restriction. The summary RPC is executable only by service_role. Apply with `npm run db:billing`; applied to the configured database on September 22.

Evidence: `npm run test:billing` checks real Supabase authentication, owner/admin/member and removed-member access, database tenant isolation, 1,005 consumption entries without truncation, reserved/released exclusion, channel attribution, recent purchase limit, and direct authenticated purchase RLS. Browser tests in `tests/browser/billing.spec.js` check mocked data, filters, empty/error states, portal failure and mobile/desktop layouts. `npm run build` passes.

Still unfinished: Stripe test-mode Checkout/webhook/refund/portal round-trip with a real customer account, historical guest-purchase reconciliation, monthly renewals/expiration/cancellation, and automatic refill. This reporting work does not certify the complete payment lifecycle for launch. Purchase history shows credit quantities/status, not amounts, until persisted currency and Stripe price reconciliation are verified. API usage attribution uses retained verification records and API key IDs; keys must remain soft-revoked rather than hard-deleted to preserve historical attribution.

### Stripe checkout hardening (September 22)

The one-time checkout path now creates/reuses a workspace Stripe Customer with an idempotency key, validates the Stripe Price against the internal package before reserving inventory, requires a UUID `Idempotency-Key`, persists checkout identity, and can resume a pending Checkout Session after a lost browser redirect. Expired pending reservations are released before a new checkout. Webhooks retrieve the authoritative Checkout Session, require matching test/live mode, require `payment_status=paid`, validate purchase/customer/package/amount/currency/session metadata in a service-only SQL function, and remain replay-safe through Stripe event IDs. Refunds and disputes record risk and suspend the workspace for reconciliation.

The current `.env` still has a `pk_test_...` publishable key in `STRIPE_TEST_SECRET_KEY`. Replace it with the matching server secret `sk_test_...` or restricted `rk_test_...`; the app intentionally refuses the publishable key. Do not place either key in `VITE_` variables or commit `.env`.

### Upload retry persistence (September 22 follow-up)

Pending multipart upload keys now survive page reloads and navigation within the same browser tab using session storage. Keys are scoped by workspace and a SHA-256 fingerprint of filename/content; raw filenames, email lists and file bytes are not stored. Successful responses clear only the matching pending key. Storage failure stops submission with a visible error. This supersedes the earlier navigation limitation below.

Verification: `node --test tests/uploadAttempt.test.js` checks workspace separation, stale-response cleanup, and storage failure. Desktop/mobile upload browser tests simulate a failed response, reload, retry with the same key, then an intentional fresh import with a new key. API/database enforcement remains the previously tested workspace/request-key unique index; no schema change is needed for this follow-up.

Limit: session storage does not guarantee recovery after closing the tab, clearing site data, switching origins or changing browsers. Provider processing/recovery, large archive ingestion and distributed import limits remain outstanding.

### Authenticated import acceptance (September 22)

Implemented and verified: multipart imports use a required `Idempotency-Key`, with a database unique index per workspace and a normalized-content hash. Replays return the existing batch; changed content with the same key returns 409. The browser keeps the same key when retrying an unsuccessful upload in the mounted list view. Successful uploads clear the key so another intentional import is possible. Refreshing/navigating away does not preserve the browser retry key.

`npm run test:upload:integration` creates temporary verified Supabase users and workspaces, runs the real HTTP authentication/parser/storage path, checks normalized private files, sequential and concurrent deduplication, changed-content rejection, invalid-file rejection, foreign workspace isolation, removed-member rejection, and no credit reservation while awaiting approval. Temporary database/auth/storage fixtures are removed. Approval notification delivery is stubbed in this test, and no verification provider calls are made.

Migration: `202609220001_batch_import_idempotency.sql`, applied with `npm run db:import-idempotency`. Browser upload tests additionally check request headers and key reuse after interrupted requests. Playwright now uses a dedicated port (5193, configurable with `PLAYWRIGHT_PORT`) rather than reusing another running application.

Still unfinished: approval-to-provider processing/settlement recovery, durable notification retries, large archive ingestion, distributed import rate limits, and retry-key persistence across navigation. JSON `/batches` submissions still require a separate idempotency contract. These limits supersede the earlier broad completion claims below.

### Server file import (September 19)

Implemented: authenticated multipart `POST /api/v1/batches/upload`, CSV/TXT/XLSX parsing, normalization and duplicate removal, 10 MB file limit, 250,000 unique-address limit, private normalized submission storage through the existing batch workflow. One email per cell or TXT line is accepted; malformed email cells are counted and reported. No new database schema is required.

Parsing runs in a worker with a 15-second timeout and 128 MB V8 heap limit. Each server process permits two active imports and one per workspace. These are process-local limits, not a distributed rate limiter; native/decompression memory requires deployment-level process limits.

Verified: `npm run test:upload` covers actual XLSX, CSV quotes/BOM, TXT, duplicates, malformed/oversized inputs and unauthenticated HTTP denial. Browser upload tests verify multipart authorization, approval feedback and error recovery on desktop/mobile with API fixtures. Dependency audit reported zero known vulnerabilities.

Unfinished: authenticated upload-to-storage integration tests, provider failure/retry tests, large provider archive ingestion, durable distributed import throttling, and repeat-submission idempotency. The full customer list lifecycle is not yet launch-ready. Earlier statements that call the complete workflow finished should be read with these limitations.

Complete each feature through UI, API, database, permissions, and tests; clearly identify anything unfinished.

This project is a deployable SaaS product and a portfolio demonstration of production engineering. A polished screen or successful build does not establish production readiness.

## Production delivery plan (revised September 19, 2026)

This section is the current source of truth. The original phases and historical status below remain useful implementation context, but their "complete in code" wording does not mean a feature has passed integration tests or is launch-ready.

### Definition of done

Each feature must have persisted behavior, server-side validation, tenant and role authorization, usable loading/error/empty states, and appropriate automated verification. Changes involving money, identity, or permissions require negative-path and retry/concurrency coverage. Database changes ship as migrations. UI controls must either perform their stated action or clearly communicate unavailability. Preview fixtures must remain distinct from authenticated customer data.

Record evidence at three separate levels:

- Implemented: code and schema exist; a build is only a compilation check.
- Verified: named tests demonstrate the expected behavior, including relevant failure cases.
- Launch-ready: verified behavior also works in the deployed environment with production configuration and operational ownership.

### Current assessment

| Area | Evidence today | Remaining work |
| --- | --- | --- |
| Marketing and visual design | Existing responsive UI, local Inter font assets, branded email rendering observed | Copy must match actual capabilities; accessibility and complete responsive coverage |
| Authentication | Signup/login/confirmation plus a verified password recovery lifecycle; durable reset throttles | Confirm production redirect allowlist and delivery; add login/signup abuse controls and broader session-expiry coverage |
| Profile | Authenticated name/workspace update endpoint and controlled form implemented | Atomic profile/workspace changes, refresh state synchronization, audit and permission tests |
| Account and team | New migration, tenant-scoped endpoints, invite/acceptance UI, roles/removal and branded invite delivery code | See team verification evidence below; confirm real invite delivery and production auth redirect allowlist before launch |
| Credits and inventory | Ledger, reserve/settle functions, prepaid inventory policy implemented | Concurrent reservations, reconciliation, retry/failure integration suite |
| PAYG billing | Checkout, signed webhook handling and portal endpoints implemented | End-to-end Stripe test-mode purchase, webhook replay, refund and return-flow verification; UI must use real billing data |
| Monthly billing | Catalog exists, checkout deliberately disabled | Renewal/expiration/cancellation fulfillment and inventory tests before enabling |
| Verification and lists | Authenticated batch upload, persisted results, selected-batch detail, filters, search, pagination and exports implemented | Verify provider archive-to-result ingestion for large lists; add upload parsing coverage and provider failure/retry integration tests |
| Security and preferences | Working password-reset action; disconnected 2FA and notification controls removed | Design and implement 2FA and persisted notification preferences as separate complete features |
| Support and operations | Support endpoints, admin actions and retention worker implemented | Delivery failures/retries, audit review, scheduled-job reliability and recovery tests |
| Deployment | Local development is available | Staging deployment, HTTPS, environment validation, database backups, monitoring and release checklist |

### Next milestones, in order

1. Finish account and team acceptance: invitations, permission matrix, revocation, audit, no duplicate signup grants, and real identity integration tests.
2. Complete remaining authentication hardening: login/signup throttles, session-expiry behavior, production redirect allowlist and delivery checks. Password recovery itself is verified below.
3. Complete the customer verification journey: upload a list, follow progress, open that exact list, filter its real results and export them. The core path is now implemented; remaining work is large-provider-archive coverage, upload parsing tests and failure/retry evidence.
4. Prove the financial lifecycle in Stripe test mode and database integration tests. Reconcile grants and provider inventory. Enable monthly billing only after renewal and expiry tests pass.
5. Harden deployment and operations: environment-specific secrets, request validation/rate limits, logs with request IDs, durable scheduled jobs, error monitoring, backups and restore exercise.
6. Prepare the portfolio release: deployment URL, reproducible setup, architecture and tradeoffs document, CI checks, test evidence and a concise demo walkthrough.

### Team implementation and evidence

- Migration: `supabase/migrations/202609190001_workspace_team.sql`.
- SQL transactions serialize team mutations per workspace and re-check actor roles. Invite tokens are random 256-bit values stored only as SHA-256 hashes; invitations expire after seven days.
- Owners appoint administrators. Administrators invite/remove members; they cannot modify the owner, another administrator, or themselves. Removed or demoted administrators lose their created workspace API keys.
- Invite acceptance requires a verified matching email and an explicit join action. It does not create a workspace or issue free credits. Existing workspace membership is not transferred.
- Limits: ten invitations per workspace per hour and twenty active pending invitations. Revocation and membership changes are recorded in `team_events`.
- `npm run test:team:db`: runs database authorization/lifecycle tests inside a transaction and rolls back all fixtures and test migration changes. Requires `DATABASE_URL`; does not send email.
- `npm run test:browser`: runs desktop and mobile Edge tests with API fixtures. These verify UI behavior; they do not establish real provider delivery or end-to-end auth correctness.
- `npm run db:team`: applies the additive team migration transactionally to the configured database and reloads the API schema. Normal deployments should use the migration with the existing Supabase migration process.

### Password recovery implementation and evidence

- Recovery callbacks preserve Supabase's event type and route to a dedicated new-password form. Invalid and expired links offer a fresh reset request without exposing password inputs.
- New passwords require at least 12 characters with uppercase, lowercase and a number. Supabase verifies the access/refresh token pair, updates the user through the user-scoped client and revokes existing sessions globally.
- Reset requests return the same accepted response for unknown accounts, throttled requests and email-delivery failures. Delivery failures are logged without disclosing account existence to the caller.
- Database-backed limits allow three requests per normalized email and ten per IP fingerprint per 15 minutes. Raw email and IP values are not stored in the limiter.
- `npm run test:auth:db`: verifies concurrent limits, identifier isolation, window reset and direct-access denial.
- `npm run test:auth:integration`: creates and removes a disposable Supabase user, consumes a real recovery link through the local API, proves the old password fails, the new password succeeds and the old refresh token is invalidated. It does not send email.
- `npm run test:browser`: includes valid, mismatched and expired recovery callbacks plus the email-only request flow on desktop and mobile Edge.
- `npm run db:auth`: applies the additive recovery-rate-limit migration. Production deployment should use the normal Supabase migration process.
- Still required for launch: confirm the deployed `APP_URL` is in Supabase's redirect allowlist and perform one real branded recovery delivery on the production sending domain.

### Customer list implementation and evidence

- Migration: `supabase/migrations/202609190003_batch_results.sql` adds tenant-scoped, indexed result rows with cascade deletion when the parent list reaches retention expiry.
- `GET /api/v1/batches/:id/results` enforces workspace membership, validates filters, and returns bounded pages of real result rows. The export endpoint remains workspace-scoped and is the path for provider archives that are too large for inline detail results.
- The authenticated UI opens the selected batch, renders its real summary, filters by state, searches email results, paginates, downloads the selected batch export, and exposes status/retention/approval settings. Preview fixtures are only used when there is no authenticated session.
- `npm run test:batches:db` verifies authenticated tenant isolation, read-only grants, and duplicate-row protection. `npm run test:browser` covers the selected-batch results workflow through filtering, search, and pagination.
- Still required for launch: test CSV/TXT/XLSX parsing at the upload boundary, verify ingestion when the provider supplies only a large archive download, and add provider failure/retry integration coverage.

### Portfolio evidence to maintain

- A README that distinguishes local preview, authenticated functionality and unfinished work.
- An architecture explanation covering tenancy, secret boundaries, credit transactions, provider failures and billing idempotency.
- Executable tests, with their scope documented and credentials excluded from Git.
- Small reviewable changes explaining the problem, implementation choices and verification.
- A deployment/runbook showing how to configure, release, observe and recover the service.

Do not claim production readiness until the remaining launch criteria are evidenced. Prioritize completing and testing existing customer journeys before adding more surface area.

## Original product and architecture plan

## Product decisions

- Launch with pay-as-you-go credit purchases first.
- Fund the initial launch from the exact 2,788,318-credit AppSumo provider balance.
- Allocate 2,500,000 credits for customer sales and hold 288,318 credits as the provider reserve.
- Use the same package sizes shown in the reference product: 5K, 10K, 25K, 50K, 100K, 250K, 500K, and 1M credits.
- Set retail prices in Stripe. Keep Stripe Price IDs in our server-side package catalog and read the amount from Stripe when creating the purchase record. Do not calculate prices from the upstream provider or trust an amount sent by the browser.
- Offer one-time and monthly packages. Implement one-time checkout first, then enable the prepared monthly catalog after renewal and expiration tests pass.
- Use Stripe Checkout for payment collection and Stripe Customer Portal for billing management.
- Use Resend for transactional and internal admin email.
- Use Supabase for authentication and PostgreSQL. Keep the existing Express server as the only service allowed to call Stripe, Resend, the database, and the verification provider.
- Start with three workspace roles: `owner`, `admin`, and `member`.

## Package catalog

These package quantities match the supplied screenshots and the current public Emailable package selector.

| Package ID | Credits | PAYG price | Subscription price | Status |
| --- | ---: | ---: | ---: | --- |
| `credits_5k` | 5,000 | $14 | Later | MVP |
| `credits_10k` | 10,000 | $24 | Later | MVP |
| `credits_25k` | 25,000 | $44 | Later | MVP |
| `credits_50k` | 50,000 | $74 | Later | MVP |
| `credits_100k` | 100,000 | $134 | Later | MVP |
| `credits_250k` | 250,000 | $239 | Later | MVP |
| `credits_500k` | 500,000 | $294 | Later | MVP |
| `credits_1m` | 1,000,000 | $444 | Later | MVP |

Monthly subscription catalog:

| Package ID | Credits per month | Monthly price | Rollover |
| --- | ---: | ---: | --- |
| `monthly_2k` | 2,000 | $5 | No |
| `monthly_10k` | 10,000 | $20 | No |
| `monthly_50k` | 50,000 | $99 | No |
| `monthly_250k` | 250,000 | $399 | No |
| `monthly_500k` | 500,000 | $599 | No |

These prices come from `my-email-verification-pricing.csv`. Stripe remains the authority for the charged amount, so the database catalog stores the expected price for display and reconciliation alongside each Stripe Price ID. Keep `retail_price_cents`, `provider_cost_cents`, and `stripe_price_id` separate for reporting.

The initial provider credits were prepaid through AppSumo, so the useful first metric is cash recovered per provider credit sold. Still reserve for Stripe fees, refunds, support, infrastructure, free credits, and unbillable results. Approve a floor price for every package even when Stripe contains the editable retail price.

Suggested server-side record:

```js
{
  id: 'credits_25k',
  name: '25,000 credits',
  credits: 25000,
  retailPriceCents: 4400,
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
| `packages` | Server-controlled catalog | `id`, `credits`, `retail_price_cents`, `billing_type`, `stripe_price_id`, `active` |
| `subscriptions` | Monthly Stripe state | `workspace_id`, `package_id`, `stripe_subscription_id`, `status`, `current_period_end` |
| `credit_grants` | Expiring and permanent credit buckets | `workspace_id`, `source_id`, `credits_remaining`, `expires_at` |
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

Monthly plans create a fresh liability on every successful renewal. Before accepting or renewing a subscription, include the upcoming monthly grant in the inventory check. Pause new subscriptions when the remaining sales allocation cannot cover both existing customer balances and the next cycle of active monthly grants.

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

1. Add recurring Stripe Prices for the five approved monthly packages.
2. Support monthly only.
3. Grant the cycle's credits on `invoice.paid`, not when a subscription object is created.
4. Handle `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Expire unused monthly credits at the end of each billing cycle with no rollover. One-time credits never expire.
6. Use Stripe Customer Portal for cancellation and payment method changes.

Consume credits from the grant with the nearest expiration first, then consume permanent one-time credits. This prevents customers from losing monthly credits while permanent credits are available.

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

## Historical implementation notes (not launch sign-off)

- Complete in code: Supabase credential validation, signup, login, refresh, password reset, workspace bootstrap, tenant middleware, profile loading, sign-out, customer balance, and ledger reads.
- Complete in code: package catalog, inventory reservations, Stripe Checkout creation, raw-body signature verification, idempotent one-time fulfillment, permanent credit grants, Customer Portal sessions, and Resend purchase/admin messages.
- Prepared but intentionally disabled: monthly Checkout. It must not charge until invoice renewal, credit expiration, cancellation, and insufficient-inventory behavior are fully implemented and tested.
- Activated: `supabase/migrations/202609170001_foundation.sql` is applied through the Supabase Session Pooler connection.

Live status as of September 17, 2026:

- The foundation migration is applied to Supabase and all schema, function, seed, and RLS checks pass.
- All 13 live Stripe products and USD prices are created and mapped to `packages.stripe_price_id`.
- Stripe reconciliation confirms 13 of 13 amount, billing mode, metadata, currency, product status, and price status checks pass.
- Monthly prices exist in Stripe, but monthly Checkout remains application-disabled until renewal and expiration webhook handling is complete.
- Signup workspace bootstrap and its one-time 1,000-credit grant pass live integration tests. The grant is recorded in both the credit ledger and inventory allocation.
- New signup grants are restricted to one claim per user, exact IP, and network block using irreversible HMAC fingerprints.
- Single verification now reserves a customer credit transactionally, persists a privacy-reduced result, consumes billable results, and refunds unknown or failed results. Repeated requests can use an idempotency key to prevent duplicate charges.
- Bulk CSV/TXT uploads now extract and deduplicate up to 250,000 addresses. Lists are risk-scored before processing, lists over the provider's 50,000-address boundary are safely chunked, and flagged jobs wait in an audited admin approval queue before credits are reserved.
- Completed lists are retained for 187 days. On day 180, the owner receives a branded export warning with the admin address blind-copied; a scheduled retention job removes expired database records and private export archives. Large-list ZIP exports are copied from the provider into private Supabase Storage before temporary provider URLs expire.
- Signup confirmation and password recovery use Supabase-generated secure links delivered through the shared branded Resend template. The production sending domain and `EMAIL_LOGO_URL` must be publicly verified before launch.
- Customer API keys are live: secrets are displayed once, stored only as keyed hashes, revocable by workspace owners/admins, limited to 60 requests per minute per key, and metered through the same transactional credit settlement used by the dashboard. The API screen now reports real 30-day API usage.
- The admin control center is live with provider inventory visibility, system counts, searchable workspaces, members, purchase and ledger history, audited inventory-aware credit adjustments, workspace suspension/reactivation, and the batch approval queue. Sensitive changes require a written reason and are recorded in `admin_actions`.
- In-app support is live with categorized customer requests, branded Resend acknowledgement and admin-alert emails, a five-active-ticket workspace limit, customer request history, and an admin inbox for priority and status management. Admin changes are recorded in the shared operations audit trail.

## Reference documentation

- [Emailable pricing](https://emailable.com/pricing/)
- [Emailable credit behavior](https://emailable.com/docs/manage-your-account/billing/how-credits-work/)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Resend Node.js guide](https://resend.com/nodejs)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
