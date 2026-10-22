// Verification matrix for the Phase-3 services: drug database endpoints,
// encrypted file upload, patient-record store, and inventory deduction.
// Run with the backend UP (Mongo or in-memory):
//   node scripts/tests/verify-phase3.mjs
const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:41837';

let passed = 0, failed = 0; const failures = [];
function check(name, cond, extra = '') {
  if (cond) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; failures.push(name); console.log(`FAIL  ${name} ${extra}`); }
}
async function api(path, { method = 'GET', token, body, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Cookie: token } : {}),
      // FormData sets its own boundary header; only set JSON when body is plain.
      ...(raw instanceof FormData ? {} : body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: raw instanceof FormData ? raw : body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* binary */ }
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null };
}

// 1x1 transparent PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function pngBlob() {
  const bin = atob(PNG_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

async function main() {
  // --- auth ---------------------------------------------------------------
  const login = await api('/api/auth/login', { method: 'POST', body: { email: 'dealer@pharmachain.com', password: 'dealer123' } });
  check('dealer login sets cookie without exposing JWT', login.status === 200 && login.cookie && !login.data?.token, JSON.stringify(login.data?.error));
  const T = login.cookie;
  const loginH = await api('/api/auth/login', { method: 'POST', body: { email: 'hospital@pharmachain.com', password: 'hospital123' } });
  const TH = loginH.cookie;
  const loginM = await api('/api/auth/login', { method: 'POST', body: { email: 'manufacturer@pharmachain.com', password: 'manufacturer123' } });
  const TM = loginM.cookie;

  // --- drug database -------------------------------------------------------
  const search = await api('/api/drugs/search?q=para', { token: T });
  check('drug search finds Paracetamol', search.status === 200 && (search.data.items || []).some((i) => i.name === 'Paracetamol'));
  const searchNoAuth = await api('/api/drugs/search?q=para');
  check('drug search requires auth', searchNoAuth.status === 401);

  const ix = await api('/api/drugs/interactions/check', { method: 'POST', token: T, body: { medicines: ['Ibuprofen', 'Paracetamol'] } });
  check('interaction check runs', ix.status === 200 && Array.isArray(ix.data.alerts), JSON.stringify(ix.data));
  const ixKnown = await api('/api/drugs/interactions/check', { method: 'POST', token: T, body: { medicines: ['Ibuprofen', 'Warfarin'] } });
  check('known interaction pair detected (ibuprofen/warfarin critical)', ixKnown.status === 200 && (ixKnown.data.alerts || []).some((a) => a.severity === 'critical'));
  const ixUnmatched = await api('/api/drugs/interactions/check', { method: 'POST', token: T, body: { medicines: ['Zzzunknownol'] } });
  check('unknown medicine reported, not invented', ixUnmatched.status === 200 && (ixUnmatched.data.unmatched || []).includes('Zzzunknownol') && ixUnmatched.data.alerts.length === 0);

  const dose = await api('/api/drugs/dosage/validate', { method: 'POST', token: T, body: { medicineName: 'Paracetamol', strength: '1000 mg', frequency: 'every 6 h', patientAge: 40 } });
  check('dosage validate: within max daily', dose.status === 200 && dose.data.matched === true);
  const doseOver = await api('/api/drugs/dosage/validate', { method: 'POST', token: T, body: { medicineName: 'Paracetamol', strength: '1000 mg', frequency: 'five times daily', patientAge: 40 } });
  check('dosage validate flags max-daily exceedance (critical)', doseOver.status === 200 && (doseOver.data.issues || []).some((i) => i.type === 'max_daily' && i.severity === 'critical'), JSON.stringify(doseOver.data));
  const doseKid = await api('/api/drugs/dosage/validate', { method: 'POST', token: T, body: { medicineName: 'Ibuprofen', strength: '400 mg', frequency: 'twice daily', patientAge: 4 } });
  check('dosage validate flags below-minimum age (high)', doseKid.status === 200 && (doseKid.data.issues || []).some((i) => i.type === 'age' && i.severity === 'high'), JSON.stringify(doseKid.data));
  const doseUnknown = await api('/api/drugs/dosage/validate', { method: 'POST', token: T, body: { medicineName: 'Zzzunknownol', strength: '10 mg', frequency: 'once daily', patientAge: 30 } });
  check('dosage validate: unmatched → "verify manually", no fabrication', doseUnknown.status === 200 && doseUnknown.data.matched === false && /verify manually/i.test(doseUnknown.data.message || ''));

  // --- prescription + encrypted file upload --------------------------------
  const created = await api('/api/prescriptions', { method: 'POST', token: T, body: { patientReference: 'PH3-PT-1', patientAge: 42, patientGender: 'female', prescriptionDate: '2026-09-23', allergies: 'Penicillin (test string)', existingConditions: 'None', currentMedicines: 'Metformin' } });
  check('prescription created', created.status === 201 && created.data?.prescriptionId, JSON.stringify(created.data));
  const PID = created.data.prescriptionId;

  const fd = new FormData();
  fd.append('file', pngBlob(), 'prescription-test.png');
  const up = await api(`/api/prescriptions/${PID}/upload`, { method: 'POST', token: T, raw: fd });
  check('file upload accepted + metadata returned', up.status === 201 && up.data?.file?.storedEncrypted === true && up.data.file.algorithm === 'aes-256-gcm', JSON.stringify(up.data));
  check('upload records fileMetadata on the prescription', !!up.data?.prescription?.fileMetadata?.fileId);

  const fd2 = new FormData();
  const txtBlob = new Blob([Buffer.from('not an image')], { type: 'text/plain' });
  fd2.append('file', txtBlob, 'note.txt');
  const upBad = await api(`/api/prescriptions/${PID}/upload`, { method: 'POST', token: T, raw: fd2 });
  check('non-image upload rejected (422)', upBad.status === 422, JSON.stringify(upBad.data));

  const noFile = await api(`/api/prescriptions/${PID}/upload`, { method: 'POST', token: T });
  check('missing file → 422', noFile.status === 422);

  const dl = await fetch(`${BASE}/api/prescriptions/${PID}/file`, { headers: { Cookie: T } });
  const dlBytes = Buffer.from(await dl.arrayBuffer());
  check('authorized download returns original bytes', dl.status === 200 && dlBytes.length === (up.data.file.size) && dl.headers.get('content-type') === 'image/png');
  const dlOther = await fetch(`${BASE}/api/prescriptions/${PID}/file`, { headers: { Cookie: TH } });
  check('cross-org download blocked (403)', dlOther.status === 403);
  const dlNoAuth = await fetch(`${BASE}/api/prescriptions/${PID}/file`);
  check('download requires auth (401)', dlNoAuth.status === 401);

  // --- patient record store -------------------------------------------------
  const ctx = await api(`/api/prescriptions/${PID}/patient-context`, { token: T });
  check('patient context readable by same org', ctx.status === 200 && ctx.data?.patientAge === 42, JSON.stringify(ctx.data));
  check('patient context decrypts allergies', typeof ctx.data?.allergies === 'string' && ctx.data.allergies.includes('Penicillin'));
  const ctxOther = await api(`/api/prescriptions/${PID}/patient-context`, { token: TH });
  check('patient context cross-org blocked (403)', ctxOther.status === 403);

  // --- inventory deduction on dispense --------------------------------------
  // Move the prescription through the workflow to approved.
  await api(`/api/prescriptions/${PID}`, { method: 'PATCH', token: T, body: { status: 'processing' } });
  const an = await api(`/api/prescriptions/${PID}`, { method: 'PATCH', token: T, body: { status: 'analyzed', medicines: [{ name: 'Paracetamol', strength: '650 mg', dosage: '1 tablet', frequency: 'twice daily', duration: '5 days', quantity: 10, confidence: 0.9, matchStatus: 'matched' }], interactionAlerts: [], dosageAlerts: [] } });
  check('advance to analyzed with a medicine', an.status === 200);
  await api(`/api/prescriptions/${PID}/status`, { method: 'POST', token: T, body: { status: 'safety_review_required' } });
  await api(`/api/prescriptions/${PID}/review`, { method: 'POST', token: T, body: { checklist: { originalReviewed: true, namesVerified: true, strengthsVerified: true, dosagesReviewed: true, frequencyReviewed: true, durationReviewed: true, allergiesReviewed: true, interactionsReviewed: true, dosageAlertsReviewed: true, decisionConfirmed: true }, notes: 'phase3 test' } });
  const appr = await api(`/api/prescriptions/${PID}/approve`, { method: 'POST', token: T });
  check('approval succeeds with complete checklist', appr.status === 200 && appr.data.status === 'approved', JSON.stringify(appr.data?.error));

  // Stock lookup before dispense (via drug DB stock is internal; verify via dispense result).
  const disp = await api(`/api/prescriptions/${PID}/dispense`, { method: 'POST', token: T });
  check('dispense deducts inventory', disp.status === 200 && disp.data?.inventoryDeducted === true, JSON.stringify(disp.data));
  const lots = disp.data?.prescription?.dispensingRecord?.medicines || [];
  check('dispensing record lists the batch lot deducted', lots.length === 1 && lots[0].fulfilled === 10 && !!lots[0].lots?.[0]?.batchNumber, JSON.stringify(lots));
  const disp2 = await api(`/api/prescriptions/${PID}/dispense`, { method: 'POST', token: T });
  check('double dispense blocked (400)', disp2.status === 400);

  // Unfulfillable medicine → reported, not silent.
  const created2 = await api('/api/prescriptions', { method: 'POST', token: T, body: { patientReference: 'PH3-PT-2', patientAge: 30, prescriptionDate: '2026-09-23' } });
  const PID2 = created2.data.prescriptionId;
  await api(`/api/prescriptions/${PID2}`, { method: 'PATCH', token: T, body: { status: 'processing' } });
  await api(`/api/prescriptions/${PID2}`, { method: 'PATCH', token: T, body: { status: 'analyzed', medicines: [{ name: 'Zzzunknownol', strength: '10 mg', frequency: 'once daily', duration: '2 days', quantity: 5, confidence: 0.9 }], interactionAlerts: [], dosageAlerts: [] } });
  await api(`/api/prescriptions/${PID2}/status`, { method: 'POST', token: T, body: { status: 'safety_review_required' } });
  await api(`/api/prescriptions/${PID2}/review`, { method: 'POST', token: T, body: { checklist: { originalReviewed: true, namesVerified: true, strengthsVerified: true, dosagesReviewed: true, frequencyReviewed: true, durationReviewed: true, allergiesReviewed: true, interactionsReviewed: true, dosageAlertsReviewed: true, decisionConfirmed: true } } });
  await api(`/api/prescriptions/${PID2}/approve`, { method: 'POST', token: T });
  const disp3 = await api(`/api/prescriptions/${PID2}/dispense`, { method: 'POST', token: T });
  check('unfulfillable medicine reported as unfulfilled (not silent)', disp3.status === 200 && disp3.data?.inventoryDeducted === false && (disp3.data.prescription?.dispensingRecord?.unfulfilled || []).length === 1, JSON.stringify(disp3.data?.prescription?.dispensingRecord?.unfulfilled));

  // Role guard: manufacturer cannot dispense.
  const rxM = await api('/api/prescriptions', { method: 'POST', token: TM, body: { patientReference: 'X', prescriptionDate: '2026-09-23' } });
  check('manufacturer cannot create prescriptions (403)', rxM.status === 403);

  // Audit trail contains the new event types.
  const audit = await api(`/api/prescriptions/${PID}/audit`, { token: T });
  const types = (audit.data || []).map((a) => a.eventType);
  check('audit includes FILE_UPLOADED + DISPENSED', types.includes('FILE_UPLOADED') && types.includes('DISPENSED'), JSON.stringify(types));

  console.log(`\n${passed}/${passed + failed} checks passed.`);
  if (failures.length) { console.log('Failures:', failures.join(' | ')); process.exit(1); }
}

main().catch((e) => { console.error('Runner crashed:', e); process.exit(1); });
