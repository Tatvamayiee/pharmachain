# PharmaChain Production-Readiness Report

## Latest revalidation

This section supersedes the historical score, validation, and deployment
statements below. The detailed findings later in this document describe the
original audit baseline; the remaining release gates listed here are current.

| Area | Current score | Reassessment |
|---|---:|---|
| Security | 86/100 | 40/40 security checks pass; HttpOnly cookie sessions, Origin validation, tenant-scoped encrypted GridFS storage, and zero production dependency advisories. Live infrastructure and external penetration testing remain outstanding. |
| Code quality | 82/100 | Typecheck and build pass; lint has 0 errors and 12 pre-existing Fast Refresh warnings. |
| Performance | 74/100 | Route splitting reduced the entry bundle to 871.67 kB minified (245.78 kB gzip); it still exceeds Vite's 500 kB warning threshold. |
| Maintainability | 78/100 | 49 backend checks, 40 security checks, and 6 mocked GridFS checks pass. CI, deployment automation, and recovery procedures remain incomplete. |
| Production readiness | 66/100 | GridFS and browser-session designs are in place, but Atlas capacity, backups/restore, same-site domain strategy, and production operations still require owner setup and validation. |

Latest checks: `npm run typecheck` passed; `npm run lint` reported 0 errors
and 12 warnings; `npm run build` passed; backend tests passed 49/49;
security tests passed 40/40; mocked GridFS storage tests passed 6/6.
`npm audit --omit=dev` found 0 vulnerabilities. Full `npm audit` found
11 moderate, 0 high, and 0 critical advisories, all in development/build
tooling.

### Remaining release gates

- Confirm the Atlas cluster tier has sufficient storage for GridFS files and
  configure tested backups/restores covering both GridFS collections and the
  stable application encryption key.
- Use a same-site frontend/API domain if browser third-party-cookie blocking
  prevents sessions across the Vercel/Render domains.
- Choose production-appropriate compute; Render Free may sleep and does not
  provide production availability. Prescription data no longer depends on a
  Render persistent disk.
- Establish a durable deployment process for the generated medicine-master
  artifact, CI release gates, monitoring, incident response, and administrator
  provisioning.
- Review the remaining moderate desktop/mobile build-tool advisories before
  packaging releases. Resolve the frontend bundle warning and 12 Fast Refresh
  warnings in focused follow-up work.
- No live AWS, Render, or production-domain tests were possible without
  provider credentials and deployment access. This is not an external
  penetration test, clinical validation, or compliance certification.

## Executive summary

The audit hardened authentication, prescription workflow transitions, shipment
and transport authorization, upload validation, startup configuration, and
error handling. Later revisions added cookie authentication, GridFS-backed
prescription storage, and additional regression coverage. The current release
gates and scores are in the latest revalidation section above; production
deployment still requires operator configuration and live restore testing.

This is a repository-level review with local isolated tests. It is not an
external penetration test, a review of a live production environment, a
clinical validation, or a legal/privacy compliance certification.

## Baseline scores (superseded by the latest revalidation above)

| Area | Score | Basis |
|---|---:|---|
| Security | 78/100 | Important authorization and upload flaws fixed; 34 security checks pass. Remaining build-tool advisories and browser token-storage/CSP hardening keep the score below production assurance. |
| Code quality | 82/100 | Typecheck and build pass with no lint errors; 13 non-fatal Fast Refresh export warnings remain. |
| Performance | 74/100 | Route-level lazy loading reduced the entry JS chunk to 872.33 kB minified (246.26 kB gzip); it still exceeds Vite's 500 kB warning threshold. No load or database query profiling was run. |
| Maintainability | 76/100 | Backend and security regression scripts cover critical flows, but there is no discovered CI workflow, Docker setup, or Python dependency manifest. |
| Production readiness | 56/100 | Production environment checks are fail-closed, but the current Render plan/disk combination is incompatible and backups, restore drills, privileged-user bootstrap, and release gates need operator setup. |

