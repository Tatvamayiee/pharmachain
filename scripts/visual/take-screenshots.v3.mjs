/**
 * PharmaChain — Hackwave Screenshot Capture (v3)
 *
 * WHY v2 PRODUCED SEVEN IDENTICAL IMAGES
 * --------------------------------------
 * v2 wrote the session into localStorage under `pc_user`, but the app reads
 * `pharmachain_session_v1` (see src/platform/auth/authService.ts). `useAuth()` never
 * saw a user, so `RequireAuth` redirected every protected route to `/login` and
 * all seven "screens" were captures of the login page.
 *
 * v3 fixes, in order of importance:
 *   1. Use the backend's HttpOnly session cookie instead of browser token storage.
 *   2. Waits for a screen-specific DOM signal instead of a fixed sleep, then
 *      ASSERTS the route. A screenshot that cannot prove its route fails.
 *   3. Fails loudly (non-zero exit) when an assertion breaks.
 *   4. Never fabricates a stock change: the billing/sales routers are not
 *      mounted on this API build, so the stock screen is captured as a truthful
 *      snapshot instead of a fake before/after pair.
 *
 * Usage:
 *   node scripts/visual/take-screenshots.v3.mjs
 *   node scripts/visual/take-screenshots.v3.mjs --base http://localhost:5176 --api http://localhost:41838
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const BASE = argOf('--base', process.env.PC_BASE || 'http://localhost:5176');
const API = argOf('--api', process.env.PC_API || 'http://localhost:41838');
const OUT = path.join(ROOT, 'screenshots');
const VIEWPORT = { width: 1400, height: 900 };

const DEALER = { email: 'dealer@pharmachain.com', password: 'dealer123' };
const MANUFACTURER = { email: 'manufacturer@pharmachain.com', password: 'manufacturer123' };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const captured = [];

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  \u2714 ${msg}`); }
function fail(msg) { console.log(`  \u2718 ${msg}`); failures.push(msg); }

async function apiLogin(creds) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const data = await res.json().catch(() => ({}));
  const cookie = res.headers.get('set-cookie')?.split(';', 1)[0] || null;
  if (!res.ok || !cookie || data.token) {
    throw new Error(`Login failed for ${creds.email} (HTTP ${res.status}): ${JSON.stringify(data)}`);
  }
  return { ...data, cookie };
}

/**
 * Build the user profile used for screenshot labels.
 */
function sessionFrom(user) {
  return {
    id: user.id || '',
    name: user.name || user.email,
    email: user.email,
    role: user.role,
    organization: user.organization || '',
    phone: user.phone || '',
    address: user.address || '',
    status: user.status || 'active',
    createdAt: user.createdAt || new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
}

/**
 * Install the backend cookie before loading the app so /api/auth/me restores
 * the authenticated user during provider initialization.
 */
async function signIn(page, sessionCookie) {
  const [name, value] = sessionCookie.split('=', 2);
  await page.setCookie({
    name,
    value,
    url: API,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 90000 });
  await waitForAppShell(page);
}

/** Navigate to an authenticated route and wait until the app has really left /login. */
async function openAuthed(page, urlPath, readySelector, opts = {}) {
  // Vite's HMR websocket occasionally stalls a navigation under load, which
  // shows up as a failed readiness selector rather than a failed load. One
  // clean retry makes the run reliable without weakening the assertions.
  const attempts = 2;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await page.goto(`${BASE}${urlPath}`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction((p) => window.location.pathname === p, { timeout: 20000, polling: 200 }, urlPath);
      // Vite dev serves the SPA shell first and mounts React afterwards. Waiting
      // only for the load event races the first render, so wait for the shell
      // to be replaced by real app content before probing route selectors.
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root');
          return !!root && root.children.length > 0 && document.body.innerText.trim().length > 40;
        },
        { timeout: 25000 },
      );
      if (readySelector) {
        // Some readiness anchors (e.g. the hidden <input type=file> behind a
        // custom "Browse Files" button) are intentionally display:none — pass
        // { visible: false } for those.
        await page.waitForSelector(readySelector, { visible: opts.visible !== false, timeout: 20000 });
      }
      await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
      await wait(350);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        log(`  \u21bb ${urlPath} did not settle (attempt ${attempt}/${attempts}) — retrying`);
        await wait(1500);
        // Re-seed the session; a reload can drop it if the shell re-mounted.
        if (opts.sessionCookie) await signIn(page, opts.sessionCookie);
      }
    }
  }
  throw lastErr;
}

