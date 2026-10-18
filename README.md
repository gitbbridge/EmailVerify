# EmailVerify

EmailVerify is a React and Tailwind SaaS shell with a private Node proxy for real-time and batch email verification.

## Project tree

```text
EmailVerify/
|-- server/
|   |-- middleware/auth.js
|   |-- middleware/errorHandler.js
|   |-- routes/account.js
|   |-- routes/verification.js
|   |-- services/supabase.js
|   |-- services/verificationProvider.js
|   |-- config.js
|   `-- index.js
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
|-- supabase/
|   |-- migrations/
|   `-- config.toml
|-- tailwinds_bb/             # Local-only component reference library (Git ignored)
|-- .env.example
|-- .gitignore
|-- index.html
|-- package.json
|-- postcss.config.js
|-- tailwind.config.js
`-- vite.config.js
```

## Setup

```bash
npm install
copy .env.example .env
npm run dev
```

Add the private test provider key to `.env` as `EMAILABLE_API_KEY_TEST_KEY`. Production can use `EMAILABLE_API_KEY`. Never expose either key through a `VITE_` environment variable or commit `.env`.

Stripe local/test setup requires `STRIPE_TEST_SECRET_KEY` (`sk_test_...`, or a restricted `rk_test_...`) and the matching `STRIPE_TEST_WEBHOOK_SECRET` (`whsec_...`). A `pk_test_...` publishable key is not valid for server-side Checkout. The test pair takes precedence over live values. Live Checkout remains blocked until `APP_URL` is HTTPS and `STRIPE_LIVE_ENABLED=true`.

Apply the Supabase migrations using the database connection string from the Supabase dashboard. On networks without IPv6, use the Session Pooler connection string for `DATABASE_URL`.

```bash
npx supabase db push --db-url "$DATABASE_URL" --include-all
```

- Web app: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`
- Health check: `GET /api/health`

## Production roadmap

Render deployment is defined in `render.yaml` with a Docker web service for both the frontend and API. See [the Render deployment guide](docs/RENDER_DEPLOYMENT.md) for secrets, authentication redirects, webhook setup, release checks and known limits. `npm run test:deployment` verifies the compiled frontend, API boundaries, private-file denial, production configuration and proxy-aware signup identity.

See [`docs/BUILD_ROADMAP.md`](docs/BUILD_ROADMAP.md) for the staged build guide covering authentication, credit accounting, Stripe billing, Resend email, live verification, and the minimal admin console.

## API routes

Customer applications can create private `ev_live_...` keys from the Developer screen and call the same verification endpoint used by the dashboard:

```bash
curl -X POST http://127.0.0.1:5173/api/v1/verify \
  -H "Authorization: Bearer ev_live_xxx" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: your-unique-request-id" \
  -d '{"email":"name@example.com","smtp":true}'
```

The full key is shown once. Only its prefix and keyed hash are retained. Active keys are limited to 60 requests per minute each.

- `POST /api/v1/auth/workspace-bootstrap` creates the signed-in user's first workspace.
- `POST /api/v1/auth/signup` creates a Supabase user and workspace.
- `POST /api/v1/auth/login` returns a Supabase session.
- `POST /api/v1/auth/refresh` refreshes an expired session.
- `POST /api/v1/auth/password-reset` sends reset instructions.
- `GET /api/v1/me` returns the signed-in profile and workspace.
- `GET /api/v1/credits` returns the signed-in workspace's customer credit balance.
- `GET /api/v1/credits/ledger` returns its credit history.
- `POST /api/v1/verify` verifies one address for an authenticated workspace.
- `POST /api/v1/batches` starts an authenticated batch of up to 50,000 addresses.
- `GET /api/v1/batches/:id` returns authenticated batch progress or results.
- `GET /api/v1/batches/:id/results` returns tenant-scoped, filtered and paginated result rows for the selected batch.
- `GET /api/v1/batches/:id/export` returns the selected batch CSV or signed provider archive URLs.
- `GET /api/v1/provider/credits` returns the upstream balance to system administrators only.
- `GET /api/v1/billing/packages` returns the active one-time and monthly catalog.
- `POST /api/v1/billing/checkout-sessions` creates a server-priced Stripe Checkout session.
- `GET /api/v1/billing/purchases/:id` returns purchase fulfillment status.
- `POST /api/v1/billing/portal-sessions` opens Stripe Customer Portal.
- `POST /api/v1/webhooks/stripe` verifies and processes Stripe events.

Stripe webhooks must use the raw request body, so the webhook router is mounted before the normal JSON parser. One-time fulfillment is idempotent and grants credits only after a signed `checkout.session.completed` event.

Authentication, database persistence, customer API keys, billing endpoints, tenant credit accounting, team management, and the authenticated batch results workflow are implemented. The application is still being verified for production: XLSX upload parsing, large provider archive ingestion, billing usage, provider retry evidence, and 2FA/notification preferences remain unfinished. See the current assessment in the roadmap before treating a screen as launch-ready.

## Team management

Open **Account** from the profile menu. Owners and administrators can invite members; only owners can appoint administrators. Invite links expire after seven days, require the invited email to be verified, and never grant additional signup credits. Each user belongs to one workspace. Removal and administrator demotion revoke the API keys that user created in the workspace.

Apply `supabase/migrations/202609190001_workspace_team.sql` before starting the updated server. Invite links use `APP_URL`; the same URL, including invitation query parameters, must be allowed in Supabase Auth redirect configuration. Resend must have a verified sender.

```bash
npm run test:team:db
npm run test:auth:db
npm run test:auth:integration
npm run test:browser
```

Database tests require `DATABASE_URL`. The recovery integration test creates and removes a disposable Supabase user and verifies a real password change without sending email. Browser tests use Edge and stubbed API responses to verify desktop/mobile interaction, so they do not send invitations or charge credits.

The local `tailwinds_bb` reference folder and archive are intentionally excluded from Git because they are not runtime dependencies and add roughly 650 MB to the repository.

## Verification

Multipart uploads require an `Idempotency-Key` header (8-128 letters, digits, hyphens or underscores). Reusing the same key and normalized list returns the existing batch; different content returns 409. Apply `npm run db:import-idempotency` before running the updated API. `npm run test:upload:integration` uses temporary real Supabase accounts, database records and private storage, cleans them up, and stubs approval email delivery. It does not spend provider credits. Playwright starts its own server on port 5193 (`PLAYWRIGHT_PORT` overrides it).

CSV, TXT and XLSX uploads now use authenticated multipart `POST /api/v1/batches/upload` (field `file`). Files are limited to 10 MB and 250,000 unique addresses, with one email per cell or TXT line. The existing private submission bucket and batch approval flow persist the normalized addresses. Run `npm run test:upload` for parser and anonymous-access tests, and `npx playwright test tests/browser/upload.spec.js` for UI tests. Full authenticated storage/provider lifecycle coverage remains outstanding; see the newest roadmap entry.

```bash
npm run check
```
