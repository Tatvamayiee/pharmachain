// Backend verification matrix — run with the server up:
//   npm run dev:server                 (terminal 1)
//   node scripts/verify-backend.mjs    (terminal 2)
// Exercises auth, organization isolation, role guards, status transitions,
// safety rules (critical-alert blocking, checklist gating), pagination and
// audit events against the running backend (in-memory mode is fine).
const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:41837';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.data.token;
}

const FULL_CHECKLIST = {
  originalReviewed: true, namesVerified: true, strengthsVerified: true,
  dosagesReviewed: true, frequencyReviewed: true, durationReviewed: true,
  allergiesReviewed: true, interactionsReviewed: true, dosageAlertsReviewed: true,
  decisionConfirmed: true,
};

async function main() {
  console.log(`Verifying backend at ${BASE}\n`);

  // --- Auth & health -------------------------------------------------------
  const health = await req('GET', '/api/health');
  check('health endpoint reports mode', health.status === 200 && !!health.data.dbMode, JSON.stringify(health.data));

  const dealer = await login('dealer@pharmachain.com', 'dealer123');
  const hospital = await login('hospital@pharmachain.com', 'hospital123');
  const manufacturer = await login('manufacturer@pharmachain.com', 'manufacturer123');
  const customer = await login('customer@pharmachain.com', 'customer123');
  check('demo logins return JWTs', !!dealer && !!hospital && !!manufacturer && !!customer);

  const bad = await req('POST', '/api/auth/login', { body: { email: 'dealer@pharmachain.com', password: 'nope' } });
  check('wrong password rejected (401)', bad.status === 401);

  // --- Role guards ---------------------------------------------------------
  for (const [who, token] of [['manufacturer', manufacturer], ['customer', customer]]) {
    const r = await req('GET', '/api/prescriptions', { token });
    check(`${who} blocked from prescription routes (403)`, r.status === 403, `got ${r.status}`);
  }
  const anon = await req('GET', '/api/prescriptions');
  check('anonymous blocked (401)', anon.status === 401, `got ${anon.status}`);

  // --- Organization isolation ----------------------------------------------
  const rx = (over = {}) => ({
    patientReference: `PAT-${Math.random().toString(36).slice(2, 8)}`,
    patientAge: 34,
    prescriptionDate: '2026-09-23',
    ...over,
  });

  const d1 = await req('POST', '/api/prescriptions', { token: dealer, body: rx() });
  check('dealer can create prescription (201)', d1.status === 201, JSON.stringify(d1.data).slice(0, 120));
  const h1 = await req('POST', '/api/prescriptions', { token: hospital, body: rx({ department: 'General Medicine' }) });
  check('hospital can create prescription (201)', h1.status === 201);

  const d1id = d1.data.prescriptionId;
  const h1id = h1.data.prescriptionId;

  const crossGet = await req('GET', `/api/prescriptions/${h1id}`, { token: dealer });
  check('dealer cannot read another org\'s prescription (403)', crossGet.status === 403, `got ${crossGet.status}`);
  const crossPatch = await req('PATCH', `/api/prescriptions/${h1id}`, { token: dealer, body: { patientAge: 50 } });
  check('dealer cannot modify another org\'s prescription (403)', crossPatch.status === 403, `got ${crossPatch.status}`);

  const ownGet = await req('GET', `/api/prescriptions/${d1id}`, { token: dealer });
  check('dealer reads own prescription (200)', ownGet.status === 200);
  const hOwnGet = await req('GET', `/api/prescriptions/${h1id}`, { token: hospital });
  check('hospital reads own prescription (200)', hOwnGet.status === 200);

  // --- Transitions & safety rules ------------------------------------------
  // Advance the dealer record to analyzed via PATCH (mock-analysis stand-in).
  const toAnalyzed = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { status: 'processing' } });
  check('PATCH uploaded → processing (200)', toAnalyzed.status === 200, JSON.stringify(toAnalyzed.data).slice(0, 120));
  const toAnalyzed2 = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { status: 'analyzed' } });
  check('PATCH processing → analyzed (200)', toAnalyzed2.status === 200);

  const badTransition = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { status: 'approved' } });
  check('invalid transition analyzed → approved rejected (400)', badTransition.status === 400, `got ${badTransition.status}`);

  const approveNoChecklist = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approve blocked without checklist (400)', approveNoChecklist.status === 400);

  const review = await req('POST', `/api/prescriptions/${d1id}/review`, { token: dealer, body: { checklist: FULL_CHECKLIST, notes: 'matrix review' } });
  check('review submission accepted (200)', review.status === 200, JSON.stringify(review.data).slice(0, 120));
  const approveFromAnalyzed = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approve from analyzed blocked — must pass safety review (400)', approveFromAnalyzed.status === 400, `got ${approveFromAnalyzed.status}`);

  const toSafety = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { status: 'safety_review_required' } });
  check('PATCH analyzed → safety_review_required (200)', toSafety.status === 200);

  const critical = {
    severity: 'critical', status: 'unreviewed', medicines: ['Warfarin', 'Aspirin'],
    reason: 'demo bleeding risk', concern: 'demo', action: 'pharmacist review',
  };
  const withCritical = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { interactionAlerts: [critical] } });
  check('critical alert attached (200)', withCritical.status === 200);

  const approveCritical = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approval blocked while critical alert unresolved (400)', approveCritical.status === 400);

  const resolved = await req('PATCH', `/api/prescriptions/${d1id}`, {
    token: dealer, body: { interactionAlerts: [{ ...critical, status: 'acknowledged', resolved: true }] },
  });
  check('critical alert resolved (200)', resolved.status === 200);

  const approve2 = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approval succeeds after checklist + resolved alerts (200)', approve2.status === 200, JSON.stringify(approve2.data).slice(0, 120));

  const dispense = await req('POST', `/api/prescriptions/${d1id}/dispense`, { token: dealer });
  check('dispense after approval (200)', dispense.status === 200);
  const dispenseAgain = await req('POST', `/api/prescriptions/${d1id}/dispense`, { token: dealer });
  check('dispense twice blocked (400)', dispenseAgain.status === 400);
  const rejectDispensed = await req('POST', `/api/prescriptions/${d1id}/reject`, { token: dealer, body: { reason: 'late' } });
  check('reject dispensed blocked (400)', rejectDispensed.status === 400);

  // Hospital record: rejection + clarification require reasons/messages.
  const rejectNoReason = await req('POST', `/api/prescriptions/${h1id}/reject`, { token: hospital, body: {} });
  check('reject without reason rejected (422)', rejectNoReason.status === 422, `got ${rejectNoReason.status}`);
  const toSafetyH = await req('PATCH', `/api/prescriptions/${h1id}`, { token: hospital, body: { status: 'processing' } });
  const toSafetyH2 = await req('PATCH', `/api/prescriptions/${h1id}`, { token: hospital, body: { status: 'analyzed' } });
  const toSafetyH3 = await req('PATCH', `/api/prescriptions/${h1id}`, { token: hospital, body: { status: 'safety_review_required' } });
  check('hospital record advanced to safety review', toSafetyH3.status === 200);
  const rejectH = await req('POST', `/api/prescriptions/${h1id}/reject`, { token: hospital, body: { reason: 'Dosage concern' } });
  check('reject with reason succeeds (200)', rejectH.status === 200);

  const h2 = await req('POST', '/api/prescriptions', { token: hospital, body: rx({ department: 'ICU' }) });
  const h2id = h2.data.prescriptionId;
  await req('PATCH', `/api/prescriptions/${h2id}`, { token: hospital, body: { status: 'processing' } });
  await req('PATCH', `/api/prescriptions/${h2id}`, { token: hospital, body: { status: 'analyzed' } });
  await req('PATCH', `/api/prescriptions/${h2id}`, { token: hospital, body: { status: 'safety_review_required' } });
  const clarifyNoMsg = await req('POST', `/api/prescriptions/${h2id}/clarification`, { token: hospital, body: { recipientType: 'prescriber' } });
  check('clarification without message rejected (422)', clarifyNoMsg.status === 422, `got ${clarifyNoMsg.status}`);
  const clarify = await req('POST', `/api/prescriptions/${h2id}/clarification`, { token: hospital, body: { recipientType: 'prescriber', message: 'Confirm dose frequency' } });
  check('clarification with message succeeds (200)', clarify.status === 200);

  // --- Listing, filters, pagination, audit ---------------------------------
  const listDealer = await req('GET', '/api/prescriptions?limit=1&page=1', { token: dealer });
  check('dealer list paginated + org-scoped', listDealer.status === 200 && listDealer.data.items.length <= 1
    && listDealer.data.items.every((i) => i.organizationId === 'Sahana Medicals'), JSON.stringify(listDealer.data).slice(0, 140));

  const listByStatus = await req('GET', '/api/prescriptions?status=clarification_requested', { token: hospital });
  check('status filter works', listByStatus.status === 200 && listByStatus.data.items.every((i) => i.status === 'clarification_requested'));

  const audit = await req('GET', `/api/prescriptions/${d1id}/audit`, { token: dealer });
  check('audit events recorded', audit.status === 200 && audit.data.length >= 6, `got ${audit.status}, n=${Array.isArray(audit.data) ? audit.data.length : '?'}`);
  const auditTypes = Array.isArray(audit.data) ? audit.data.map((e) => e.eventType) : [];
  check('audit includes approval + dispense', auditTypes.includes('APPROVED') && auditTypes.includes('DISPENSED'), auditTypes.join(','));

  const missing = await req('GET', '/api/prescriptions/PRX-does-not-exist', { token: dealer });
  check('missing record returns 404', missing.status === 404);

  const crossAudit = await req('GET', `/api/prescriptions/${h1id}/audit`, { token: dealer });
  check('cross-org audit blocked (403)', crossAudit.status === 403);

  console.log(`\n${passed} passed, ${failed} failed${failures.length ? `: ${failures.join(' | ')}` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Matrix crashed:', err);
  process.exit(1);
});
