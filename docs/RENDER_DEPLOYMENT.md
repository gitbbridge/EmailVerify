# Render Deployment

The `render.yaml` Blueprint deploys one Docker web service for the compiled React application and Express API. Supabase remains the database/auth/storage provider. The container runs as a non-root user, listens on Render's assigned port, exposes `/api/health`, and excludes `.env` and Git data from its build context.

## Release setup

1. Connect the `gitbbridge/EmailVerify` repository to Render and select the release branch containing `render.yaml`.
2. Create a Blueprint from `render.yaml`. Review Render's selected compute plan and billing before confirming the service.
3. Fill the `sync: false` environment entries from the existing private environment. Never paste secrets into Git, a PR, or chat. Supply the live Emailable key for actual verification. Keep Stripe in test mode until payment acceptance is complete.
4. Leave `APP_URL` and `CLIENT_ORIGIN` unset initially: the server derives its origin from Render's documented `RENDER_EXTERNAL_URL`. The Blueprint generates a stable signup fingerprint secret. Preserve this value across releases so free-credit abuse hashes remain comparable.
5. Keep `TRUST_PROXY_HOPS=1` for the direct Render ingress. Review it if adding another reverse proxy. Forwarded client IPs are trusted only through Express's configured proxy boundary.
6. Deploy and verify `/api/health`, `/`, compiled JavaScript/CSS, logo assets, and the login page. Configure Supabase's site URL and allowed authentication redirects for the exact HTTPS origin.
7. Create a Stripe test webhook destination at `https://YOUR-SERVICE.onrender.com/api/v1/webhooks/stripe`, then save that destination's signing secret as `STRIPE_TEST_WEBHOOK_SECRET`. A local Stripe CLI signing secret does not configure a hosted destination.
8. Exercise signup/confirmation, recovery, team invitations, single verification, an approved bulk list, results/export, and a test Checkout with exactly-once credit fulfillment. Verify the billing portal and payment failure/replay paths before live billing.

The webhook handles Checkout completion, asynchronous success/failure, expiry, refunds, disputes and failed invoices. Monthly purchases remain disabled.

## Domain and payment activation

After adding and verifying `emailcheckr.xyz` in Render, set both `APP_URL` and `CLIENT_ORIGIN` to `https://emailcheckr.xyz`. Update Supabase redirect settings and Stripe destinations to match. Configure the public email logo URL if the domain changes.

Live billing needs the live server secret and destination signing secret, `STRIPE_LIVE_ENABLED=true`, and removal of the test Stripe overrides. Test and live customers/purchases still require isolation/reconciliation before sharing the same database for customer billing. Do not enable live payments merely because the container is healthy.

## Verification and known limits

Run `npm run build`, `npm run test:deployment`, `npm run test:stripe`, and the database/integration suites against the intended environment. Docker image building must additionally be validated by Render or a Docker-enabled machine.

Retention currently runs at startup and every six hours in the web process; outages delay its execution. Durable job scheduling/recovery, full provider failure recovery, financial reconciliation, monthly billing and notification retries remain tracked in `BUILD_ROADMAP.md`. Automatic deployment is initially disabled so source pushes alone cannot publish unverified work.
