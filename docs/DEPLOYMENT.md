# PharmaChain — Deployment Guide

Target topology:

```
Vercel (frontend, Vite SPA)  ──HTTPS──▶  Render (Express backend)  ──▶  MongoDB Atlas
                                                   ├─▶ GridFS (encrypted prescription files)
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

Prescription files use MongoDB GridFS in the same database configured by
`PHARMACHAIN_MONGODB_URI`. The backend encrypts each file with AES-256-GCM
before storing it in GridFS. GridFS stores files as chunk documents rather than
embedding them in prescription records, avoiding MongoDB's 16 MB per-document
limit. No separate object-storage account or Render disk is required. Ensure
the Atlas cluster has enough capacity for both regular records and file chunks.
Render Free may sleep and is not appropriate for production availability;
choose a suitable paid service plan for production workloads.

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
| `PHARMACHAIN_FILE_KEY` | stable 32-byte hex or base64 key — **required**; back it up separately |
| `PHARMACHAIN_FILE_STORAGE_BACKEND` | `gridfs` — required in production |
| `HF_TOKEN` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `GEMINI_API_KEY` / `GPT5_API_KEY` | your existing AI provider keys |
| `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CONTRACT_ADDRESS`, `BLOCKCHAIN_PRIVATE_KEY` | existing Polygon Amoy config (backend-only) |
| `CORS_ORIGINS` | `https://<your-app>.vercel.app` |

Generate `PHARMACHAIN_FILE_KEY` once and retain it in a separate secrets backup.
Changing or losing it makes existing application-encrypted files unreadable.
GridFS files are stored in the same MongoDB database as PharmaChain records.
Include both GridFS collections in database backups and test restoring them
together with the file encryption key. For local development, leave
`PHARMACHAIN_FILE_STORAGE_BACKEND` unset; encrypted files are stored under
`.data/files`.

Configure automated MongoDB backups and perform a restore test before storing
real prescription or inventory data.

> **Medicine master:** the 149 MB reference dataset is intentionally not in
> Git. Build it once (`npm run import:medicine-master`) and provision
> `server/ml/reference/medicine-master.json` as part of a durable deployment
> process. Until it
> exists, validation uses the curated formulary and
> `/ml-training-status` reports `medicineMaster.available=false`. See
> `docs/MEDICINE_MASTER.md`.

## 3. Frontend → Vercel

1. Dashboard → **Add New → Project** → import the repo.
2. Framework preset **Vite** is auto-detected (`vercel.json` pins it).
3. Environment variables (Production + Preview):

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://pharmachain-api.onrender.com` (your Render URL) |

4. Deploy. `vercel.json` rewrites all non-API routes to `index.html` (SPA).

### Android APK

The Capacitor Android project is in `android/`. Install a supported JDK —
**JDK 17–21** (this machine's default JDK 27 fails the build with a
`jlink` / `androidJdkImage` error) — set `ANDROID_HOME` to the SDK directory,
then build using the same public backend URL as the web deployment:

```powershell
$env:VITE_API_URL = "https://<your-backend-host>"
npm run android:debug
```

The Capacitor WebView loads the app from `https://localhost`, so the APK sends
`Origin: https://localhost` on every API request. Add `https://localhost` to
the backend's `CORS_ORIGINS` on Render (comma-separated, alongside the Vercel
origin) — otherwise all API calls from the APK are rejected with
403 "Untrusted request origin".

The debug APK is written to
`android/app/build/outputs/apk/debug/app-debug.apk`. This is for testing and
is not a Play Store release. A store release must be signed with a private
keystore; keep the keystore and passwords out of Git and configure signing
secrets only in the release build environment.

The GitHub Actions workflow builds a debug APK on relevant pushes and manual
runs. Set repository variable `VITE_API_URL` to the public backend origin.
To enable signed APK/AAB artifacts, add repository secrets
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
and `ANDROID_KEY_PASSWORD`. The signing keystore is never stored in the repo.

The API uses HttpOnly, Secure, SameSite=None session cookies in production.
Keep `CORS_ORIGINS` limited to exact trusted frontend origins; credentialed
CORS is enabled by the backend. Browser privacy settings may block third-party
cookies when Vercel and Render are on unrelated domains. For reliable sessions,
use a custom frontend and API domain under the same registrable domain (for
example, `app.example.com` and `api.example.com`) and include the frontend
origin in `CORS_ORIGINS`.

## 4. Post-deploy checks

- `https://<render-app>/api/health` → `{"ok":true,"dbMode":"mongodb"}`
- Frontend login and refresh work with the HttpOnly cookie (CORS allowlist must
  include the frontend origin — that is `CORS_ORIGINS` on Render).
- Upload a test prescription and verify the encrypted file is in the
  `prescriptionFiles.files` and `prescriptionFiles.chunks` collections; verify
  a different organization cannot retrieve it.
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
