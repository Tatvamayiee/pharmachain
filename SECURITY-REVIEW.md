# PharmaChain Security Review

## Summary

The review found and fixed authorization flaws in registration, token-based
identity, prescription workflow transitions, shipment/transport access, and
file signature validation. A remaining stale-claim path in optional transport
authentication was also fixed during the residual review. Regression evidence:
49/49 backend checks and 34/34 security checks pass.

No critical application dependency advisories remain in the production
dependency tree (`npm audit --omit=dev`: 0). The full dependency tree still has
5 high and 10 moderate advisories, all in development/build tooling. The
complete production-readiness discussion and scores are in
[docs/PRODUCTION_READINESS_REPORT.md](./docs/PRODUCTION_READINESS_REPORT.md).

This is a repository-level review, not an external penetration test, live
infrastructure assessment, or compliance certification.

## Findings

| # | Severity | File | Lines | Finding | Status |
|---|----------|------|-------|---------|--------|
| 1 | 🟠 HIGH | `server/routes/auth.cjs` | 29 | Public registration previously accepted caller-selected roles/organizations, creating a privilege-escalation path. | Fixed: customer-only registration, server-assigned empty organization, 12-character password minimum. |
| 2 | 🟠 HIGH | `server/middleware/auth.cjs` | 15 | Protected requests previously relied on signed-token claims instead of consistently using current account role and organization. | Fixed: HS256-only verification, user reloaded from DB, active status required. |
| 3 | 🟠 HIGH | `server/routes/transport.cjs` | 25 | Optional transport auth trusted stale role/organization claims, potentially exposing the internal tracking timeline after role changes. | Fixed: current active user loaded from DB; regression test added. |
| 4 | 🟠 HIGH | `server/routes/prescriptions.cjs` | 154 | Generic prescription PATCH previously allowed workflow fields to bypass guarded review and status transitions. | Fixed: workflow fields blocked from generic PATCH; dedicated transitions enforce pharmacist checklist and unresolved-alert guards. |
| 5 | 🟠 HIGH | `server/routes/shipments.cjs` | 22 | Shipment operations previously lacked consistent participant/tenant authorization and stock lifecycle checks. | Fixed: participant-scoped reads and guarded dispatch, cancellation, transport assignment, scans, and delivery. |
| 6 | 🟡 MEDIUM | `server/services/fileStorageService.cjs` | 55 | Short buffers could skip magic-byte validation, allowing truncated content to be stored under an allowed MIME type. | Fixed: buffer/size consistency and format signatures are always checked; truncated content is rejected. |
| 7 | 🟠 HIGH | `package.json`, `package-lock.json` | 1 | `npm audit` reports 5 high advisories in Tailwind/chokidar/braces/fast-glob/micromatch build dependencies. | Open: a compatible fix requires a major Tailwind migration; validate before upgrading. |
| 8 | 🟡 MEDIUM | `src/platform/auth/authService.ts` | 10 | Bearer JWTs are stored in `localStorage`; any future same-origin XSS could steal and replay a token. No user-controlled HTML sink was confirmed in the scoped scan. | Open hardening: consider HttpOnly/Secure/SameSite cookies with CSRF defenses and a tested CSP. |
| 9 | 🟡 MEDIUM | `render.yaml` | 8 | The Free Render service is configured with a persistent disk, which Free web services do not support; prescription file persistence would not be production-safe. | Open deployment blocker: select paid compute or move files to durable object storage. |

## Security controls verified

- Public registration cannot assign a privileged role or organization.
- Login uses bcrypt password verification and IP-based rate limiting.
- Protected routes use database-backed user identity; inactive/suspended users
  are denied.
- Cross-organization prescription, shipment, and file access checks are
  exercised by the security suite.
- Prescription approval requires safety review, a completed checklist, and
  resolution of critical alerts.
- Uploads enforce size/type checks and reject mismatched/truncated signatures;
  stored prescription files use AES-256-GCM.
- Production startup requires MongoDB, a JWT secret, exact CORS origins, and a
  stable 32-byte file encryption key; production MongoDB failures abort startup.
- Helmet security headers, malformed-JSON handling, and login throttling are
  covered by regression checks.
- `.env` is ignored by Git; secrets must remain backend-only.

## Required follow-up before production

1. Resolve the Render Free-plan/persistent-disk conflict.
2. Configure MongoDB backups and verify restoration; separately protect the
   file encryption key.
3. Schedule compatibility-tested major upgrades for the vulnerable
   development/build dependency chains.
4. Decide whether to migrate browser token storage and enable a compatible CSP.
5. Add CI release gates and document secure first-administrator provisioning.
6. Conduct independent clinical safety, privacy, and jurisdictional
   compliance reviews before using real patient data.
