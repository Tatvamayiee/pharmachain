// One-off inventory of demo-DB records for the pre-demo cleanup review.
// Lists (does NOT delete) batches, bills, sales, and script-created medicines.
const mongoose = require('mongoose');
const { MONGODB_URI } = require('../../server/config/env.cjs');

(async () => {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const batches = await db.collection('batches').find({}).project({ batchNumber: 1, medicineName: 1, availableQuantity: 1, manufacturerId: 1, createdAt: 1 }).toArray();
  console.log(`== BATCHES (${batches.length}) ==`);
  for (const b of batches.sort((a, c) => String(a.batchNumber).localeCompare(String(c.batchNumber)))) {
    console.log(`${b.batchNumber} | ${b.medicineName} | qty=${b.availableQuantity} | org=${b.manufacturerId} | ${String(b.createdAt).slice(0, 10)}`);
  }
  const bills = await db.collection('bills').find({}).project({ billNumber: 1, organizationId: 1, grandTotal: 1, createdAt: 1 }).toArray();
  console.log(`\n== BILLS (${bills.length}) ==`);
  for (const b of bills) console.log(`${b.billNumber} | org=${b.organizationId} | ₹${b.grandTotal} | ${String(b.createdAt).slice(0, 10)}`);
  const sales = await db.collection('sales').find({}).project({ medicineName: 1, quantity: 1, customerName: 1, organizationId: 1, createdAt: 1 }).toArray();
  console.log(`\n== SALES (${sales.length}) ==`);
  for (const s of sales) console.log(`${s.medicineName} x${s.quantity} | cust=${s.customerName} | org=${s.organizationId} | ${String(s.createdAt).slice(0, 10)}`);
  const meds = await db.collection('medicines').find({}).project({ name: 1, manufacturerId: 1, createdAt: 1 }).toArray();
  console.log(`\n== MEDICINES (${meds.length}) ==`);
  for (const m of meds.sort((a, c) => String(a.createdAt).localeCompare(String(c.createdAt)))) console.log(`${m.name} | org=${m.manufacturerId} | ${String(m.createdAt).slice(0, 10)}`);
  const cnt = await db.collection('qrverifications').countDocuments();
  console.log(`\n== QR verification logs: ${cnt} (audit trail — kept) ==`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
