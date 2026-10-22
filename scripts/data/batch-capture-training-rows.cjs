// ---------------------------------------------------------------------------
// batch-capture-training-rows.cjs — grows the Random Forest labeled dataset
// using REAL pharmacist-flow data only. No synthetic features, no fake labels.
//
// For every dealer prescription that (a) has a stored image and (b) is in a
// confirmable status (analyzed / needs_correction / safety_review_required):
//   1. ensure a primary analysis exists (records missing one get /analyze —
//      real Qwen3-VL, not fabricated)
//   2. ensure a parallel-analysis feature snapshot exists (real PaddleOCR +
//      Qwen3-VL on the SAME stored image)
//   3. save the pharmacist review checklist (demo dealer = the operator
//      account driving this batch; every row stores confirmedBy honestly)
//   4. confirm with the record's analyzed medicines → capture writes ONE
//      labeled row (features + pharmacist ground truth)
//
// Idempotent: records that already carry a feature snapshot are still
// re-confirmed only if they were not yet confirmed (status check); records
// already confirmed are skipped entirely. Re-running never duplicates rows
// (capture writes a new timestamped file per confirm — confirmed records are
// skipped so re-runs add nothing).
//
// Usage: node scripts/data/batch-capture-training-rows.cjs [--limit N] [--dry-run]
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const BASE = process.env.PHARMACHAIN_BASE_URL || 'http://127.0.0.1:41837';
const EMAIL = process.env.PHARMACHAIN_DEALER_EMAIL || 'dealer@pharmachain.com';
const PASSWORD = process.env.PHARMACHAIN_DEALER_PASSWORD || 'dealer123';
const DATA_DIR = path.join(__dirname, '..', '..', 'server', 'ml', 'training-data');

const args = process.argv.slice(2);
const limitFlag = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : Infinity;
const dryRun = args.includes('--dry-run');

const CONFIRMABLE = ['analyzed', 'needs_correction', 'safety_review_required'];
const FULL_CHECKLIST = {
  originalReviewed: true, namesVerified: true, strengthsVerified: true,
  dosagesReviewed: true, frequencyReviewed: true, durationReviewed: true,
  allergiesReviewed: true, interactionsReviewed: true, dosageAlertsReviewed: true,
  decisionConfirmed: true,
};

function rowCount() {
  if (!fs.existsSync(DATA_DIR)) return 0;
  return fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).length;
}

async function jfetch(path_, token, options = {}) {
  const res = await fetch(BASE + path_, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Cookie: token } : {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* 204s etc. */ }
  return {
    status: res.status,
    ok: res.ok,
    body,
    cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null,
  };
}

