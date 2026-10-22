// Platform data-sharing regression matrix — run with the server up:
//   npm run dev:server                 (terminal 1)
//   node scripts/tests/verify-platform.cjs   (terminal 2)
//
// Guards the "data created in one login is visible in the others" contract
// end-to-end against the REAL database (MongoDB or in-memory):
//   1. Cross-login reflection — medicine/batch/stock/sale/recall created by
//      one org appear for the other orgs (and org-private data does NOT leak).
//   2. Recall flow — manufacturer recall propagates to dealer/hospital,
//      auto-quarantines their inventory lots, and releasing restores them.
//   3. QR + verification flow — every batch has a scannable QR payload and
//      /verify resolves it from any login (authentic/recalled), with the
//      scan logged server-side.
// Creates its own uniquely-stamped data and cleans up the noisy bits, so it
// is safe to run repeatedly against a shared dev database.
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
  return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';', 1)[0] || null };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password } });
  if (r.status !== 200 || !r.cookie || r.data?.token) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.cookie;
}

const fut = (days) => new Date(Date.now() + days * 86400e3).toISOString().slice(0, 10);
const stamp = Date.now().toString(36);

async function main() {
  // ------------------------------------------------------------------ setup
  const mfr = await login('manufacturer@pharmachain.com', 'manufacturer123');
  const dealer = await login('dealer@pharmachain.com', 'dealer123');
  const hospital = await login('hospital@pharmachain.com', 'hospital123');
  const admin = await login('admin@pharmachain.com', 'admin123');
  const M = (m, p, b) => req(m, p, { token: mfr, body: b });
  const D = (m, p, b) => req(m, p, { token: dealer, body: b });
  const H = (m, p, b) => req(m, p, { token: hospital, body: b });
  const A = (m, p, b) => req(m, p, { token: admin, body: b });

  // Use a REAL medicine-master entry — batch creation validates against the
  // master, so fake script names are (correctly) rejected with 422.
  const MED = 'Dolo 650 Tablet';
  const BN = `PT-${stamp.toUpperCase()}`;
  // Medicine-CRUD probe needs a UNIQUE name per run (409 dupe check); batches
  // use a real master entry because batch creation validates against it.
  const CRUD_MED = `PlatformT ${stamp}`;
  let batchId = null;
  let createdShipmentCode = null;

  try {
    // ------------------------------------------------ cross-login reflection
    console.log('\n— cross-login data reflection —');

    const med = await M('POST', '/api/platform/medicines', {
      name: CRUD_MED, genericName: 'Platform test generic', category: 'Analgesic', dosageForm: 'Tablet', strength: '250mg',
    });
    check('manufacturer registers medicine (201)', med.status === 201 && !!med.data?.medicine?.id, `status ${med.status}`);
    const medId = med.data?.medicine?.id;

    const dupe = await M('POST', '/api/platform/medicines', { name: CRUD_MED });
    check('duplicate medicine rejected (409)', dupe.status === 409, `status ${dupe.status}`);

    for (const [role, call] of [['dealer', D], ['hospital', H], ['admin', A]]) {
      const r = await call('GET', '/api/platform/medicines');
      const found = (r.data?.medicines || []).some((m) => m.name === CRUD_MED);
      check(`medicine visible to ${role}`, found, 'missing from their catalog list');
    }

    const batch = await M('POST', '/api/platform/batches', {
      medicineName: MED, batchNumber: BN, manufacturingDate: fut(-1), expiryDate: fut(300), quantityProduced: 75,
    });
    batchId = batch.data?.batch?.id;
    check('manufacturer registers batch (201)', batch.status === 201 && !!batchId, `status ${batch.status}`);

    const mBatches = await M('GET', '/api/platform/batches');
    check('batch visible to manufacturer', (mBatches.data?.batches || []).some((b) => b.batchNumber === BN));
    const aBatches = await A('GET', '/api/platform/batches');
    check('batch visible to admin (global view)', (aBatches.data?.batches || []).some((b) => b.batchNumber === BN));

    // MED ('Dolo 650 Tablet') master-matches to the generic 'Paracetamol',
    // so the batch links that medicine — not the script-created unique one.
    // Exercise the 409 with a medicine whose catalog entry IS batch-linked.
    const linkedMed = (mBatches.data?.batches || []).some((b) => b.batchNumber === BN)
      ? (await M('GET', '/api/platform/medicines')).data?.medicines?.find((m) => m.name === 'Paracetamol')
      : null;
    const delBlocked = linkedMed
      ? await M('DELETE', `/api/platform/medicines/${linkedMed.id}`)
      : await M('DELETE', `/api/platform/medicines/${medId}`);
    check('medicine delete blocked while batches exist (409)', delBlocked.status === 409, `status ${delBlocked.status}`);

    const recv = await D('POST', '/api/inventory/stock', {
      medicineName: MED, batchNumber: BN, quantity: 25, expiryDate: fut(300), unitPrice: 10,
    });
    check('dealer receives stock (2xx)', recv.status === 200 || recv.status === 201, `status ${recv.status}`);
    const dInv = await D('GET', '/api/platform/inventory');
    const lot = (dInv.data?.stock || []).find((l) => l.batchNumber === BN);
    check('stock lot in dealer inventory', !!lot && Number(lot.availableQuantity) >= 25, lot ? `qty=${lot.availableQuantity}` : 'lot missing');

    const sale = await D('POST', '/api/platform/sales', {
      medicineName: MED, batchNumber: BN, customerName: `PT Buyer ${stamp}`, quantity: 5, unitPrice: 10,
    });
    check('dealer records sale (2xx)', sale.status === 200 || sale.status === 201, `status ${sale.status} ${JSON.stringify(sale.data).slice(0, 100)}`);
    const aSales = await A('GET', '/api/platform/sales');
    check('sale visible to admin', JSON.stringify(aSales.data?.sales || []).includes(`PT Buyer ${stamp}`));
    const hSales = await H('GET', '/api/platform/sales');
    check('sale NOT leaked to hospital (org isolation)', !JSON.stringify(hSales.data?.sales || []).includes(`PT Buyer ${stamp}`));

    const oversell = await D('POST', '/api/platform/sales', {
      medicineName: MED, batchNumber: BN, customerName: 'Oversell', quantity: 100000, unitPrice: 1,
    });
    check('overselling beyond lot rejected (409)', oversell.status === 409, `status ${oversell.status}`);

    // ------------------------------------------------------------- dispatch
    console.log('\n— dispatch flow —');

    const receivers = await M('GET', '/api/shipments/receivers');
    const orgs = receivers.data?.receivers || [];
    check('receiver directory lists active orgs', receivers.status === 200 && orgs.length > 0, `${orgs.length} orgs`);

    const dispatch = await M('POST', '/api/shipments/dispatch', {
      medicineName: MED, batchNumber: BN, quantity: 10,
      receiverOrg: orgs[0]?.organization, destination: 'Chennai', route: 'Coimbatore → Chennai', trackingNumber: `PT-${stamp}`,
    });
    createdShipmentCode = dispatch.data?.code;
    check('dispatch created with receiver org (201)', dispatch.status === 201 && !!createdShipmentCode, `status ${dispatch.status}`);

    const badRecv = await M('POST', '/api/shipments/dispatch', {
      medicineName: MED, batchNumber: BN, quantity: 1, receiverOrg: 'NoSuch Org', destination: 'X',
    });
    check('dispatch to unknown org rejected (404)', badRecv.status === 404, `status ${badRecv.status}`);

    if (createdShipmentCode) {
      const list = await M('GET', '/api/shipments');
      const found = (Array.isArray(list.data) ? list.data : []).find((s) => s.code === createdShipmentCode);
      check('shipment appears in list', !!found, found ? `status=${found.status}` : 'not listed');

      const cancel = await M('POST', `/api/shipments/${createdShipmentCode}/cancel`);
      check('dispatch cancel works', cancel.status === 200 && String(cancel.data?.status).toUpperCase() === 'CANCELLED', `status ${cancel.status}`);
      const cancel2 = await M('POST', `/api/shipments/${createdShipmentCode}/cancel`);
      check('double cancel rejected (409)', cancel2.status === 409, `status ${cancel2.status}`);
    }

    // ----------------------------------------------------------- QR + verify
    console.log('\n— QR payload + verification —');

    const qrBatch = (mBatches.data?.batches || []).find((b) => b.batchNumber === BN);
    const payload = qrBatch?.qrCode || `https://pharmachain.app/verify/${BN}`;
    check('batch carries a QR verification payload', !!qrBatch?.qrCode, 'qrCode missing on batch');

    const viaCode = await D('GET', `/api/platform/verify/${BN}`);
    check('verify by batch number (dealer)', viaCode.status === 200 && viaCode.data?.verification?.result === 'authentic', viaCode.data?.verification?.result || `status ${viaCode.status}`);

    const viaUrl = await H('GET', `/api/platform/verify/${encodeURIComponent(payload)}`);
    check('verify by full QR payload URL (hospital)', viaUrl.status === 200 && viaUrl.data?.verification?.result === 'authentic', viaUrl.data?.verification?.result || `status ${viaUrl.status}`);

    const unknown = await D('GET', '/api/platform/verify/PT-DOES-NOT-EXIST');
    check('unknown batch rejected (404)', unknown.status === 404, `status ${unknown.status}`);

    const scanLog = await A('GET', '/api/platform/verifications');
    check('verifications logged server-side', scanLog.status === 200 && (scanLog.data?.verifications || []).some((v) => v.code === BN || v.batchNumber === BN));

    // ----------------------------------------------------------- recall flow
    console.log('\n— recall propagation —');

    const recall = await M('PATCH', `/api/platform/batches/${batchId}/status`, {
      status: 'recalled', reason: 'Platform matrix: QA failure', severity: 'critical',
    });
    check('manufacturer recalls batch (200)', recall.status === 200 && recall.data?.batch?.status === 'recalled', `status ${recall.status}`);

    const dRec = await D('GET', '/api/platform/recalls');
    const dHit = (dRec.data?.recalls || []).find((r) => r.batchNumber === BN);
    check('recall visible to dealer immediately', !!dHit, dHit ? `severity=${dHit.severity}` : 'missing');
    const hRec = await H('GET', '/api/platform/recalls');
    check('recall visible to hospital immediately', (hRec.data?.recalls || []).some((r) => r.batchNumber === BN));
    const aRec = await A('GET', '/api/platform/recalls');
    check('recall visible to admin', (aRec.data?.recalls || []).some((r) => r.batchNumber === BN));

    const lotAfter = (await D('GET', '/api/platform/inventory')).data?.stock?.find((l) => l.batchNumber === BN);
    check('dealer lot auto-quarantined on recall', lotAfter?.status === 'recalled', `status=${lotAfter?.status}`);

    const hAttempt = await H('PATCH', `/api/platform/batches/${batchId}/status`, { status: 'released' });
    check('hospital cannot change batch status (403)', hAttempt.status === 403, `status ${hAttempt.status}`);

    const recalledScan = await D('GET', `/api/platform/verify/${BN}`);
    check('scan of recalled batch reports RECALLED', recalledScan.data?.verification?.result === 'recalled', recalledScan.data?.verification?.result);

    const release = await M('PATCH', `/api/platform/batches/${batchId}/status`, { status: 'released' });
    check('manufacturer releases batch (200)', release.status === 200 && release.data?.batch?.status === 'released', `status ${release.status}`);

    const dRec2 = await D('GET', '/api/platform/recalls');
    check('recall cleared from dealer list after release', !(dRec2.data?.recalls || []).some((r) => r.batchNumber === BN));
    const lotAfterRelease = (await D('GET', '/api/platform/inventory')).data?.stock?.find((l) => l.batchNumber === BN);
    check('dealer lot restored to released', lotAfterRelease?.status === 'released', `status=${lotAfterRelease?.status}`);

    const relScan = await D('GET', `/api/platform/verify/${BN}`);
    check('scan reports authentic again after release', relScan.data?.verification?.result === 'authentic', relScan.data?.verification?.result);
  } finally {
    // ----------------------------------------------------------- cleanup
    // Best-effort removal of noisy artifacts so repeated runs keep the shared
    // dev database tidy. Cleanup failures never affect the exit code.
    try {
      if (batchId) {
        // Returning the remaining stock keeps the ledger honest, then the
        // batch is expired so it stops showing as active.
        const lots = (await req('GET', '/api/platform/inventory', { token: dealer })).data?.stock || [];
        const lot = lots.find((l) => l.batchNumber === BN);
        const remaining = Number(lot?.availableQuantity ?? 0);
        if (remaining > 0) {
          await req('POST', '/api/platform/sales', {
            token: dealer,
            body: { medicineName: MED, batchNumber: BN, customerName: 'PT cleanup', quantity: remaining, unitPrice: 0 },
          }).catch(() => {});
        }
        await req('PATCH', `/api/platform/batches/${batchId}/status`, { token: mfr, body: { status: 'expired' } }).catch(() => {});
      }
    } catch { /* cleanup is best-effort */ }
  }

  console.log(`\n${passed}/${passed + failed} platform checks passed.`);
  if (failures.length) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Platform matrix crashed:', err);
  process.exit(1);
});
