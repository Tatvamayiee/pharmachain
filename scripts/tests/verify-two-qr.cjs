// E2E verification of the two-QR system: QR 1 (authentication) and
// QR 2 (transport tracking). Uses REAL records in MongoDB — creates its own
// medicine, batch, shipment, then walks the whole transport flow with role
// checks. Exit 0 = all pass, 1 = failures (listed).
const BASE = 'http://127.0.0.1:41837';
const stamp = Date.now().toString(36).toUpperCase();
let pass = 0; const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`ok    ${name}`); }
  else { failures.push(name); console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ''}`); }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Cookie: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json, cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  if (!r.cookie || r.json.token) throw new Error(`login did not establish a cookie session for ${email}`);
  return r.cookie;
}

(async () => {
  // ---------------------------------------------------------------- accounts
  const mfr = await login('manufacturer@pharmachain.com', 'manufacturer123');
  const dealer = await login('dealer@pharmachain.com', 'dealer123');
  const hospital = await login('hospital@pharmachain.com', 'hospital123');
  const admin = await login('admin@pharmachain.com', 'admin123');
  // Public registration is customer-only; use the seeded transport identity.
  const transporter = await login('transporter@pharmachain.com', 'transport123');
  ok('demo transporter account authenticated', Boolean(transporter));

  // ------------------------------------------------- QR 1: authentication QR
  const med = await req('POST', '/api/platform/medicines', {
    token: mfr, body: { name: `AuthQR Test ${stamp}`, genericName: 'test', category: 'Other', dosageForm: 'Tablet', strength: '500mg' },
  });
  const medicineId = med.json?.medicine?.id || med.json?.id;
  ok('medicine created (real DB)', Boolean(medicineId), JSON.stringify(med.json).slice(0, 120));

  const batch = await req('POST', '/api/platform/batches', {
    token: mfr,
    // Batch creation validates medicineName against the medicine master —
    // use a real master entry (the script's own catalog entry is for the
    // medicine-master CRUD check above).
    body: { medicineId, medicineName: 'Dolo 650 Tablet', batchNumber: `AQ-${stamp}`, quantityProduced: 500, manufacturingDate: '2026-01-15', expiryDate: '2028-01-15' },
  });
  const batchNumber = batch.json?.batch?.batchNumber || batch.json?.batchNumber;
  ok('batch created (real DB)', Boolean(batchNumber), JSON.stringify(batch.json).slice(0, 120));

  const payload = `https://pharmachain.app/verify/${batchNumber}`;
  const v1 = await req('GET', `/api/platform/verify/${encodeURIComponent(payload)}`, { token: dealer });
  const v1res = v1.json?.verification || v1.json;
  ok('QR1 scan: valid batch → AUTHENTIC', v1.status === 200 && v1res?.result === 'authentic', JSON.stringify(v1.json).slice(0, 140));

  const v1h = await req('GET', `/api/platform/verify/${encodeURIComponent(payload)}`, { token: hospital });
  const v1hres = v1h.json?.verification || v1h.json;
  ok('QR1 scan works for hospital too', v1h.status === 200 && v1hres?.result === 'authentic');

  const vBad = await req('GET', '/api/platform/verify/https://pharmachain.app/verify/NOPE-404', { token: dealer });
  ok('QR1 invalid code → not found', vBad.status === 404, `status ${vBad.status}`);

  // ------------------------------------------- QR 2: transport tracking flow
  const recv = await req('POST', '/api/shipments/dispatch', {
    token: mfr,
    body: { medicineName: 'Dolo 650 Tablet', batchNumber, quantity: 100, receiverOrg: 'Sahana Medicals', destination: 'Coimbatore', route: 'Chennai → Coimbatore' },
  });
  const shipCode = recv.json?.code || recv.json?.shipment?.code;
  ok('shipment created via dispatch', Boolean(shipCode), JSON.stringify(recv.json).slice(0, 140));

  const qr = await req('POST', '/api/transport/qr', { token: mfr, body: { shipmentCode: shipCode } });
  const qrId = qr.json?.transportQrId;
  ok('transport QR generated (TRQ-… token)', Boolean(qrId) && String(qrId).startsWith('TRQ-'), JSON.stringify(qr.json).slice(0, 140));
  ok('transport QR payload is /transport/ URL', String(qr.json?.payload || '').includes('/transport/'));

  const qr2 = await req('POST', '/api/transport/qr', { token: mfr, body: { shipmentCode: shipCode } });
  ok('transport QR idempotent (same token re-returned)', qr2.json?.transportQrId === qrId);

  // Public resolve (what a phone camera hits)
  const resPub = await req('GET', `/api/transport/resolve/${qrId}`);
  ok('public transport resolve works', resPub.status === 200 && resPub.json?.shipmentId === shipCode, JSON.stringify(resPub.json).slice(0, 140));
  ok('public payload carries no sensitive data', !JSON.stringify(resPub.json).includes('passwordHash') && !JSON.stringify(resPub.json).includes('receiverId:'));

  // RBAC: transporter updates location through the scan endpoint
  const up1 = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: qrId, location: 'Chennai Warehouse', status: 'PICKED_UP', note: 'Cold chain sealed' },
  });
  ok('transporter location update accepted', up1.status === 200 && up1.json?.event?.location === 'Chennai Warehouse', JSON.stringify(up1.json).slice(0, 140));
  ok('shipment mirror updated (currentLocation)', up1.json?.shipment?.currentLocation === 'Chennai Warehouse');

  const up2 = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: qrId, location: 'Coimbatore Distribution Center', status: 'IN_TRANSIT' },
  });
  ok('second hop appended', up2.status === 200 && up2.json?.event?.location === 'Coimbatore Distribution Center');

  // History: append-only, ordered
  const hist = await req('GET', `/api/transport/history/${qrId}`, { token: mfr });
  ok('history keeps full timeline (no overwrite)', hist.json?.timeline?.length === 2
    && hist.json.timeline[0].location === 'Chennai Warehouse'
    && hist.json.timeline[1].location === 'Coimbatore Distribution Center',
  JSON.stringify(hist.json?.timeline).slice(0, 200));
  ok('history records who/where/when', Boolean(hist.json?.timeline?.[0]?.updatedBy) && Boolean(hist.json?.timeline?.[0]?.timestamp));
  ok('fullAccess only for authorized roles', hist.json?.fullAccess === true);

  const histAnon = await req('GET', `/api/transport/history/${qrId}`);
  ok('anonymous history: public timeline, no actor identities', histAnon.status === 200
    && histAnon.json?.timeline?.length === 2
    && !('updatedBy' in (histAnon.json?.timeline?.[0] || {})));

  // RBAC: customer must NOT be able to update
  const cEmail = `cust-${stamp.toLowerCase()}@pharmachain.test`;
  await req('POST', '/api/auth/register', { body: { name: `Customer ${stamp}`, email: cEmail, password: 'Customer#2026', role: 'customer', organization: '' } });
  const customer = await login(cEmail, 'Customer#2026');
  const upCust = await req('POST', '/api/transport/scan', {
    token: customer, body: { transportQrId: qrId, location: 'Hacked Location' },
  });
  ok('customer location update REJECTED (403)', upCust.status === 403, `status ${upCust.status}`);

  // Unauthenticated update rejected
  const upAnon = await req('POST', '/api/transport/scan', { body: { transportQrId: qrId, location: 'Anon Land' } });
  ok('anonymous location update REJECTED (401)', upAnon.status === 401, `status ${upAnon.status}`);

  // Invalid QR handling
  const badResolve = await req('GET', '/api/transport/resolve/TRQ-DOES-NOT-EXIST');
  ok('unknown transport QR → 404', badResolve.status === 404);

  // Complete the journey: dealer confirms delivery at the pharmacy
  const up3 = await req('POST', '/api/transport/scan', {
    token: dealer, body: { transportQrId: qrId, location: 'Sahana Medicals Pharmacy', status: 'AT_PHARMACY' },
  });
  ok('dealer/pharmacy hand-off recorded', up3.status === 200 && up3.json?.event?.status === 'AT_PHARMACY');

  const up4 = await req('POST', '/api/transport/scan', {
    token: dealer, body: { transportQrId: qrId, location: 'Sahana Medicals Pharmacy', status: 'DELIVERED' },
  });
  ok('final status = DELIVERED', up4.status === 200 && up4.json?.shipment?.currentStatus === 'DELIVERED');

  const closed = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: qrId, location: 'Everywhere', status: 'IN_TRANSIT' },
  });
  ok('updates after DELIVERED rejected (409)', closed.status === 409, `status ${closed.status}`);

  const histFinal = await req('GET', `/api/transport/history/${qrId}`, { token: admin });
  ok('full journey preserved (4 events)', histFinal.json?.timeline?.length === 4
    && histFinal.json.timeline[3].status === 'DELIVERED',
  JSON.stringify(histFinal.json?.timeline?.map((t) => t.location)).slice(0, 200));

  // Separation of the two QRs
  ok('QR ids do not collide across systems', qrId.startsWith('TRQ-') && !payload.includes(qrId));

  console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? `: ${failures.join(' | ')}` : ''}`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message); process.exit(1); });