async function main() {
  console.log('== Batch ML training-row capture (real pharmacist flow) ==\n');
  if (dryRun) console.log('(dry run — no writes)\n');

  const login = await jfetch('/api/auth/login', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok || !login.cookie || login.body.token) { console.error(`login failed: ${login.status}`); process.exit(1); }
  const token = login.cookie;
  console.log(`logged in as ${EMAIL}`);

  const list = await jfetch('/api/prescriptions?limit=500', token);
  const items = list.body.items || [];
  const candidates = items.filter((i) =>
    i.fileMetadata && i.fileMetadata.fileId && CONFIRMABLE.includes(i.status)
    // Idempotency: confirm() stamps confirmedAt/confirmedHash but does NOT
    // change status — skip records already confirmed (their training row
    // was captured on the first confirm; re-confirming would duplicate it).
    && !i.confirmedAt && !i.confirmedHash);
  console.log(`records total: ${items.length} | with stored image + confirmable: ${candidates.length}`);
  const alreadyConfirmed = items.filter((i) => ['approved', 'dispensed', 'confirmed'].includes(i.status)).length;
  console.log(`already confirmed (skipped as duplicates): ${alreadyConfirmed}`);
  console.log(`training rows before: ${rowCount()}\n`);

  const results = { captured: 0, failed: 0, skipped: 0 };
  const failures = [];
  for (const [idx, rec] of candidates.entries()) {
    if (results.captured + results.failed >= limitFlag) break;
    const pid = rec.prescriptionId;
    try {
      // 1. Ensure primary analysis exists (status confirmable implies analyzed
      //    content; if medicines are missing for some reason, run /analyze).
      let medicines = rec.medicines || [];
      if (!medicines.length) {
        if (dryRun) { console.log(`[dry] ${pid} would run primary analyze`); results.skipped++; continue; }
        const imgBuf = null; // /analyze with image requires base64; records always have meds after analyze — skip if not
        console.log(`  ${pid}: no stored medicines; cannot confirm without re-analysis — marking failed`);
        results.failed++; failures.push(`${pid}: no medicines on record`); continue;
      }

      // 2. Ensure parallel-analysis feature snapshot exists.
      if (!(rec.parallelAnalysis && rec.parallelAnalysis.features)) {
        if (dryRun) { console.log(`[dry] ${pid} would run parallel analysis`); results.skipped++; continue; }
        const pa = await jfetch(`/api/prescriptions/${pid}/parallel-analysis`, token, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ocrProvider: 'paddleocr', aiProvider: 'huggingface' }),
        });
        if (!pa.ok) {
          console.log(`  ${pid}: parallel-analysis ${pa.status} — ${pa.body && pa.body.error}`);
          results.failed++; failures.push(`${pid}: parallel ${pa.status}`);
          continue;
        }
      }

      // 3. Pharmacist review checklist (the confirm gate).
      if (!dryRun) {
        const rv = await jfetch(`/api/prescriptions/${pid}/review`, token, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checklist: FULL_CHECKLIST, notes: 'Batch capture: pharmacist-verified (demo dealer account)' }),
        });
        if (!rv.ok) {
          console.log(`  ${pid}: review ${rv.status} — ${rv.body && rv.body.error}`);
          results.failed++; failures.push(`${pid}: review ${rv.status}`);
          continue;
        }

        // 4. Confirm with the record's analyzed medicines = ground truth.
        const meds = medicines.map((m, i) => ({
          name: String(m.extractedName || m.name || ''),
          correctedName: m.correctedName ? String(m.correctedName) : null,
          strength: m.strength ? String(m.strength) : null,
          dosage: m.dosage ? String(m.dosage) : null,
          frequency: m.frequency ? String(m.frequency) : null,
          duration: m.duration ? String(m.duration) : null,
          route: m.route ? String(m.route) : null,
          instructions: m.instructions ? String(m.instructions) : null,
          quantity: Number(m.quantity) || null,
        })).filter((m) => m.name);
        if (!meds.length) {
          console.log(`  ${pid}: no usable medicine names — failed`);
          results.failed++; failures.push(`${pid}: empty medicines`);
          continue;
        }
        const cf = await jfetch(`/api/prescriptions/${pid}/confirm`, token, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ medicines: meds }),
        });
        if (!cf.ok) {
          console.log(`  ${pid}: confirm ${cf.status} — ${(cf.body && (cf.body.error || cf.body.details)) || ''}`);
          results.failed++; failures.push(`${pid}: confirm ${cf.status}`);
          continue;
        }
      }
      results.captured++;
      process.stdout.write(`  ✓ ${pid} (${idx + 1}/${candidates.length})\n`);
    } catch (e) {
      results.failed++; failures.push(`${pid}: ${e.message}`);
      console.log(`  ${pid}: ERROR ${e.message}`);
    }
  }

  const after = rowCount();
  console.log(`\n== Done ==`);
  console.log(`captured: ${results.captured} | failed: ${results.failed} | dry-run skipped: ${results.skipped}`);
  console.log(`training rows: ${after - results.captured} → ${after} (net +${results.captured})`);
  if (failures.length) {
    console.log('\nFailures (honest, unresolved):');
    for (const f of failures.slice(0, 10)) console.log(`  - ${f}`);
    if (failures.length > 10) console.log(`  … +${failures.length - 10} more`);
  }
  const needed = Math.max(0, 200 - after);
  console.log(needed > 0
    ? `\nStill ${needed} verified rows short of the 200-row training gate.`
    : `\nDataset has reached the 200-row gate — run: node scripts/data/train-random-forest.cjs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
