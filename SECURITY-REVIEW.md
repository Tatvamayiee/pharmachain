# PharmaChain Security Review

## Summary

This repository-level review fixed authorization flaws in registration,
database-backed identity, prescription workflow transitions, shipment and
transport access, file signature validation, and browser credential storage.
The latest isolated validation passed **49/49 backend checks**, **40/40
security checks**, and **6/6 mocked GridFS storage checks**.

`npm audit --omit=dev` reports **0 production dependency vulnerabilities**.
The complete dependency tree has **11 moderate, 0 high, and 0 critical**
advisories, all in development/build tooling.

This is not an external penetration test, live infrastructure assessment,
clinical validation, or compliance certification. See the
[production-readiness report](./docs/PRODUCTION_READINESS_REPORT.md) for
scores and remaining release gates.

## Findings

| # | Severity | File | Lines | Finding | Status |
|---|----------|------|-------|---------|--------|
| 1 | 🟠 HIGH | `server/routes/auth.cjs` | 30-35 | Public registration previously accepted caller-selected roles and organizations, enabling privilege escalation. | Fixed: public signup creates only customers and the server assigns organization. |
| 2 | 🟠 HIGH | `server/middleware/auth.cjs` | 8-30 | Authorization previously relied on signed JWT role/organization claims that could become stale. | Fixed: HS256-only verification reloads the active user and authorization data from the database. |
| 3 | 🟠 HIGH | `server/routes/transport.cjs` | 24-45 | Optional transport authentication previously trusted stale role/organization claims. | Fixed: current active identity is loaded from the database; regression coverage passes. |
| 4 | 🟠 HIGH | `server/routes/prescriptions.cjs` | 143-181 | Generic prescription updates previously bypassed guarded workflow transitions. | Fixed: protected workflow fields are rejected; review and approval enforce checklist and alert gates. |
| 5 | 🟠 HIGH | `server/routes/shipments.cjs` | 65-95 | Shipment operations previously lacked consistent participant and tenant authorization. | Fixed: access is participant-scoped and shipment lifecycle operations are guarded. |
| 6 | 🟡 MEDIUM | `server/services/fileStorageService.cjs` | 70-112 | Short or mismatched uploads could bypass reliable file-signature validation. | Fixed: size, MIME, and magic-byte checks reject truncated or mismatched files. |
| 7 | 🟡 MEDIUM | `server/services/sessionCookie.cjs`, `server/middleware/trustedOrigin.cjs` | 5-29; 5-16 | Browser-accessible JWT storage increased the impact of a future same-origin script injection; cookie authentication also requires CSRF protection. | Fixed: production uses Secure, HttpOnly, SameSite=None cookies and checks supplied mutation Origins against the configured allowlist. CORS preflight and logout behavior are tested. |
| 8 | 🟡 MEDIUM | `server/services/fileStorageService.cjs`, `render.yaml` | 115-170; 19-34 | Local prescription files on ephemeral hosts would not be durable. | Fixed in deployment design: production stores AES-256-GCM-encrypted files in MongoDB GridFS with tenant-scoped metadata. Atlas capacity and backup/restore testing remain operator tasks. |
| 9 | 🟡 MEDIUM | `package.json`, `package-lock.json` | 70, 99, 107 | The full dependency tree has 11 moderate advisories in Electron Builder and Capacitor/Xcode build tooling. | Open: production dependency audit is clean; test compatible build-tool upgrades before packaging releases. |

## Verified controls

- Login uses bcrypt verification and IP-based rate limiting.
- Public registration cannot create privileged users or assign organizations.
- Protected requests reload the active user from the database; inactive users
  are denied.
- Login returns a user profile and an HttpOnly cookie, not a JWT in JSON.
  Legacy bearer authentication is rejected.
- Mutating browser requests with an Origin header are checked against the
  configured origin list; credentialed CORS is verified.
- Prescription, shipment, transport, and file access checks include
  cross-organization denial tests.
- Prescription approval requires safety review, a completed checklist, and
  resolution of critical alerts.
- Uploads reject executable/SVG/mismatched/truncated files; mocked GridFS
  tests verify round-trip, tenant separation, and tamper rejection.
- Production configuration requires MongoDB, JWT secret, explicit CORS
  origins, GridFS storage, and a stable 32-byte file key.
- Helmet headers, malformed JSON handling, and login throttling are covered.
- `.env` is ignored by Git; credentials must remain backend-only.

## Required before production

1. Confirm Atlas storage capacity and configure backups/restores covering the
   database records and both GridFS collections.
2. Keep `PHARMACHAIN_FILE_KEY` in a separately protected backup; losing or
   changing it makes existing application-encrypted files unreadable.
3. Use a same-site custom frontend/API domain where third-party-cookie
   restrictions block sessions across unrelated hosting domains.
4. Choose production-appropriate compute; Render Free may sleep and is not
   production-availability hosting.
5. Review the remaining moderate development/build-tool advisories and add
   CI release gates.
6. Complete independent clinical safety, privacy, and jurisdictional
   compliance reviews before using real patient data.
