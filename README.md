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

- **Prescription analysis** — Qwen3-VL (Hugging Face) primary vision AI,
  Gemini 2.5 Pro / GPT-5 optional, PaddleOCR-VL as an independent OCR engine
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
- **Security** — JWT auth with DB-backed identity, bcrypt, rate limiting,
  CORS allowlist, encrypted prescription-file storage, security battery
  (`node scripts/security-battery.cjs` — 28 checks)

## Tech stack

React 19 + TypeScript + Vite + Tailwind · Express + MongoDB (Mongoose) ·
web3.js · PaddleOCR-VL (Python) · Vite PWA.

## Quick start

```
npm install
cp .env.example .env        # fill in your values (never commit .env)
npm run dev:server          # Express API on http://localhost:41837
npm run dev                 # Vite dev server on http://localhost:5173 (proxies /api)
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run dev:server` | Frontend / backend in dev |
| `npm run build` | Production frontend build (`dist/`) |
| `npm run typecheck` | TypeScript check |
| `npm run seed` | Seed demo data (real formulary, demo users) |
| `node scripts/verify-backend.mjs` | Backend test suite (37 checks) |
| `node scripts/security-battery.cjs` | Security test battery (28 checks) |
| `node scripts/live-e2e-hf-test.cjs` | Live E2E with a real prescription image |

## Repository layout

```
src/            React frontend (components, pages, services, dashboards)
server/         Express backend (routes, services, db, middleware, ml/)
contracts/      PrescriptionRegistry.sol (Polygon Amoy)
scripts/        Importers, E2E + verification suites, security battery
public/         Static assets + demo prescription images
```

## Deployment

Frontend → **Vercel**, Backend → **Render**, Database → **MongoDB Atlas**.
See **[DEPLOYMENT.md](./DEPLOYMENT.md)**. Environment variables are
documented in **[.env.example](./.env.example)** (names only — no values).

## Security & privacy notes

- All AI/blockchain/DB secrets are backend-only; the frontend receives only
  non-secret configuration (`VITE_*` flags and the API URL).
- Prescription images are stored encrypted at rest; ML training rows contain
  aggregated comparison features + pharmacist labels only, never patient
  identifiers, and are not committed to Git.
- `/ml-training-status` exposes aggregate counts only.
