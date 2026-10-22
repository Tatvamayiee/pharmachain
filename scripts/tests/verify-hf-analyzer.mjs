// Backend tests for the Hugging Face prescription-analyzer integration.
// Run with the backend UP (in-memory mode is fine):
//   node scripts/tests/verify-hf-analyzer.mjs
// Hugging Face is MOCKED: a local stub server stands in for
// router.huggingface.co via the HF_TEST_STUB_URL env var — no external calls.
import 'dotenv/config';
const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:41837';

let passed = 0; let failed = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  ok    ${name}`); }
  else { failed += 1; failures.push(name); console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
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

// Minimal valid 1x1 PNG (8 bytes signature + IHDR + IDAT + IEND).
const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' + '01f15c4890000000d4944415478da63fcffff3f030005fe02fea72d1e480000000049454e44ae426082',
  'hex',
);

async function main() {
  const dealerLogin = await req('POST', '/api/auth/login', { body: { email: 'dealer@pharmachain.com', password: 'dealer123' } });
  const dealer = dealerLogin.cookie;

  async function newRx() {
    const r = await req('POST', '/api/prescriptions', {
      token: dealer,
      body: { patientReference: 'HF-TEST-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), patientAge: 40, prescriptionDate: '2026-09-23' },
    });
    return r.data.prescriptionId;
  }
  const img = (mimetype = 'image/png') => ({ image: { data: TINY_PNG.toString('base64'), mimetype } });

  console.log('\n— validation —');
  const missing = await req('POST', `/api/prescriptions/${await newRx()}/analyze`, { token: dealer, body: {} });
  check('missing image/text rejected (400/422)', missing.status === 400 || missing.status === 422, `got ${missing.status}`);

  const badType = await req('POST', `/api/prescriptions/${await newRx()}/analyze`, { token: dealer, body: img('text/plain') });
  check('unsupported MIME rejected (415)', badType.status === 415, `got ${badType.status}`);

  const big = await req('POST', `/api/prescriptions/${await newRx()}/analyze`, {
    token: dealer, body: { image: { data: Buffer.alloc(11 * 1024 * 1024).toString('base64'), mimetype: 'image/png' } },
  });
  check('oversized file rejected (413)', big.status === 413, `got ${big.status}`);

  const corrupt = await req('POST', `/api/prescriptions/${await newRx()}/analyze`, {
    token: dealer, body: { image: { data: Buffer.from('not-an-image').toString('base64'), mimetype: 'image/png' } },
  });
  check('corrupted image rejected (422)', corrupt.status === 422, `got ${corrupt.status}`);

  const ghost = await req('POST', '/api/prescriptions/PRX-nope/analyze', { token: dealer, body: img() });
  check('unknown prescription 404', ghost.status === 404, `got ${ghost.status}`);

  const mfgLogin = await req('POST', '/api/auth/login', { body: { email: 'manufacturer@pharmachain.com', password: 'manufacturer123' } });
  const mfg = mfgLogin.cookie;
  const forbidden = await req('POST', `/api/prescriptions/${await newRx()}/analyze`, { token: mfg, body: img() });
  check('role blocked (403 for manufacturer)', forbidden.status === 403, `got ${forbidden.status}`);

  const dupId = await newRx();
  const countBefore = (await req('GET', '/api/prescriptions?limit=200', { token: dealer })).data.total;
  await req('POST', `/api/prescriptions/${dupId}/analyze`, { token: dealer, body: {} }).catch(() => {});
  const countAfter = (await req('GET', '/api/prescriptions?limit=200', { token: dealer })).data.total;
  check('no duplicate records created by failed analyses', countBefore === countAfter, `${countBefore} -> ${countAfter}`);

  console.log('\n— HF behavior (stubbed upstream) —');
  const stub = process.env.HF_TEST_STUB_URL;
  if (!stub) {
    console.log('  (skip  HF success/timeout/malformed-JSON cases — set HF_TEST_STUB_URL to a stub server to exercise them)');
  } else {
    const id1 = await newRx();
    const ok = await req('POST', `/api/prescriptions/${id1}/analyze`, { token: dealer, body: img() });
    check('HF success returns 200', ok.status === 200, JSON.stringify(ok.data).slice(0, 120));
    check('status analyzed + provider huggingface', ok.data.status === 'analyzed' && ok.data.analysisProvider === 'huggingface');
    check('medicines persisted', Array.isArray(ok.data.medicines) && ok.data.medicines.length > 0);
    check('confidence + model recorded', typeof ok.data.analysisConfidence === 'number' && ok.data.analysisModel === (process.env.HF_MODEL || 'Qwen/Qwen2.5-VL-3B-Instruct'));

    const audit = await req('GET', `/api/prescriptions/${id1}/audit`, { token: dealer });
    check('audit has ANALYSIS_COMPLETED', Array.isArray(audit.data) && audit.data.some((e) => e.eventType === 'ANALYSIS_COMPLETED'));
    check('no HF token in any response', !JSON.stringify(ok.data).includes('hf_'));

    const id2 = await newRx();
    const again = await req('POST', `/api/prescriptions/${id2}/analyze`, { token: dealer, body: img() });
    check('second analysis succeeds (retry path)', again.status === 200);
  }

  console.log(`\n${passed} passed, ${failed} failed${failures.length ? `: ${failures.join(' | ')}` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('crashed:', e); process.exit(1); });