/** Refuse to save a screenshot that is actually the login page. */
async function shot(page, name, desc, expectPath = null) {
  const actualPath = await page.evaluate(() => window.location.pathname);
  if (expectPath && actualPath !== expectPath) {
    fail(`${name}: expected ${expectPath} but landed on ${actualPath} — screenshot rejected`);
    return false;
  }
  if (!expectPath && actualPath === '/login') {
    fail(`${name}: landed on /login — session not applied, screenshot rejected`);
    return false;
  }
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const kb = Math.round(fs.statSync(file).size / 1024);
  const heading = await page.evaluate(() => {
    const h = document.querySelector('h1, h2');
    return h ? h.textContent.trim().slice(0, 60) : '(no heading)';
  });
  captured.push({ name, file, kb, path: actualPath, heading, desc });
  ok(`${name}.png (${kb} KB) — ${actualPath} [${heading}] — ${desc}`);
  return true;
}

function assertDistinct() {
  // Compare full file bytes. Bucketing by size first is only an optimisation;
  // equal size is not equal content, so every pair in a bucket is compared.
  const bySize = new Map();
  for (const c of captured) {
    const buf = fs.readFileSync(c.file);
    if (!bySize.has(buf.length)) bySize.set(buf.length, []);
    bySize.get(buf.length).push({ buf, name: c.name, path: c.path });
  }
  for (const group of bySize.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (Buffer.compare(group[i].buf, group[j].buf) === 0) {
          fail(
            `IDENTICAL OUTPUT: ${group[i].name} (${group[i].path}) is byte-identical to ` +
            `${group[j].name} (${group[j].path})`,
          );
        }
      }
    }
  }
}

/**
 * Navigate without relying on Chrome lifecycle events.
 *
 * On this machine `localhost` resolves to BOTH ::1 and 127.0.0.1 while Vite
 * binds only ::1. `page.goto(..., domcontentloaded)` therefore receives the
 * 200 response but never observes the lifecycle event, and times out. Using
 * `commit` + an explicit DOM poll sidesteps the resolver entirely and works on
 * whichever host family actually answers.
 */

/** Poll until the React root has mounted real content. */
async function waitForAppShell(page, timeout = 30000) {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return !!root && root.children.length > 0 && document.body.innerText.trim().length > 40;
    },
    { timeout, polling: 200 },
  );
}

