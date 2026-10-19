# PharmaChain — Deployment Guide

Target topology:

```
Vercel (frontend, Vite SPA)  ──HTTPS──▶  Render (Express backend)  ──▶  MongoDB Atlas
                                                   │
                                                   ├─▶ AI providers (HF / Gemini / OpenAI — server-side keys)
                                                   └─▶ Polygon Amoy (testnet anchor)
```

No application code changes are needed to deploy — the frontend already reads
the backend origin from `VITE_API_URL`.

---

## 0. Prerequisites

- GitHub repository with this code pushed (**never** commit `.env`).
- Accounts: [Vercel](https://vercel.com), [Render](https://render.com),
  [MongoDB Atlas](https://cloud.mongodb.com).

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (or M10+ for production).
2. **Database Access** → create a user with a strong password.
3. **Network Access** → add Render's outbound (0.0.0.0/0 works on free tier).
4. Copy the **SRV connection string**:
   `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/pharmachain?retryWrites=true&w=majority`
   — this becomes `PHARMACHAIN_MONGODB_URI`.

## 2. Backend → Render

Option A (blueprint): Dashboard → **New → Blueprint** → select the repo —
`render.yaml` pre-fills the service.

Option B (manual): **New → Web Service** → repo →
- Runtime: **Node** · Build: `npm ci` · Start: `node server/index.cjs`
- Health check path: `/api/health`

Set environment variables (Render dashboard → Environment):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `PHARMACHAIN_MONGODB_URI` | Atlas SRV string from step 1 |
| `JWT_SECRET` | long random string (`openssl rand -hex 48`) — **required** |
| `HF_TOKEN` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `GEMINI_API_KEY` / `GPT5_API_KEY` | your existing AI provider keys |
| `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_PRIVATE_KEY` | existing Polygon Amoy config (backend-only) |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` |
| `PHARMACHAIN_FILE_STORAGE_DIR` | `/var/data/files` (persistent disk) |

Attach a **1 GB persistent disk** mounted at `/var/data` (blueprint does this)
so encrypted prescription images survive restarts.

> **Medicine master:** the 149 MB reference dataset is intentionally not in
> Git. Build it once (`node scripts/import-medicine-master.cjs`) and copy
> `server/ml/reference/medicine-master.json` to the Render disk
> (`/var/data/...`) — or run the importer on the Render shell. Until it
> exists, validation uses the curated formulary and
> `/ml-training-status` reports `medicineMaster.available=false`. See
> `scripts/README-medicine-master.md`.

## 3. Frontend → Vercel

1. Dashboard → **Add New → Project** → import the repo.
2. Framework preset **Vite** is auto-detected (`vercel.json` pins it).
3. Environment variables (Production + Preview):

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://pharmachain-api.onrender.com` (your Render URL) |
| `VITE_USE_BACKEND_AUTH` | `true` |
| `VITE_PRESCRIPTION_BACKEND_ENABLED` | `true` |

4. Deploy. `vercel.json` rewrites all non-API routes to `index.html` (SPA).

## 4. Post-deploy checks

- `https://<render-app>/api/health` → `{"ok":true,"dbMode":"mongodb"}`
- Frontend login works (CORS allowlist must include the Vercel origin —
  that is `CORS_ORIGINS` on Render).
- Upload a prescription → analyze → review → confirm → blockchain anchor.
- `GET /api/prescriptions/ml-training-status` returns aggregate counts.

## 5. What must NEVER be committed

`.env`, any `VITE_*` variable holding a secret (there are none — keep it that
way), `server/ml/training-data/*` (pharmacist labels), trained model
artifacts, prescription files (`.data/`), raw datasets, and logs. All are
already covered by `.gitignore`.

## 6. Local development (unchanged)

```
npm install
npm run dev:server   # Express on :41837
npm run dev          # Vite on :5173 (proxies /api to :41837)
```
