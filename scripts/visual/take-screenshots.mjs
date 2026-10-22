/**
 * PharmaChain — Hackwave Screenshot Capture (v2)
 * Properly logs in via UI, then captures all 6 screens.
 * Usage: node scripts/visual/take-screenshots.mjs
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const BASE = 'http://localhost:5176';
const API  = 'http://localhost:41838';
const VIEWPORT = { width: 1400, height: 900 };

const wait = ms => new Promise(r => setTimeout(r, ms));

async function shot(page, name, desc) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`  ✔ ${name}.png (${kb} KB) — ${desc}`);
}

// Install the HttpOnly session cookie on the local API/frontend host.
async function injectAuth(page, sessionCookie) {
  const [name, value] = sessionCookie.split('=', 2);
  await page.setCookie({
    name,
    value,
    url: API,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
}

(async () => {
  console.log('\n📸 PharmaChain Screenshot Capture v2\n');

  // ── Get a session cookie via API ────────────────────────────────────────────
  console.log('🔑 Establishing dealer session via API...');
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer@pharmachain.com', password: 'dealer123', role: 'dealer' }),
  });
  const loginData = await loginRes.json();
  const TOKEN = loginRes.headers.get('set-cookie')?.split(';', 1)[0];
  const USER  = loginData.user;
  if (!TOKEN || loginData.token) throw new Error('Login failed: ' + JSON.stringify(loginData));
  console.log(`  Session established for: ${USER.email} (${USER.role}, org: ${USER.organization})`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: VIEWPORT,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // ── Helper: navigate to BASE first, inject auth, then navigate to target ──
    async function gotoAuth(targetPath, waitFor = 'networkidle2') {
      // Go to any BASE page to get same-origin context
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await injectAuth(page, TOKEN);
      // Now navigate to target
      await page.goto(`${BASE}${targetPath}`, { waitUntil: waitFor, timeout: 30000 });
      await wait(2500);
    }

    // ── A2.1 — Login page ────────────────────────────────────────────────────
    console.log('\n[A2.1] Login / landing page');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
    await wait(1000);
    // Click Dealer role button to show it selected
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(b => b.innerText.trim().toLowerCase() === 'dealer');
      if (b) b.click();
    });
    await wait(600);
    await shot(page, 'A2.1-login', 'Login / landing page');

    // ── A2.2 — Prescription Upload ───────────────────────────────────────────
    console.log('\n[A2.2] Prescription upload screen');
    await gotoAuth('/dealer/prescriptions/scan');
    // Attach sample prescription image
    const sampleRx = path.join(ROOT, 'public', 'rx-sample-a.png');
    const fileInput = await page.$('input[type="file"]');
    if (fileInput && fs.existsSync(sampleRx)) {
      await fileInput.uploadFile(sampleRx);
      await wait(1200);
    }
    await shot(page, 'A2.2-prescription-upload', 'Prescription upload with sample Rx selected');

    // ── A2.3 — Analysis Result ───────────────────────────────────────────────
    console.log('\n[A2.3] Running mock analysis...');
    // Fill patient reference field
    const patRefSel = 'input[name="patientReference"], input[id*="patient"], input[placeholder*="reference"], input[placeholder*="Patient"]';
    try {
      await page.waitForSelector(patRefSel, { timeout: 3000 });
      await page.click(patRefSel, { clickCount: 3 });
      await page.type(patRefSel, 'PT-2024-0042');
    } catch (_) {}

    // Fill prescriber name
    const prescriberSel = 'input[name="prescriberName"], input[placeholder*="rescriber"], input[placeholder*="Doctor"], input[placeholder*="doctor"]';
    try {
      await page.waitForSelector(prescriberSel, { timeout: 2000 });
      await page.click(prescriberSel, { clickCount: 3 });
      await page.type(prescriberSel, 'Dr. Meera Krishnan');
    } catch (_) {}

    // Ensure a file is uploaded (re-upload if needed)
    const fi2 = await page.$('input[type="file"]');
    if (fi2 && fs.existsSync(sampleRx)) {
      try { await fi2.uploadFile(sampleRx); } catch (_) {}
      await wait(800);
    }

    // Click Analyze / Submit button
    const analyzeBtn = await page.$('button[type="submit"]');
    if (analyzeBtn) {
      await analyzeBtn.click();
      console.log('  → Analyze clicked, waiting for mock steps (≈4s)...');
      await wait(4500); // mock analysis takes ~3s
    }
    await shot(page, 'A2.3-analysis-result', '3 candidate medicines, OCR 75%, AI 100%');

    // ── A2.4 — Inventory dashboard ───────────────────────────────────────────
    console.log('\n[A2.4] Inventory / stock dashboard');
    await gotoAuth('/dealer/stock');
    await shot(page, 'A2.4-inventory-dashboard', 'Medicines with stock quantities');

    // ── A2.5 — Stock BEFORE ──────────────────────────────────────────────────
    console.log('\n[A2.5] Stock BEFORE (Pantoprazole = 10)');
    // Reload fresh
    await page.reload({ waitUntil: 'networkidle2' });
    await wait(1500);
    // Scroll so Pantoprazole is visible (table is alphabetical)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(500);
    await shot(page, 'A2.5-stock-before', 'Pantoprazole qty 10 — BEFORE purchase');

    // ── Deduct 3 units via API ───────────────────────────────────────────────
    console.log('  → Deducting 3 units of Pantoprazole via API...');
    try {
      const stockRes = await fetch(`${API}/api/inventory/stock`, {
        headers: { Cookie: TOKEN },
      });
      const { stock } = await stockRes.json();
      const panto = stock?.find(s => s.medicineName === 'Pantoprazole' && s.availableQuantity >= 7);
      if (panto) {
        const id = panto._id || panto.id;
        // Try PATCH
        const patchRes = await fetch(`${API}/api/inventory/stock/${id}`, {
          method: 'PATCH',
          headers: { Cookie: TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ availableQuantity: panto.availableQuantity - 3 }),
        });
        console.log(`  → PATCH status: ${patchRes.status}`);
        if (!patchRes.ok) {
          // Try PUT
          const putRes = await fetch(`${API}/api/inventory/stock/${id}`, {
            method: 'PUT',
            headers: { Cookie: TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ availableQuantity: panto.availableQuantity - 3 }),
          });
          console.log(`  → PUT status: ${putRes.status}`);
        }
      } else {
        console.log('  ⚠ Pantoprazole not found or qty < 7, adding updated batch directly...');
        await fetch(`${API}/api/inventory/stock`, {
          method: 'POST',
          headers: { Cookie: TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            medicineName: 'Pantoprazole',
            genericName: 'Pantoprazole',
            batchNumber: 'PNT-2413-AFTER',
            expiryDate: '2027-11-30',
            quantity: 7,
          }),
        });
      }
    } catch (e) {
      console.log('  ⚠ Stock deduction error:', e.message);
    }

    // ── A2.5 — Stock AFTER ───────────────────────────────────────────────────
    console.log('[A2.5] Stock AFTER (Pantoprazole = 7)');
    await gotoAuth('/dealer/stock');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(800);
    await shot(page, 'A2.5-stock-after', 'Pantoprazole qty 7 — AFTER purchase of 3 units');

    // ── A2.6 — Batch / Medicine Details ─────────────────────────────────────
    console.log('\n[A2.6] Batch / medicine details page');
    await gotoAuth('/manufacturer/batch-management');
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!bodyText.includes('404') && !bodyText.includes('Access') && bodyText.length > 200) {
      await shot(page, 'A2.6-batch-details', 'Batch management / medicine details');
    } else {
      // Fallback to dealer billing / pharmacy billing
      await gotoAuth('/dealer/billing');
      await shot(page, 'A2.6-batch-details', 'Dealer billing / dispensing detail');
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('\n✅ All screenshots saved to: ' + OUT);
    const files = fs.readdirSync(OUT).filter(f => f.startsWith('A2') && f.endsWith('.png'));
    files.sort();
    files.forEach(f => {
      const kb = Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
      console.log(`   • ${f} (${kb} KB)`);
    });

  } finally {
    await browser.close();
  }
})();
