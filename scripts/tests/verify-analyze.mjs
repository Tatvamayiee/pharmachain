// End-to-end verification of POST /api/prescriptions/:id/analyze.
// Run with the backend up:  node scripts/tests/verify-analyze.mjs
// Expects a mock AI provider on :4599 (node scripts/dev/mock-ai.cjs) — with one
// running, the full analyze flow is exercised; without one, the script still
// verifies the honest 501 (provider not configured) path.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:41837';

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  ok    ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null };
}

async function main() {
  const login = await req('POST', '/api/auth/login', { body: { email: 'dealer@pharmachain.com', password: 'dealer123' } });
  const token = login.cookie;
  check('dealer login', login.status === 200 && !!token);

  const created = await req('POST', '/api/prescriptions', {
    token,
    body: { patientReference: 'PAT-AI-' + Date.now(), patientAge: 30, prescriptionDate: '2026-09-23' },
  });
  const id = created.data.prescriptionId;
  check('prescription created', created.status === 201 && !!id);

  const fs = await import('fs');
  const path = await import('path');
  const imgBuf = fs.readFileSync(path.join(ROOT, 'public', 'rx-sample-a.png'));
  const base64Data = imgBuf.toString('base64');

  const r = await req('POST', `/api/prescriptions/${id}/analyze`, {
    token,
    body: {
      image: {
        data: base64Data,
        mimetype: 'image/png',
      },
    },
  });

  if (r.status === 501) {
    check('analyze honest 501 when no provider configured', true);
    console.log('\n(No AI provider configured — 501 path verified. Start scripts/dev/mock-ai.cjs and set PHARMACHAIN_AI_* in .env to test the full flow.)');
  } else if (r.status === 200) {
    check('analyze 200 with provider', true);
    check('medicines extracted (3)', Array.isArray(r.data.medicines) && r.data.medicines.length === 3, JSON.stringify(r.data.medicines).slice(0, 140));
    check('status advanced to analyzed', r.data.status === 'analyzed', r.data.status);
    check('analysisProvider recorded', !!r.data.analysisProvider && r.data.analysisProvider !== 'mock', r.data.analysisProvider);
    check('requiresHumanReview stays true', r.data.requiresHumanReview === true);
    const audit = await req('GET', `/api/prescriptions/${id}/audit`, { token });
    const types = Array.isArray(audit.data) ? audit.data.map((e) => e.eventType) : [];
    check('audit has ANALYSIS_COMPLETED', types.includes('ANALYSIS_COMPLETED'), types.join(','));
  } else {
    check('analyze unexpected status', false, `got ${r.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('crashed:', e); process.exit(1); });
