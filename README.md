# PharmaChain 🏥🔗

A pharmacy supply-chain and prescription-verification platform: AI/OCR
prescription analysis with a human-pharmacist gate, a 249k-record Indian
medicine master for validation, and optional anchoring of confirmed
prescription fingerprints to Polygon Amoy.

> **Medical safety:** PharmaChain only extracts, compares and verifies
> prescription information. It never diagnoses, prescribes or recommends
> medication changes. AI/OCR output is assistance only — a qualified
> pharmacist/clinician must verify before any prescription is confirmed, and
> blockchain registration is impossible until that confirmation happens.

## Features

- **Prescription analysis** — OpenRouter free-tier vision model,
  Cloudflare / Hugging Face / Gemini / OpenAI optional, PaddleOCR-VL as an independent OCR engine
- **Parallel OCR + AI pipeline** — the same stored image is analyzed by both
  engines simultaneously; results are compared field-by-field
- **Medicine validation** — 249,163-record master (MIT-licensed
  [Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset))
  with name/strength separation, alias + controlled fuzzy matching, and
  honest "Needs Verification" status (never guessed)
- **Random Forest comparison layer** — training-ready; deterministic
  comparison stays authoritative until a real trained model exists
  (fail-closed trainer, no fabricated metrics)
- **Pharmacist verification** — mandatory review checklist before confirm
- **Blockchain anchoring** — SHA-256 of confirmed data + minimal metadata on
  Polygon Amoy; images and patient data never go on-chain
- **RBAC** — admin / manufacturer / distributor / dealer / hospital /
  customer roles enforced server-side
- **Direct medicine procurement** — pharmacies and hospitals order available
  released stock from manufacturers; manufacturers review and ship orders, and
  buyers confirm receipt into their organization inventory
- **Security** — DB-backed identity, HttpOnly session cookies, bcrypt, rate
  limiting, production CORS allowlist, encrypted MongoDB GridFS file storage, and a
  security battery (`npm run test:security`)

## Tech stack

React 18 + TypeScript + Vite + Tailwind · Express + MongoDB (Mongoose) ·
web3.js · PaddleOCR-VL (Python) · Vite PWA.

## Quick start

```
npm install
cp .env.example .env        # fill in your values (never commit .env)
npm run dev:server          # Express API on http://localhost:41837
npm run dev                 # Vite dev server on http://localhost:5176 (proxies /api)
```

In development, the backend seeds the demo accounts shown on the login page
when it starts. Keep `npm run dev:server` running while signing in; demo
passwords use the `<role>123` pattern shown beside each account. Public
registration creates only a low-privilege customer account. Hospital, pharmacy,
distributor, manufacturer, transport, and administrator accounts must be
provisioned by trusted administrators; do not grant them through public
registration. Production startup requires `JWT_SECRET` and `CORS_ORIGINS`, with
`CORS_ORIGINS` set to exact comma-separated frontend origins. The
`PHARMACHAIN_MONGODB_URI` and stable 32-byte `PHARMACHAIN_FILE_KEY` are also
required in production; the backend will not start with an in-memory database
fallback or local file storage. Production prescription files are encrypted
and stored in MongoDB GridFS in the configured database, so budget Atlas
storage and backups for both data and file chunks. Back up the file key
separately and keep it unchanged across deploys. Production authentication uses
an HttpOnly cookie, not a browser-stored JWT; see
[the deployment guide](./docs/DEPLOYMENT.md) for the cross-site cookie and
custom-domain requirements.
Vite API proxy follows `PORT` from `.env`; set `PHARMACHAIN_API_PORT` only when
the backend uses a different port. Demo users are not automatically created
in production.

For Cloudflare-hosted prescription analysis, set `PHARMACHAIN_AI_PROVIDER=cloudflare`,
`CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` in the backend `.env`. The
default model is `@cf/meta/llama-3.2-11b-vision-instruct`; Cloudflare currently
offers a limited free daily Workers AI allocation. Never expose the token in
frontend (`VITE_*`) variables. AI extraction is not a substitute for pharmacist
review.

For OpenRouter free-model analysis, set `PHARMACHAIN_AI_PROVIDER=openrouter`,
`OPENROUTER_API_KEY`, and `OPENROUTER_MODEL=minimax/minimax-m3.1-flash:free`
in the backend `.env`. The server rejects OpenRouter model IDs without the
`:free` suffix and disables paid-provider fallbacks for these requests. Free
models have limited availability and rate limits.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run dev:server` | Frontend / backend in dev |
| `npm run build` | Production frontend build (`dist/`) |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Seed the login-page demo users |
| `npm run test:backend` | Backend test suite (49 checks) |
| `npm run test:security` | Security test battery (40 checks) |
| `npm run test:gridfs` | Mocked GridFS encryption, tenant-isolation, and integrity checks |
| `npm run test:e2e:hf` | Live E2E with a real prescription image |
| `npm run import:medicine-master` | Build the local medicine reference index |
| `npm run deploy:registry` | Deploy the Polygon Amoy registry contract |

## Repository layout

```
src/
  app/          Application entry point, providers, routes, global styles
  features/     Role and domain features (pages, dashboards, components, services)
  platform/     API, authentication, database, and shared data access
  shared/       Reusable UI, layouts, hooks, types, and demo data
server/         Express backend (routes, services, db, middleware, ml/)
contracts/      Polygon Amoy smart contracts
scripts/        dev/, data/, deploy/, tests/, visual/ tool groups
electron/       Desktop app shell
public/         Static assets + demo prescription images
docs/           Deployment and project documentation
```

## Deployment

Frontend → **Vercel**, Backend → **Render**, Database → **MongoDB Atlas**.
See **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**. Environment variables are
documented in **[.env.example](./.env.example)** (names only — no values).

## Security & privacy notes

- All AI/blockchain/DB secrets are backend-only; the frontend receives only
  non-secret configuration (`VITE_*` flags and the API URL).
- Prescription images are stored encrypted at rest; ML training rows contain
  aggregated comparison features + pharmacist labels only, never patient
  identifiers, and are not committed to Git.
- `/ml-training-status` exposes aggregate counts only.
