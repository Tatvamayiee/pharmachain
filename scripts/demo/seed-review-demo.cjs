// ---------------------------------------------------------------------------
// Review/demo data seeder — NON-DESTRUCTIVE and IDEMPOTENT.
//
// Adds realistic demo content on top of whatever already exists so every
// role's dashboard has something to show during a review:
//   • manufacturer: more catalogue medicines, batches (incl. one recalled,
//     one near-expiry, one quarantine), shipments, procurement orders
//   • dealer/hospital: inventory lots, POS sales, pharmacy bills
//   • customer/admin: recent QR verifications (authentic/expired/recalled)
//   • transport: transport events for the new shipments (cold-chain notes)
//
// Every document is keyed on a natural key (name / batchNumber / code /
// billNumber / id) — re-running never duplicates rows and never deletes or
// modifies existing data. Uses the same DB as the backend
// (PHARMACHAIN_MONGODB_URI from .env).
//
//   node scripts/demo/seed-review-demo.cjs
// ---------------------------------------------------------------------------
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');

const MFR = 'Tatva Pharmaceuticals';
const DEALER = 'Sahana Medicals';
const HOSPITAL = 'KMCH Hospitals';
const TRANSPORTER = 'FleetGo Logistics';

const daysAgo = (n, h = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(h, (n * 7) % 60, 0, 0);
  return d;
};
const iso = (d) => d.toISOString();
const plusMonths = (d, m) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + m); return x; };

// name, generic, category, form, strength, [mfgMonthsAgo, expiryMonths], qtyProduced, qtyAvailable, batchStatus
const DEMO_MEDICINES = [
  ['Dolo 650', 'Paracetamol', 'Analgesic / Antipyretic', 'Tablet', '650 mg', [9, 21], 20000, 9800, 'released'],
  ['Azithral 500', 'Azithromycin', 'Antibiotic', 'Tablet', '500 mg', [7, 19], 15000, 6400, 'released'],
  ['Pantop 40', 'Pantoprazole', 'Antacid / PPI', 'Tablet', '40 mg', [10, 22], 18000, 11200, 'released'],
  ['Augmentin 625 Duo', 'Amoxicillin + Clavulanate', 'Antibiotic', 'Tablet', '625 mg', [8, 20], 12000, 3200, 'recalled'],
  ['Pan-D', 'Pantoprazole + Domperidone', 'Antacid / PPI', 'Capsule', '40 mg + 30 mg', [6, 18], 14000, 7100, 'released'],
  ['Cetzine 10', 'Cetirizine', 'Antiallergic', 'Tablet', '10 mg', [13, 1.5], 10000, 2400, 'released'],
  ['Combiflam', 'Ibuprofen + Paracetamol', 'Analgesic', 'Tablet', '400 mg + 325 mg', [11, 23], 16000, 8300, 'released'],
  ['Zincovit', 'Multivitamin + Zinc', 'Supplement', 'Tablet', 'Multivitamin', [5, 24], 22000, 15600, 'released'],
  ['Shelcal 500', 'Calcium + Vitamin D3', 'Supplement', 'Tablet', '500 mg', [9, 24], 17000, 10400, 'released'],
  ['Glycomet GP 1', 'Metformin + Glimepiride', 'Antidiabetic', 'Tablet', '500 mg + 1 mg', [8, 20], 13000, 5900, 'released'],
  ['Telma 40', 'Telmisartan', 'Antihypertensive', 'Tablet', '40 mg', [7, 21], 15000, 8800, 'released'],
  ['Monocef 200', 'Cefixime', 'Antibiotic', 'Tablet', '200 mg', [6, 18], 9000, 0, 'quarantine'],
];

const CUSTOMERS = ['Arjun Sharma', 'Meena Iyer', 'Ravi Kumar', 'Priya Nair', 'Walk-in customer', 'Suresh Babu', 'Lakshmi R', 'Walk-in customer'];

