// Focused gate for the transporter demo identity (QR 2). Exercises the REAL
// APIs end to end: demo transporter login → shipment dispatch by the
// manufacturer → transport-QR generation → transporter scan/updates through
// the full status ladder → append-only TransportEvent history → server-side
// RBAC rejections. Own stamped data only; safe to re-run. Exit 0 = all pass.
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
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.json.token;
}

(async () => {
  // ------------------------------------------------- demo transporter identity
  const transporter = await login('transporter@pharmachain.com', 'transport123');
  ok('demo transporter login (JWT)', Boolean(transporter));

  const me = await req('GET', '/api/auth/me', { token: transporter });
  ok('demo transporter role is "transport"', me.json?.user?.role === 'transport', JSON.stringify(me.json?.user || {}));
  ok('demo transporter org is FleetGo Logistics', me.json?.user?.organization === 'FleetGo Logistics');

  const mfr = await login('manufacturer@pharmachain.com', 'manufacturer123');
  const customer = await login('customer@pharmachain.com', 'customer123');

  // --------------------------------- real shipment + transport QR (real APIs)
  const batchNumber = `TGT-${stamp}`;
  const disp = await req('POST', '/api/shipments/dispatch', {
    token: mfr,
    body: {
      medicineName: `TGT Medicine ${stamp}`, batchNumber, quantity: 25,
      receiverOrg: 'Sahana Medicals', destination: 'Sahana Medicals Pharmacy, Chennai', route: 'Tiruppur -> Chennai',
    },
  });
  const shipmentCode = disp.json?.code;
  ok('manufacturer dispatches a real shipment', Boolean(shipmentCode), JSON.stringify(disp.json).slice(0, 120));

  const gen = await req('POST', '/api/transport/qr', { token: mfr, body: { shipmentCode } });
  const qrId = gen.json?.transportQrId;
  ok('transport QR generated (opaque TRQ id)', /^TRQ-/.test(qrId || ''), JSON.stringify(gen.json).slice(0, 120));

  const resolve = await req('GET', `/api/transport/resolve/${qrId}`);
  ok('public resolve shows shipment + PREPARED', resolve.json?.shipmentId === shipmentCode && resolve.json?.currentStatus === 'PREPARED', JSON.stringify(resolve.json).slice(0, 120));

  // ------------------------------------- transporter drives the status ladder
  const ladder = [
    { status: 'PICKED_UP', location: `Chennai Warehouse ${stamp}` },
    { status: 'IN_TRANSIT', location: 'Erode' },
    { status: 'AT_DISTRIBUTION_CENTER', location: 'Coimbatore Distribution Center' },
    { status: 'OUT_FOR_DELIVERY', location: 'Chennai hub' },
    { status: 'AT_PHARMACY', location: 'Sahana Medicals Pharmacy' },
    { status: 'DELIVERED', location: 'Sahana Medicals Pharmacy' },
  ];
  for (const step of ladder) {
    const up = await req('POST', '/api/transport/scan', {
      token: transporter,
      body: { transportQrId: qrId, location: step.location, status: step.status, note: `TGT gate ${stamp}` },
    });
    ok(`transporter update ${step.status}`, up.status === 200 && up.json?.event?.status === step.status,
      `status ${up.status} ${JSON.stringify(up.json).slice(0, 120)}`);
  }

  const after = await req('GET', `/api/transport/history/${qrId}`, { token: transporter });
  const timeline = after.json?.timeline || [];
  ok('append-only history keeps all events in order', timeline.length === ladder.length
    && timeline.every((e, i) => e.status === ladder[i].status), `got ${timeline.length} events`);
  ok('events record who + organization + role', timeline.every((e) => e.updatedBy && e.organization === 'FleetGo Logistics' && e.role === 'transport'));
  ok('delivered summary flag set', after.json?.shipment?.delivered === true);

  const closed = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: qrId, location: 'nowhere', status: 'IN_TRANSIT' },
  });
  ok('post-delivery update rejected (409)', closed.status === 409, `status ${closed.status}`);

  const back = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: qrId, location: 'anywhere', status: 'PICKED_UP' },
  });
  ok('backwards transition rejected (409)', back.status === 409, `status ${back.status}`);

  // ------------------------------------------------------ transporter RBAC
  const med = await req('POST', '/api/platform/medicines', { token: transporter, body: { name: `Nope ${stamp}` } });
  ok('transporter cannot create medicines (403)', med.status === 403, `status ${med.status}`);

  const users = await req('GET', '/api/platform/users', { token: transporter });
  ok('transporter cannot list admin users (403)', users.status === 403, `status ${users.status}`);

  const scripts = await req('GET', '/api/prescriptions', { token: transporter });
  ok('transporter cannot list prescriptions (403)', scripts.status === 403, `status ${scripts.status}`);

  const custUp = await req('POST', '/api/transport/scan', {
    token: customer, body: { transportQrId: qrId, location: 'x' },
  });
  ok('customer cannot update transport (403)', custUp.status === 403, `status ${custUp.status}`);

  const qr1Token = await req('POST', '/api/transport/scan', {
    token: transporter, body: { transportQrId: batchNumber, location: 'x' },
  });
  ok('QR1 batch code is not a transport token (404)', qr1Token.status === 404, `status ${qr1Token.status}`);

  const verify = await req('GET', `/api/platform/verify/${batchNumber}`, { token: transporter });
  ok('unknown batch verifies as invalid (404)', verify.status === 404, `status ${verify.status}`);

  // ------------------------------------------------------------ summary
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) { console.log(failures.map((f) => `  FAILED: ${f}`).join('\n')); process.exit(1); }
})().catch((e) => { console.error('GATE ERROR:', e.message); process.exit(1); });
