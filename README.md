# EmailVerify

EmailVerify is a React and Tailwind SaaS shell with a private Node proxy for real-time and batch email verification.

## Project tree

```text
EmailVerify/
|-- server/
|   |-- middleware/errorHandler.js
|   |-- routes/verification.js
|   |-- services/verificationProvider.js
|   |-- config.js
|   `-- index.js
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   `-- styles.css
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

- Web app: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`
- Health check: `GET /api/health`

## Production roadmap

See [`docs/BUILD_ROADMAP.md`](docs/BUILD_ROADMAP.md) for the staged build guide covering authentication, credit accounting, Stripe billing, Resend email, live verification, and the minimal admin console.

## API routes

- `POST /api/v1/verify` verifies one address.
- `POST /api/v1/batches` starts a batch of up to 50,000 addresses.
- `GET /api/v1/batches/:id` returns batch progress or results.
- `GET /api/v1/credits` returns the available upstream credit count without exposing account identity.

The current dashboard data is demonstrative. Authentication, database persistence, customer API-key issuance, billing, and tenant-level credit accounting should be added before production use.

The local `tailwinds_bb` reference folder and archive are intentionally excluded from Git because they are not runtime dependencies and add roughly 650 MB to the repository.

## Verification

```bash
npm run check
```