async function main() {
  await mongoose.connect(process.env.PHARMACHAIN_MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const col = (n) => mongoose.connection.db.collection(n);

  const before = {};
  for (const c of ['medicines', 'batches', 'inventorybatches', 'sales', 'bills', 'shipments', 'transportevents', 'qrverifications', 'procurementorders']) {
    before[c] = await col(c).countDocuments();
  }
  console.log('Before:', JSON.stringify(before));

  const existingBatches = await col('batches').find({}).limit(3).toArray();
  console.log('Existing batch sample (for format reference):',
    existingBatches.map(b => ({ batchNumber: b.batchNumber, manufacturerId: b.manufacturerId, medicineName: b.medicineName })));
  const existingNames = new Set((await col('medicines').find({}, { projection: { name: 1 } }).toArray()).map(m => (m.name || '').toLowerCase()));
  const medIdByName = new Map((await col('medicines').find({}, { projection: { name: 1, id: 1 } }).toArray()).map(m => [m.name, m.id]));

  const added = { medicines: 0, batches: 0, inventory: 0, sales: 0, bills: 0, shipments: 0, transportEvents: 0, qr: 0, procurement: 0 };
  const newBatches = []; // {batchNumber, medicineName, expiry, status, available}

  // --- 1. Medicines + manufacturer batches --------------------------------
  for (let i = 0; i < DEMO_MEDICINES.length; i++) {
    const [name, generic, category, form, strength, [mfgAgo, expM], produced, avail, batchStatus] = DEMO_MEDICINES[i];
    const n = String(i + 1).padStart(2, '0');

    if (!existingNames.has(name.toLowerCase())) {
      const docId = `MED-DEMO-${n}`;
      await col('medicines').insertOne({
        id: docId, name, genericName: generic, category, dosageForm: form, strength,
        manufacturerId: MFR, status: 'active', createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(30)),
      });
      medIdByName.set(name, docId);
      added.medicines += 1;
    }

    const batchNumber = `TXP24${n}`;
    const dup = await col('batches').findOne({ batchNumber });
    const mfgDate = daysAgo(mfgAgo * 30);
    const expiry = plusMonths(mfgDate, expM);
    if (!dup) {
      await col('batches').insertOne({
        id: `BAT-DEMO-${n}`, medicineId: medIdByName.get(name) || '', manufacturerId: MFR, batchNumber,
        medicineName: name, manufacturingDate: iso(mfgDate), expiryDate: expiry,
        quantityProduced: produced, availableQuantity: avail, status: batchStatus,
        ...(batchStatus === 'recalled'
          ? { recallReason: 'Quality control failure — sub-potency detected in dissolution testing (DCGI alert 2026-10-12).', recallSeverity: 'high' }
          : {}),
        ...(batchStatus === 'quarantine' ? { recallReason: 'Awaiting third-party QC verification before release.', recallSeverity: 'medium' } : {}),
        createdAt: iso(daysAgo(mfgAgo * 30)), updatedAt: iso(daysAgo(1)),
      });
      added.batches += 1;
    }
    newBatches.push({ batchNumber, medicineName: name, expiry, status: batchStatus, available: avail });
  }

  // Extra expired batch so expiry alerts / "expired" QR scan demos work.
  const expiredBatchNumber = 'TXP1999';
  if (!(await col('batches').findOne({ batchNumber: expiredBatchNumber }))) {
    await col('batches').insertOne({
      id: 'BAT-DEMO-EXP', medicineId: medIdByName.get('Cetzine 10') || '', manufacturerId: MFR, batchNumber: expiredBatchNumber,
      medicineName: 'Cetzine 10', manufacturingDate: iso(daysAgo(720)), expiryDate: daysAgo(120),
      quantityProduced: 5000, availableQuantity: 0, status: 'expired',
      createdAt: iso(daysAgo(720)), updatedAt: iso(daysAgo(120)),
    });
    added.batches += 1;
  }

  // --- 2. Dealer + hospital inventory lots --------------------------------
  const lots = [];
  newBatches.forEach((b, i) => {
    const n = String(i + 1).padStart(2, '0');
    lots.push({ org: DEALER, n: `D${n}`, medicineName: b.medicineName, batchNumber: b.batchNumber,
      expiry: b.status === 'released' ? iso(b.expiry) : iso(daysAgo(-60)), qty: Math.round(b.available * 0.35),
      status: b.status === 'recalled' ? 'recalled' : b.status === 'quarantine' ? 'quarantine' : 'released' });
    if (i % 2 === 0) {
      lots.push({ org: HOSPITAL, n: `H${n}`, medicineName: b.medicineName, batchNumber: b.batchNumber,
        expiry: b.status === 'released' ? iso(b.expiry) : iso(daysAgo(-60)), qty: Math.round(b.available * 0.15),
        status: b.status === 'recalled' ? 'recalled' : b.status === 'quarantine' ? 'quarantine' : 'released' });
    }
  });
  for (const lot of lots) {
    if (await col('inventorybatches').findOne({ organizationId: lot.org, batchNumber: lot.batchNumber })) continue;
    await col('inventorybatches').insertOne({
      id: `INV-DEMO-${lot.n}`, organizationId: lot.org, medicineName: lot.medicineName,
      genericName: '', batchNumber: lot.batchNumber, expiryDate: lot.expiry,
      availableQuantity: lot.qty, status: lot.status,
      createdAt: iso(daysAgo(20)), updatedAt: iso(daysAgo(2)),
    });
    added.inventory += 1;
  }

  // --- 3. Dealer POS sales (backdated across ~3 weeks) --------------------
  const PRICE = { 'Dolo 650': 32.5, 'Azithral 500': 118, 'Pantop 40': 96, 'Pan-D': 142, 'Cetzine 10': 24,
    'Combiflam': 44, 'Zincovit': 108, 'Shelcal 500': 132, 'Glycomet GP 1': 76, 'Telma 40': 110 };
  const sellable = newBatches.filter(b => b.status === 'released');
  for (let i = 1; i <= 26; i++) {
    const id = `SAL-DEMO-${String(i).padStart(3, '0')}`;
    if (await col('sales').findOne({ id })) continue;
    const b = sellable[i % sellable.length];
    const unitPrice = PRICE[b.medicineName] ?? 50;
    const quantity = 1 + (i % 6);
    await col('sales').insertOne({
      id, organizationId: DEALER, dealerName: 'sahana Pharmacy', medicineName: b.medicineName,
      batchNumber: b.batchNumber, customerName: CUSTOMERS[i % CUSTOMERS.length],
      quantity, unitPrice, total: Number((unitPrice * quantity).toFixed(2)),
      createdAt: iso(daysAgo((i * 5) % 21, 9 + (i % 9))), updatedAt: iso(daysAgo((i * 5) % 21)),
    });
    added.sales += 1;
  }

  // --- 4. Pharmacy bills --------------------------------------------------
  const METHODS = ['cash', 'upi', 'card'];
  for (let i = 1; i <= 11; i++) {
    const billNumber = `BILL-DEMO-${String(i).padStart(3, '0')}`;
    if (await col('bills').findOne({ billNumber })) continue;
    const org = i <= 8 ? DEALER : HOSPITAL;
    const lineCount = 1 + (i % 3);
    const items = [];
    for (let j = 0; j < lineCount; j++) {
      const b = sellable[(i + j * 3) % sellable.length];
      const unitPrice = PRICE[b.medicineName] ?? 50;
      const quantity = 1 + ((i + j) % 4);
      items.push({ medicineName: b.medicineName, batchNumber: b.batchNumber, quantity,
        unitPrice, total: Number((unitPrice * quantity).toFixed(2)) });
    }
    const subtotal = Number(items.reduce((s, it) => s + it.total, 0).toFixed(2));
    const tax = Number((subtotal * 0.05).toFixed(2));
    const discount = i % 4 === 0 ? 20 : 0;
    await col('bills').insertOne({
      id: `BILLD-DEMO-${String(i).padStart(3, '0')}`, billNumber, organizationId: org,
      customerName: CUSTOMERS[(i + 2) % CUSTOMERS.length], patientRef: i % 3 === 0 ? `PRF-DEMO-${i}` : '',
      prescriptionId: '', items, subtotal, tax, discount,
      grandTotal: Number((subtotal + tax - discount).toFixed(2)),
      paymentMethod: METHODS[i % METHODS.length], status: 'paid', saleIds: [],
      createdAt: iso(daysAgo(i * 2, 11)), updatedAt: iso(daysAgo(i * 2, 11)),
    });
    added.bills += 1;
  }

  // --- 5. Procurement orders (dealer/hospital → manufacturer) -------------
  const PO = [
    { buyer: DEALER, role: 'dealer', med: 'Dolo 650', qty: 1500, note: 'Restock ahead of monsoon season demand.' },
    { buyer: HOSPITAL, role: 'hospital', med: 'Azithral 500', qty: 800, note: 'Ward supply for Q4 — please ship in cold-chain packaging.' },
    { buyer: DEALER, role: 'dealer', med: 'Telma 40', qty: 1200, note: 'Monthly chronic-care refill cycle.' },
    { buyer: HOSPITAL, role: 'hospital', med: 'Zincovit', qty: 2000, note: 'Paediatric ward nutrition programme.' },
  ];
  for (let i = 0; i < PO.length; i++) {
    const id = `PO-DEMO-${String(i + 1).padStart(3, '0')}`;
    if (await col('procurementorders').findOne({ id })) continue;
    const p = PO[i];
    const med = DEMO_MEDICINES.find(m => m[0] === p.med);
    await col('procurementorders').insertOne({
      id, buyerId: `demo-${p.role}`, buyerName: `${p.buyer} purchase desk`, buyerRole: p.role,
      buyerOrganization: p.buyer, manufacturerId: MFR, medicineId: medIdByName.get(p.med) || '',
      medicineName: p.med, quantity: p.qty, notes: p.note, decisionNote: '', status: 'pending', allocations: [],
      createdAt: iso(daysAgo(i + 1, 9)), updatedAt: iso(daysAgo(i + 1, 9)),
    });
    added.procurement += 1;
  }

  // --- 6. Shipments + transport events (cold-chain journey) ---------------
  const SHIPMENTS = [
    { code: 'SHIP-DEMO-01', batch: 0, to: DEALER, dest: 'Coimbatore, TN', status: 'in_transit', days: 2,
      stops: [['Chennai Plant — dispatched', 'dispatched'], ['Vellore hub — temperature check 4.2°C', 'in_transit'], ['Salem transit point — on schedule', 'in_transit']] },
    { code: 'SHIP-DEMO-02', batch: 1, to: HOSPITAL, dest: 'Coimbatore, TN', status: 'at_pharmacy', days: 6,
      stops: [['Chennai Plant — dispatched', 'dispatched'], ['Krishnagiri hub', 'in_transit'], ['Coimbatore DC — received', 'at_distribution_center'], ['KMCH Hospitals — delivered to pharmacy desk', 'at_pharmacy']] },
    { code: 'SHIP-DEMO-03', batch: 2, to: DEALER, dest: 'Salem, TN', status: 'delivered', days: 11,
      stops: [['Chennai Plant — dispatched', 'dispatched'], ['Chengalpattu hub', 'in_transit'], ['Salem Medicals godown — delivered & signed', 'delivered']] },
    { code: 'SHIP-DEMO-04', batch: 7, to: HOSPITAL, dest: 'Madurai, TN', status: 'dispatched', days: 1,
      stops: [['Chennai Plant — packed & dispatched', 'dispatched']] },
  ];
  for (let i = 0; i < SHIPMENTS.length; i++) {
    const s = SHIPMENTS[i];
    // The transport role's visibility check compares transporterId to the
    // USER ID (demo-transport), not the organization name.
    if (await col('shipments').findOne({ code: s.code })) {
      await col('shipments').updateOne({ code: s.code }, { $set: { transporterId: 'demo-transport' } });
      continue;
    }
    const b = newBatches[s.batch];
    const batchDoc = await col('batches').findOne({ batchNumber: b.batchNumber }, { projection: { id: 1 } });
    const checkpoints = s.stops.map(([at], k) => ({ at: iso(daysAgo(s.days - k, 8 + k * 3)), by: 'demo-transport', note: at }));
    const qrId = crypto.randomBytes(16).toString('hex');
    await col('shipments').insertOne({
      id: `SHIPD-DEMO-${String(i + 1).padStart(2, '0')}`, code: s.code, batchId: batchDoc ? batchDoc.id : '',
      senderId: MFR, receiverId: s.to, transporterId: 'demo-transport', destination: s.dest,
      route: ['Chennai', s.dest.split(',')[0]], quantity: 500, drugName: b.medicineName, batch: b.batchNumber,
      manufacturer: MFR, status: s.status, trackingNumber: `TRK-DEMO-${String(i + 1).padStart(2, '0')}`,
      checkpoints, transportQrId: qrId, currentLocation: s.stops[s.stops.length - 1][0].split(' — ')[0],
    });
    added.shipments += 1;

    for (let k = 0; k < s.stops.length; k++) {
      const [at, status] = s.stops[k];
      const id = `TE-DEMO-${String(i + 1).padStart(2, '0')}-${k + 1}`;
      if (await col('transportevents').findOne({ id })) continue;
      await col('transportevents').insertOne({
        id, shipmentId: `SHIPD-DEMO-${String(i + 1).padStart(2, '0')}`, shipmentCode: s.code, transportQrId: qrId,
        location: at.split(' — ')[0], status, timestamp: iso(daysAgo(s.days - k, 8 + k * 3)),
        updatedBy: 'Transporter', updatedById: 'demo-transport', organization: TRANSPORTER, role: 'transport',
        note: at.includes('—') ? at : 'Cold chain 2–8°C maintained', createdAt: iso(daysAgo(s.days - k)), updatedAt: iso(daysAgo(s.days - k)),
      });
      added.transportEvents += 1;
    }
  }

  // --- 7. QR verifications (authentic / expired / recalled / invalid) -----
  const QR = [
    ...newBatches.filter(b => b.status === 'released').slice(0, 6).map(b => ({ code: b.batchNumber, result: 'authentic' })),
    { code: expiredBatchNumber, result: 'expired' },
    { code: 'TXP2404', result: 'recalled' }, // Augmentin 625 Duo — the recalled batch
    { code: 'FAKE-QR-9931', result: 'invalid' },
    { code: 'FAKE-QR-7712', result: 'invalid' },
  ];
  for (let i = 0; i < QR.length; i++) {
    const code = `QRV-DEMO-${String(i + 1).padStart(3, '0')}`;
    if (await col('qrverifications').findOne({ id: code })) continue;
    const q = QR[i];
    const b = newBatches.find(x => x.batchNumber === q.code);
    const batchDoc = b ? await col('batches').findOne({ batchNumber: q.code }, { projection: { id: 1 } }) : null;
    await col('qrverifications').insertOne({
      id: code, batchId: batchDoc ? batchDoc.id : '',
      batchNumber: b ? q.code : '', code: q.code, result: q.result,
      verifiedBy: CUSTOMERS[i % CUSTOMERS.length], organizationId: '', location: 'Chennai, TN',
      createdAt: iso(daysAgo(i, 12)), updatedAt: iso(daysAgo(i, 12)),
    });
    added.qr += 1;
  }

  console.log('Added:', JSON.stringify(added, null, 2));
  const after = {};
  for (const c of Object.keys(before)) after[c] = await col(c).countDocuments();
  console.log('After: ', JSON.stringify(after));
  await mongoose.disconnect();
}

main().catch((e) => { console.error('Seed failed:', e); process.exit(1); });
