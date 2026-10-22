// ---------------------------------------------------------------------------
// Parallel OCR + AI + ML E2E proof — ONE real prescription image.
//   1. create → /analyze (primary Qwen3-VL, stores encrypted original)
//   2. POST /parallel-analysis { ocrProvider: paddleocr, aiProvider: huggingface }
//      → both pipelines start in parallel on the SAME stored image
//   3. verify: real OCR result, real AI result, field comparison, honest ML
//   4. GET /ml-status → honest RF status
// No mocks. Failures print as-is.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:41837';
const IMAGE = path.join(__dirname, '..', '..', 'public', 'rx-real.png');

async function main() {
  const png = fs.readFileSync(IMAGE);
  const t0 = Date.now();

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dealer@pharmachain.com', password: 'dealer123' }),
  });
  const token = login.headers.get('set-cookie')?.split(';', 1)[0];
  const loginData = await login.json();
  if (!token || loginData.token) throw new Error('login failed');
  const auth = { 'Content-Type': 'application/json', Cookie: token };

  const create = await fetch(BASE + '/api/prescriptions', {
    method: 'POST', headers: auth,
    body: JSON.stringify({ patientReference: 'PARALLEL-' + Date.now(), patientAge: 34, prescriptionDate: '2026-09-24' }),
  });
  const PID = (await create.json()).prescriptionId;
  console.log('created', PID);

  const an = await fetch(`${BASE}/api/prescriptions/${PID}/analyze`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ image: { data: png.toString('base64'), mimetype: 'image/png' } }),
  });
  const anBody = await an.json();
  const d = anBody.data || anBody.prescription || anBody;
  console.log(`[1] PRIMARY ANALYZE → HTTP ${an.status} | provider: ${d.analysisProvider} | meds: ${(d.medicines || []).length}`);

  // ---- 2. PARALLEL ANALYSIS ------------------------------------------------
  const t1 = Date.now();
  const pa = await fetch(`${BASE}/api/prescriptions/${PID}/parallel-analysis`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ ocrProvider: 'paddleocr', aiProvider: 'huggingface' }),
  });
  const body = await pa.json();
  const secs = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`\n[2] PARALLEL ANALYSIS → HTTP ${pa.status} in ${secs}s (primary took ${((t1 - t0) / 1000).toFixed(1)}s incl. login)`);

  if (pa.status !== 200) { console.log('body:', JSON.stringify(body).slice(0, 400)); return; }

  console.log(`    OCR: ${body.ocr.status} | provider: ${body.ocr.result?.providerLabel || body.ocr.provider} | meds: ${body.ocr.result?.medicines?.length ?? 0} | conf: ${body.ocr.result?.overallConfidence}`);
  console.log(`    AI:  ${body.ai.status} | provider: ${body.ai.result?.providerLabel || body.ai.provider} | model: ${body.ai.result?.model || body.ai.provider} | meds: ${body.ai.result?.medicines?.length ?? 0} | conf: ${body.ai.result?.overallConfidence}`);
  if (body.ocr.error) console.log('    OCR error:', body.ocr.error);
  if (body.ai.error) console.log('    AI error:', body.ai.error);

  console.log(`\n[3] ML: model=${body.ml?.model} | status=${body.mlStatus} | engine=${body.ml?.engine} | verdict=${body.ml?.verdict} | confidence=${body.ml?.confidence} (${body.ml?.confidenceSource})`);
  for (const dr of body.ml?.drivers || []) console.log('    driver:', dr);
  console.log('    features:', JSON.stringify(body.ml?.features));

  const s = body.comparison?.summary;
  console.log(`\n[4] COMPARISON: ${s?.matched}/${s?.totalFields} match (${s?.agreementPercent}%), ${s?.disagreements} needs verification`);
  for (const f of (body.comparison?.fields || []).filter((f) => f.status === 'needs_verification').slice(0, 6)) {
    console.log(`    ✗ ${f.label}: [${JSON.stringify(f.ai1)}] vs [${JSON.stringify(f.ai2)}]`);
  }

  // ---- 5. ml-status endpoint ----------------------------------------------
  const ms = await fetch(`${BASE}/api/prescriptions/${PID}/ml-status`, { headers: auth });
  const msBody = await ms.json();
  console.log(`\n[5] ML-STATUS → HTTP ${ms.status} | trained: ${msBody.trained} | dataset: ${msBody.datasetAvailable} | trees: ${msBody.treeCount}`);
  console.log('    note:', msBody.note.slice(0, 140) + '…');

  console.log('\nDONE', PID);
}

main().catch((e) => { console.log('ERR', e.message); process.exit(1); });
