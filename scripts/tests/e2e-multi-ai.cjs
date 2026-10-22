// ---------------------------------------------------------------------------
// Multi-AI E2E proof — ONE real prescription image through the live chain:
//   1. /analyze        → primary (Gemini 2.5 Pro), fallback Qwen3-VL
//   2. GET /providers  → configured providers (no credentials)
//   3. /reanalyze paddleocr → local PaddleOCR + AI structuring, stored image
//   4. /reanalyze huggingface → Qwen3-VL again, stored image
//   5. comparison      → field-by-field MATCH / NEEDS_VERIFICATION
// No stubs, no mocks. Failures are printed as-is.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:41837';
const IMAGE = path.join(__dirname, '..', '..', 'public', 'rx-real.png');

async function main() {
  const png = fs.readFileSync(IMAGE);
  console.log('Image:', IMAGE, `(${png.length} bytes)`);

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer@pharmachain.com', password: 'dealer123' }),
  });
  const token = login.headers.get('set-cookie')?.split(';', 1)[0];
  const loginData = await login.json();
  if (!token || loginData.token) throw new Error('login failed');
  const auth = { 'Content-Type': 'application/json', Cookie: token };

  // ---- 1. Primary analysis -------------------------------------------------
  const create = await fetch(BASE + '/api/prescriptions', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ patientReference: 'MULTI-AI-' + Date.now(), patientAge: 34, prescriptionDate: '2026-09-24' }),
  });
  const PID = (await create.json()).prescriptionId;
  console.log('created', PID);

  let t0 = Date.now();
  const an = await fetch(`${BASE}/api/prescriptions/${PID}/analyze`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ image: { data: png.toString('base64'), mimetype: 'image/png' } }),
  });
  const anBody = await an.json();
  const d = anBody.data || anBody.prescription || anBody;
  console.log(`\n[1] ANALYZE → HTTP ${an.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('    provider:', d.analysisProvider, '| model:', d.analysisModel, '| conf:', d.analysisConfidence, '| status:', d.status);
  for (const m of d.medicines || []) {
    console.log(`    • ${m.name} ${m.strength || ''} | ${m.frequency || ''} | ${m.duration || ''} | conf ${m.confidence}`);
  }
  if (an.status !== 200) { console.log('    body:', JSON.stringify(anBody).slice(0, 300)); }

  // ---- 2. Providers --------------------------------------------------------
  const pr = await fetch(`${BASE}/api/prescriptions/${PID}/providers`, { headers: auth });
  const prBody = await pr.json();
  console.log(`\n[2] PROVIDERS → HTTP ${pr.status}`);
  for (const p of prBody.providers || []) console.log(`    • ${p.id} — ${p.label} (${p.model})`);

  // ---- 3+4. Re-analyze with each independent provider (NO image sent) ------
  const results = { primary: d };
  for (const provider of ['paddleocr', 'huggingface', 'gemini', 'gpt5']) {
    t0 = Date.now();
    const re = await fetch(`${BASE}/api/prescriptions/${PID}/reanalyze`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ provider }), // no image → server re-reads stored original
    });
    const reBody = await re.json();
    const b = reBody.data || reBody;
    console.log(`\n[3] REANALYZE ${provider} → HTTP ${re.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (re.status !== 200) {
      console.log('    error:', b.error || JSON.stringify(b).slice(0, 200));
      continue;
    }
    const ra = b.reanalysis;
    console.log(`    provider: ${ra.provider} | model: ${ra.model} | conf: ${ra.overallConfidence}`);
    for (const m of ra.medicines || []) {
      console.log(`    • ${m.name} ${m.strength || ''} | ${m.frequency || ''} | ${m.duration || ''} | conf ${m.confidence}`);
    }
    const w = (ra.warnings || []).filter((x) => !/Medicine name could not be confidently read/i.test(x));
    for (const x of w.slice(0, 3)) console.log('    ⚠', x);
    if (b.comparison) {
      const s = b.comparison.summary;
      console.log(`    comparison: ${s.matched}/${s.totalFields} fields MATCH (${s.agreementPercent}%), ${s.disagreements} NEED VERIFICATION`);
      const dis = b.comparison.fields.filter((f) => f.status === 'needs_verification').slice(0, 8);
      for (const f of dis) console.log(`      ✗ ${f.label}: [${JSON.stringify(f.ai1)}] vs [${JSON.stringify(f.ai2)}]`);
    }
    results[provider] = ra;
  }

  console.log('\nDONE', PID);
}

main().catch((e) => { console.log('ERR', e.message); process.exit(1); });
