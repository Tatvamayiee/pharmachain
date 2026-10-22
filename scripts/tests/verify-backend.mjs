// Backend verification matrix — run with the server up:
//   npm run dev:server                 (terminal 1)
//   node scripts/tests/verify-backend.mjs    (terminal 2)
// Exercises auth, organization isolation, role guards, status transitions,
// safety rules (critical-alert blocking, checklist gating), pagination and
// audit events against the running backend (in-memory mode is fine).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env') });
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
      ...(token ? { Cookie: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  if (r.data?.token) throw new Error(`login exposed a bearer token for ${email}`);
  const cookie = r.setCookie?.split(';', 1)[0];
  if (!cookie) throw new Error(`login did not set a session cookie for ${email}`);
  return cookie;
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
  const distributor = await login('distributor@pharmachain.com', 'distributor123');
  const customer = await login('customer@pharmachain.com', 'customer123');
  check('demo logins set session cookies without exposing JWTs', !!dealer && !!hospital && !!manufacturer && !!distributor && !!customer);

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
  const toProcessing = await req('POST', `/api/prescriptions/${d1id}/status`, { token: dealer, body: { status: 'processing' } });
  check('status endpoint uploaded → processing (200)', toProcessing.status === 200, JSON.stringify(toProcessing.data).slice(0, 120));
  const toAnalyzed2 = await req('POST', `/api/prescriptions/${d1id}/status`, { token: dealer, body: { status: 'analyzed' } });
  check('status endpoint processing → analyzed (200)', toAnalyzed2.status === 200);

  const badTransition = await req('PATCH', `/api/prescriptions/${d1id}`, { token: dealer, body: { status: 'approved' } });
  check('invalid transition analyzed → approved rejected (400)', badTransition.status === 400, `got ${badTransition.status}`);

  const approveNoChecklist = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approve blocked without checklist (400)', approveNoChecklist.status === 400);

  const review = await req('POST', `/api/prescriptions/${d1id}/review`, { token: dealer, body: { checklist: FULL_CHECKLIST, notes: 'matrix review' } });
  check('review submission accepted (200)', review.status === 200, JSON.stringify(review.data).slice(0, 120));
  const approveFromAnalyzed = await req('POST', `/api/prescriptions/${d1id}/approve`, { token: dealer });
  check('approve from analyzed blocked — must pass safety review (400)', approveFromAnalyzed.status === 400, `got ${approveFromAnalyzed.status}`);

  const toSafety = await req('POST', `/api/prescriptions/${d1id}/status`, { token: dealer, body: { status: 'safety_review_required' } });
  check('status endpoint analyzed → safety_review_required (200)', toSafety.status === 200);

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
  const toSafetyH = await req('POST', `/api/prescriptions/${h1id}/status`, { token: hospital, body: { status: 'processing' } });
  const toSafetyH2 = await req('POST', `/api/prescriptions/${h1id}/status`, { token: hospital, body: { status: 'analyzed' } });
  const toSafetyH3 = await req('POST', `/api/prescriptions/${h1id}/status`, { token: hospital, body: { status: 'safety_review_required' } });
  check('hospital record advanced to safety review', toSafetyH3.status === 200);
  const rejectH = await req('POST', `/api/prescriptions/${h1id}/reject`, { token: hospital, body: { reason: 'Dosage concern' } });
  check('reject with reason succeeds (200)', rejectH.status === 200);

  const h2 = await req('POST', '/api/prescriptions', { token: hospital, body: rx({ department: 'ICU' }) });
  const h2id = h2.data.prescriptionId;
  await req('POST', `/api/prescriptions/${h2id}/status`, { token: hospital, body: { status: 'processing' } });
  await req('POST', `/api/prescriptions/${h2id}/status`, { token: hospital, body: { status: 'analyzed' } });
  await req('POST', `/api/prescriptions/${h2id}/status`, { token: hospital, body: { status: 'safety_review_required' } });
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

  // --- Shipment tenant authorization + transport assignment ----------------
  const createdBatch = await req('POST', '/api/platform/batches', {
    token: manufacturer,
    body: {
      medicineName: 'Paracetamol',
      strength: '500mg',
      batchNumber: `SEC-${Date.now()}`,
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
      quantityProduced: 20,
    },
  });
  check('manufacturer can create a test batch for shipment checks', createdBatch.status === 201, `got ${createdBatch.status}`);
  if (createdBatch.status === 201) {
    const batch = createdBatch.data.batch;
    if (batch.status !== 'released') {
      await req('PATCH', `/api/platform/batches/${batch.id}/status`, {
        token: manufacturer, body: { status: 'released' },
      });
    }
    const dispatch = await req('POST', '/api/shipments/dispatch', {
      token: manufacturer,
      body: {
        medicineName: batch.medicineName,
        batchNumber: batch.batchNumber,
        quantity: 5,
        receiverOrg: 'Sahana Medicals',
        destination: 'Coimbatore',
        route: 'Chennai → Coimbatore',
        trackingNumber: `SEC-TRK-${Date.now()}`,
      },
    });
    check('manufacturer dispatch reserves an owned batch to a verified receiver', dispatch.status === 201, `got ${dispatch.status}`);
    if (dispatch.status === 201) {
      const shipment = dispatch.data;
      const dealerShipments = await req('GET', '/api/shipments', { token: dealer });
      const hospitalShipments = await req('GET', '/api/shipments', { token: hospital });
      check('recipient sees its shipment', dealerShipments.status === 200
        && dealerShipments.data.some((item) => item.code === shipment.code));
      check('unrelated organization cannot see shipment', hospitalShipments.status === 200
        && hospitalShipments.data.every((item) => item.code !== shipment.code));

      const wrongCancel = await req('POST', `/api/shipments/${shipment.code}/cancel`, { token: dealer });
      check('recipient cannot cancel manufacturer shipment', wrongCancel.status === 403);

      const qr = await req('POST', '/api/transport/qr', {
        token: manufacturer, body: { shipmentCode: shipment.code },
      });
      check('shipment owner can generate transport QR', qr.status === 200, `got ${qr.status}`);
      if (qr.status === 200 && qr.data?.transportQrId && customer) {
        const customerToken = customer.replace(/^pc_session=/, '');
        const customerId = jwt.decode(customerToken)?.id;
        const forgedAdminToken = jwt.sign({
          id: customerId,
          role: 'admin',
          organization: 'Untrusted Organization',
        }, process.env.JWT_SECRET || 'dev-secret-change-me', { expiresIn: '1h', algorithm: 'HS256' });
        const history = await req('GET', `/api/transport/history/${encodeURIComponent(qr.data.transportQrId)}`, {
          token: forgedAdminToken,
        });
        check('public transport history ignores stale JWT role and organization claims',
          history.status === 200 && history.data.fullAccess === false
            && history.data.timeline.every((event) => !Object.prototype.hasOwnProperty.call(event, 'updatedBy')),
          `got ${history.status}, fullAccess=${history.data?.fullAccess}`);
      }
      const assignment = await req('POST', '/api/transport/assign', {
        token: manufacturer, body: { shipmentCode: shipment.code, transporterId: 'demo-transport' },
      });
      check('shipment owner can assign an active transporter', assignment.status === 200, `got ${assignment.status}`);
      const transport = await login('transporter@pharmachain.com', 'transport123');
      const qrId = qr.data?.transportQrId;
      const foreignScan = await req('POST', '/api/transport/scan', {
        token: distributor, body: { transportQrId: qrId, location: 'Test location' },
      });
      check('unrelated distributor cannot scan shipment', foreignScan.status === 403);
      let scan = await req('POST', '/api/transport/scan', {
        token: transport, body: { transportQrId: qrId, location: 'Checkpoint 1' },
      });
      check('assigned transporter can update shipment checkpoint', scan.status === 200, `got ${scan.status}`);
      const skipped = await req('POST', '/api/transport/scan', {
        token: transport, body: { transportQrId: qrId, location: 'Checkpoint 2', status: 'DELIVERED' },
      });
      check('transporter cannot skip shipment checkpoints', skipped.status === 409, `got ${skipped.status}`);

      for (const status of ['IN_TRANSIT', 'AT_DISTRIBUTION_CENTER', 'OUT_FOR_DELIVERY', 'AT_PHARMACY']) {
        scan = await req('POST', '/api/transport/scan', {
          token: transport,
          body: { transportQrId: qrId, location: status, status },
        });
      }
      const delivered = await req('POST', '/api/transport/scan', {
        token: dealer,
        body: { transportQrId: qrId, location: 'Sahana Medicals', status: 'DELIVERED' },
      });
      check('verified receiver can confirm delivery after checkpoints', delivered.status === 200, `got ${delivered.status}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed${failures.length ? `: ${failures.join(' | ')}` : ''}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Matrix crashed:', err);
  process.exit(1);
});