(async () => {
  log('\n\ud83d\udcf8 PharmaChain Screenshot Capture v3');
  log(`   UI  : ${BASE}`);
  log(`   API : ${API}\n`);

  fs.mkdirSync(OUT, { recursive: true });

  // Archive the previous (invalid) capture set instead of overwriting it.
  const existing = fs.readdirSync(OUT).filter((f) => f.startsWith('A2') && f.endsWith('.png'));
  if (existing.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stale = path.join(ROOT, 'Archive_Review', 'Screenshots_v2_invalid', stamp);
    fs.mkdirSync(stale, { recursive: true });
    for (const f of existing) fs.renameSync(path.join(OUT, f), path.join(stale, f));
    log(`\u26a0  Moved ${existing.length} previous screenshots to ${path.relative(ROOT, stale)}`);
  }

  // ---- Auth ----------------------------------------------------------------
  log('\ud83d\udd11 Authenticating against the API...');
  const dealerLogin = await apiLogin(DEALER);
  const dealerSession = sessionFrom(dealerLogin.user);
  ok(`dealer session: ${dealerSession.email} (org: ${dealerSession.organization})`);

  const health = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => ({}));
  ok(`backend health: ${JSON.stringify(health)}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: VIEWPORT,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // ── A2.1 — Login / landing page ─────────────────────────────────────────
    log('\n[A2.1] Login / landing page');
    await page.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20000 });
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find((el) => el.textContent.trim().toLowerCase() === 'dealer');
      if (b) b.click();
    });
    await wait(400);
    await shot(page, 'A2.1-login', 'Login / landing page with Dealer role selected', '/login');

    // Apply the dealer session for all authenticated screens.
    await signIn(page, dealerLogin.cookie);

    // ── A2.2 — Prescription upload ──────────────────────────────────────────
    log('\n[A2.2] Prescription upload screen');
    await openAuthed(page, '/dealer/prescriptions/scan', 'input[type="file"]', { visible: false });
    const sampleRx = path.join(ROOT, 'public', 'rx-sample-a.png');
    if (!fs.existsSync(sampleRx)) {
      fail(`sample prescription missing: ${sampleRx}`);
    } else {
      const input = await page.$('input[type="file"]');
      await input.uploadFile(sampleRx);
      // The card swaps to a preview once the file is normalised and accepted.
      await page
        .waitForFunction(
          () => !document.body.innerText.includes('Drag & drop the prescription file here'),
          { timeout: 20000 },
        )
        .catch(() => fail('A2.2: file preview never appeared'));
      await wait(300);
    }
    await shot(page, 'A2.2-prescription-upload', 'Sample Rx attached, local preview shown');

    // ── A2.3 — Analysis result ──────────────────────────────────────────────
    log('\n[A2.3] Running analysis (real backend AI — no mock fallback)');
    await page.evaluate(() => {
      const ref = document.querySelector('input[name="patientReference"]');
      if (!ref) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(ref, 'PT-2024-0042');
      ref.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const hasSubmit = await page.evaluate(() => {
      const form = document.querySelector('form');
      return !!(form && form.querySelector('button[type="submit"]'));
    });
    if (hasSubmit) {
      await page.evaluate(() => {
        const form = document.querySelector('form');
        form.querySelector('button[type="submit"]').click();
      });
      log('  \u2192 Analyze submitted, waiting for the analysis UI to resolve...');
      await page
        .waitForFunction(
          () => /Analysis progress|OCR confidence|Unable to analyze|Analysis complete/i.test(document.body.innerText),
          { timeout: 150000, polling: 500 },
        )
        .catch(() => fail('A2.3: analysis UI never resolved'));
      // Wait for the stepper to finish if it is still running.
      await page
        .waitForFunction(() => !document.querySelector('ol[aria-label="Analysis progress"]'), {
          timeout: 150000,
          polling: 500,
        })
        .catch(() => {});
      await wait(600);
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (/Unable to analyze/i.test(bodyText)) {
        fail('A2.3: analysis returned an error state (AI provider unavailable) — captured as-is, do not submit');
      }
    } else {
      fail('A2.3: analyze button not found');
    }
    await shot(page, 'A2.3-analysis-result', 'Extracted candidates / confidence / AI source');

    // ── A2.4 — Inventory dashboard ──────────────────────────────────────────
    log('\n[A2.4] Inventory / stock dashboard');
    await openAuthed(page, '/dealer/stock', 'table tbody tr, [role="status"]', {
      session: dealerSession,
      sessionCookie: dealerLogin.cookie,
    });
    await page
      .waitForFunction(() => !/Loading/i.test(document.body.innerText), { timeout: 15000 })
      .catch(() => {});
    await shot(page, 'A2.4-inventory-dashboard', 'Live org-scoped stock from /api/inventory/stock');

    // ── A2.5 — Stock snapshot ───────────────────────────────────────────────
    // POST /api/platform/bills and /api/platform/sales are 404 on this build
    // (the platform router is not mounted in server/index.cjs), so no endpoint
    // can honestly deduct stock. We capture the real current quantity and label
    // it truthfully rather than fabricating a "before/after" sale.
    log('\n[A2.5] Stock snapshot');
    const stockRows = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('table tbody tr')];
      return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()));
    });
    const pantoRow = stockRows.find((r) => r.some((c) => /Pantoprazole/i.test(c)));
    if (pantoRow) {
      log(`  \u2192 Pantoprazole row: ${JSON.stringify(pantoRow)}`);
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('table tbody tr')].find((tr) =>
          /Pantoprazole/i.test(tr.innerText),
        );
        if (!row) return;
        row.scrollIntoView({ block: 'center' });
        row.style.outline = '3px solid #4f46e5';
        row.style.outlineOffset = '-3px';
      });
      await wait(400);
      await shot(page, 'A2.5-stock-snapshot', 'Pantoprazole lot highlighted — live quantity');
    } else {
      fail('A2.5: Pantoprazole not present in the dealer stock table');
      await shot(page, 'A2.5-stock-snapshot', 'Dealer stock table');
    }

    // ── A2.6 — Batch details (manufacturer role) ────────────────────────────
    // /manufacturer/batch-management does not exist; the real route is
    // /manufacturer/batches and it requires the manufacturer role.
    log('\n[A2.6] Batch / medicine details (manufacturer)');
    const mfgLogin = await apiLogin(MANUFACTURER);
    await signIn(page, mfgLogin.cookie);
    try {
      await openAuthed(page, '/manufacturer/batches', 'table tbody tr');
      await shot(page, 'A2.6-batch-details', 'Manufacturer batch management');
    } catch (e) {
      fail(`A2.6: /manufacturer/batches unavailable — ${e.message}`);
    }

    // ── Verdict ─────────────────────────────────────────────────────────────
    assertDistinct();

    log('\n' + '\u2500'.repeat(70));
    log(`Captured ${captured.length} screen(s) into screenshots/`);
    for (const c of captured) log(`   \u2022 ${path.basename(c.file)} (${c.kb} KB) — ${c.path}`);

    if (failures.length) {
      log(`\n\u274c ${failures.length} problem(s):`);
      for (const f of failures) log(`   - ${f}`);
      process.exitCode = 1;
    } else {
      log('\n\u2705 All screens captured, each on its expected route, all images distinct.');
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('\n\u274c Fatal:', err);
  process.exit(1);
});