## Baseline validation results (superseded by the latest revalidation above)

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run build` | Passed; mixed mock-data import warning fixed; entry JS chunk still exceeds the 500 kB warning threshold |
| `npm run lint` | 0 errors; 13 Fast Refresh warnings |
| Backend regression suite | 49 passed, 0 failed |
| Security battery | 34 passed, 0 failed |
| Full `npm audit` | 15 advisories: 5 high, 10 moderate, 0 critical |
| `npm audit --omit=dev` | 0 production dependency advisories |

The two backend suites were run against separate isolated in-memory instances;
the test instances were stopped afterward.

## Findings fixed in this audit

### F-01 — Public registration could grant privileged access

- **Severity:** High — fixed
- **File:** `server/routes/auth.cjs`
- **Problem and impact:** Registration previously allowed caller-controlled
  roles and organization fields, enabling a public user to request a privileged
  account.
- **Root cause:** The registration contract accepted authorization attributes
  from untrusted request data.
- **Fix:** The request schema now accepts only the `customer` role, enforces a
  12-character minimum password, and server-side creation assigns an empty
  organization. Login attempts are rate limited.
- **Corrected code shape:**

  ```js
  role: z.literal('customer')
  // During creation:
  role: 'customer',
  organization: '',
  ```

- **Explanation:** The server, rather than the client, now determines the
  account's initial privilege and tenant assignment.

### F-02 — JWT claims could outlive or override account authorization

- **Severity:** High — fixed
- **Files:** `server/middleware/auth.cjs`, `server/routes/transport.cjs`
- **Problem and impact:** A signed token's role/organization could be stale or
  manipulated in token claims and remain trusted for protected data access.
  The optional-auth transport history path was a separate bypass: it trusted
  role claims and could expose internal event actors and organizations after a
  role change.
- **Root cause:** Some request paths verified the signature but did not reload
  the current account.
- **Fix:** Tokens are restricted to HS256; both protected and optional
  transport authentication resolve the user from the database, require an
  active account, and build authorization context from current database fields.
  Database lookup errors are passed to the error handler.
- **Corrected code shape:**

  ```js
  const user = await userRepo.findById(payload.id);
  if (user?.status === 'active') {
    req.user = {
      id: user.id,
      name: user.name,
      role: user.role,
      organization: user.organization || '',
    };
  }
  ```

- **Explanation:** Existing tokens no longer preserve revoked/suspended access
  or authorize a different role/organization than the current database record.
  A regression test confirms a correctly signed customer token with forged
  admin claims receives only the public transport-history projection.

### F-03 — Prescription workflow could be changed through generic PATCH

- **Severity:** High — fixed
- **File:** `server/routes/prescriptions.cjs`
- **Problem and impact:** Directly patching workflow status or review fields
  could bypass pharmacist checklist and critical-alert controls, potentially
  advancing a prescription without required review.
- **Root cause:** Data-edit and workflow-transition operations shared a
  permissive update path.
- **Fix:** Generic PATCH rejects workflow-owned fields. A dedicated,
  validated status endpoint enforces permitted transitions; approval requires
  safety review, a completed checklist, and no unresolved critical alerts.
  Rejection after dispensing/cancellation is blocked.
- **Explanation:** Workflow rules are enforced on the server independently of
  frontend state.

### F-04 — Shipment and transport routes lacked consistent tenant checks

- **Severity:** High — fixed
- **Files:** `server/routes/shipments.cjs`, `server/routes/transport.cjs`
- **Problem and impact:** Cross-organization reads or shipment changes could
  expose private shipment information, permit unauthorized tracking updates,
  or alter stock reservations.
- **Root cause:** Legacy routes did not consistently scope resources to the
  caller and shipment participants.
- **Fix:** Shipment reads are participant-scoped; dispatch checks sender,
  released/unexpired batch, stock and verified receiver; cancellation is
  sender-only before shipment and restores reserved quantity. QR access,
  transporter assignment, scans, and delivery confirmation are participant
  scoped, and status changes cannot skip checkpoints.
- **Explanation:** Ownership and lifecycle rules are now checked in backend
  handlers, not inferred from UI visibility.

### F-05 — Truncated files could bypass magic-byte validation

- **Severity:** Medium — fixed
- **File:** `server/services/fileStorageService.cjs`
- **Problem and impact:** Signature checks were skipped for buffers shorter
  than eight bytes, allowing truncated content with an allowed declared MIME
  type to be stored. The `image/jpg` alias also did not match the canonical
  JPEG signature name.
- **Root cause:** Validation was guarded by a minimum buffer-length check
  rather than rejecting unmatched signatures.
- **Fix:** Buffer type and size consistency are checked; format-specific
  signatures are evaluated for every upload; unmatched/truncated data is
  rejected; `image/jpg` is normalized to `image/jpeg`.
- **Explanation:** A new regression case verifies that a truncated PNG is
  rejected with HTTP 422. The checks do not replace malware scanning or full
  media decoding.

### F-06 — Startup and production configuration were not fail-closed

- **Severity:** Medium — fixed
- **Files:** `server/db/repositories/repositoryFactory.cjs`,
  `server/config/env.cjs`, `server/db/connection.cjs`,
  `server/services/fileStorageService.cjs`, `server/index.cjs`
- **Problem and impact:** A missing repository bulk-insert operation broke
  reference-data seeding; production could fall back to non-durable memory
  storage or run without required cryptographic/configuration values.
- **Root cause:** Startup assumptions and development fallback behavior were
  not separated from production requirements.
- **Fix:** Added the repository method and corrected pagination behavior;
  production now requires MongoDB, JWT secret, exact CORS origins, and a valid
  32-byte file key. MongoDB failures abort production startup.
- **Explanation:** Invalid production configuration fails at startup instead
  of appearing healthy while losing persistence or file access.

## Remaining findings and required actions

### R-01 — Vulnerable development/build dependencies

- **Severity:** High (5 advisories); additional 10 moderate — unresolved
- **Files:** `package.json`, `package-lock.json`
- **Problem and impact:** `npm audit` reports high advisories in the
  Tailwind/chokidar/braces/fast-glob/micromatch dependency chain and moderate
  advisories in the Electron Builder chain. The advisories are in development
  tooling; the production-only audit reports zero advisories. A vulnerable
  build-time dependency can still affect developer/CI build availability or
  integrity.
- **Root cause:** Current Tailwind 3 and Electron Builder dependency trees do
  not have non-breaking fixes available through the current dependency ranges.
- **Recommended fix:** Plan and test a Tailwind 4 migration and a compatible
  Electron Builder dependency update in a separate change. Do not run
  `npm audit fix --force` without validating CSS/plugin behavior and installer
  output.
- **Corrected code:** No dependency migration was applied because the available
  automated fix is a breaking major-version change.
- **Explanation:** The runtime dependency tree currently audits clean, but the
  complete project audit is not clean.

### R-02 — Render Free plan conflicts with persistent prescription storage

- **Severity:** High deployment blocker — unresolved pending plan choice
- **Files:** `render.yaml`, `docs/DEPLOYMENT.md`
- **Problem and impact:** The blueprint selects `plan: free` and attaches a
  persistent disk. Render documents that Free web services cannot attach
  persistent disks and that their filesystems are ephemeral. This blueprint
  cannot safely persist encrypted prescription files on Free compute.
- **Root cause:** The deployment plan was left at Free while the application
  requires durable local file storage.
- **Recommended fix:** Select a paid Render compute plan before using this
  blueprint, or move prescription files to a durable object-storage service
  and remove the local-disk dependency. The paid-plan change is not made
  automatically because it can incur charges.
- **Explanation:** The deployment guide now calls out the incompatibility and
  requires a separate backup/restore setup. Render documentation:
  [Persistent disks](https://render.com/docs/disks) and
  [Free instances](https://render.com/docs/free).

### R-03 — Large initial frontend bundle (partially addressed)

- **Severity:** Medium — unresolved
- **Files:** `vite.config.ts`, `src/shared/data/mockData.ts` and importing pages
- **Problem and impact:** The entry JS chunk is now 872.33 kB minified
  (246.26 kB gzip), down from 2,339.58 kB, but still exceeds Vite's 500 kB
  warning threshold. The chart chunk is 448.26 kB minified (128.16 kB gzip).
- **Root cause:** Shared application code and chart-related dependencies remain
  large even after route-level code splitting.
- **Recommended fix:** Analyze the remaining entry dependencies, split the
  largest shared libraries where beneficial, and establish a measured bundle
  budget.
- **Corrected code:** Public and role-specific page modules are now loaded via
  route-level lazy imports with an accessible loading fallback. Removed a
  redundant dynamic import of `mockData.ts`, eliminating Vite's mixed
  static/dynamic import warning.
- **Explanation:** Build output confirms a 62.7% reduction in the entry JS
  chunk by uncompressed size. The remaining warning and lack of real-device
  load profiling mean the issue is improved, not fully resolved.

### R-04 — Operational controls are not yet reproducible

- **Severity:** Medium — unresolved
- **Files:** Repository deployment configuration and documentation
- **Problem and impact:** No Docker setup, CI workflow, Python dependency
  manifest, or automated MongoDB backup/restore configuration was found.
  There is also no documented secure first-administrator bootstrap procedure.
  This makes builds, OCR setup, recovery, and initial privileged-account
  provisioning dependent on manual operator knowledge.
- **Root cause:** Deployment configuration currently covers a Render blueprint
  and Vercel hosting, but not the full release/recovery lifecycle.
- **Recommended fix:** Add a CI gate for lint, typecheck, build, and regression
  suites; pin/document the optional OCR Python runtime; configure managed
  MongoDB backups and perform restore drills; provide a one-time,
  audited administrator bootstrap procedure.
- **Corrected code:** The deployment guide now documents the backup and restore
  requirement, but no external infrastructure configuration was changed.
- **Explanation:** The repository tests pass locally; no evidence currently
  demonstrates automated release gating or disaster recovery.

### R-05 — Frontend bearer token is stored in localStorage

- **Severity:** Medium hardening recommendation — unresolved
- **File:** `src/platform/auth/authService.ts`
- **Problem and impact:** A same-origin script injection could read the
  persisted bearer token and reuse it until expiry. No direct unsafe HTML sink
  using user-controlled content was identified; the only `innerHTML` use is a
  constant PWA update message. This is a defense-in-depth risk rather than a
  confirmed XSS exploit.
- **Root cause:** The SPA stores bearer credentials in browser-accessible
  storage.
- **Recommended fix:** Consider an HttpOnly, Secure, SameSite cookie session
  with CSRF defenses, plus a carefully tested Content Security Policy
  (currently disabled in the Express Helmet configuration). This changes the
  frontend/backend session architecture and was not applied without an
  explicit migration decision.
- **Corrected code:** No code change; this remains a documented hardening item.
- **Explanation:** HttpOnly cookies reduce token exposure to injected scripts,
  but require a coordinated API and CSRF design.

### R-06 — Lint reports Fast Refresh export warnings

- **Severity:** Low — unresolved
- **Files:** 9 files under `src/`, reported by `npm run lint`
- **Problem and impact:** 13 warnings arise where component modules also
  export hooks or shared values. They do not fail typecheck/build or indicate
  runtime errors, but can reduce React Fast Refresh reliability during
  development.
- **Root cause:** Mixed module boundaries in existing feature/provider files.
- **Recommended fix:** Move reusable hooks/constants into dedicated modules
  and update their imports. This was left for a focused refactor to avoid
  changing dozens of import sites during the security fixes.
- **Corrected code:** No rule suppression was added.
- **Explanation:** Lint currently has zero errors and 13 warnings.

## Security posture summary

Confirmed fixes cover public registration privilege escalation, database-backed
JWT authorization, prescription workflow bypasses, shipment/transport tenant
access, and truncated upload signatures. The security battery also checks
authentication failures, registration, IDOR boundaries, file type and
traversal handling, security headers, malformed JSON, and login rate limiting.

Before handling real patient or inventory data:

1. Resolve R-02 with a paid persistent-disk plan or durable object storage.
2. Configure MongoDB backups, retention, and a successful restore drill.
3. Resolve the remaining development dependency advisories through tested
   major-version migrations.
4. Decide whether to migrate bearer-token storage and add a compatible CSP.
5. Add CI release gates and validate production environment settings, TLS,
   exact CORS origins, file-key backup, monitoring, and administrator
   provisioning.
6. Perform independent clinical safety, privacy, and jurisdiction-specific
   regulatory review before using this system for real prescription decisions.
