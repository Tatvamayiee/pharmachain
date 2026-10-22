# Vercel Setup

Vercel hosts the Vite frontend only. The Express API must be deployed separately
(for example, as the Render service defined in `render.yaml`) and connected via
`VITE_API_URL`. Configure these Vercel environment variables before deploying:

- `PHARMACHAIN_MONGODB_URI` — your PharmaChain MongoDB Atlas connection string
- `JWT_SECRET`
- `MAILER_HOST`
- `MAILER_PORT`
- `MAILER_SECURE`
- `MAILER_USER`
- `MAILER_PASS`
- `MAILER_FROM`

Add `PHARMACHAIN_MONGODB_URI` in the Vercel project settings under **Settings > Environment Variables** for the environments you deploy to, then redeploy. Do not modify the managed `MONGODB_URI` variable. Do not commit the URI to Git; `.env.local` is ignored for local development.

For non-zero demo dashboards, run the enhanced seed against the same MongoDB database used by Vercel:

```bash
npm run seed
```

The seed creates demo users, medicines, shipments, transport boxes, tracking events, and verification records. It clears the configured database first, so use it only with a development/demo database.