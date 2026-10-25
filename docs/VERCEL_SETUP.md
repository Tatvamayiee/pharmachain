# Vercel Setup

Vercel hosts the Vite frontend only. Deploy the Express API separately (for
example, as the Render service defined in `render.yaml`). In Vercel project
settings, set this frontend build variable for Production and Preview:

- `VITE_API_URL` — the public backend origin, for example
  `https://pharmachain-api.onrender.com` (no trailing slash).

Do not put backend secrets such as `PHARMACHAIN_MONGODB_URI`, `JWT_SECRET`,
`PHARMACHAIN_FILE_KEY`, or AI provider keys in Vercel's frontend environment.
Configure those only on the backend host. The backend's `CORS_ORIGINS` must
include the exact Vercel site origin.

You can deploy from the Vercel dashboard by importing this GitHub repository.
The Vercel CLI can also deploy from the project root after `vercel login`:

```bash
vercel link
vercel deploy --prod
```

Set `VITE_API_URL` before the production build/deployment so frontend API
requests target the deployed backend.

For non-zero demo dashboards, run the enhanced seed against the same MongoDB
database used by the backend:

```bash
npm run seed
```

The seed creates demo users, medicines, shipments, transport boxes, tracking
events, and verification records. It clears the configured database first, so
use it only with a development/demo database.