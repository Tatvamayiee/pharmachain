// ---------------------------------------------------------------------------
// Inventory — org-scoped batch stock used for dispensing deduction. Batches
// belong to an organization (dealer/hospital stock room); a dispense
// deducts FIFO (earliest expiry first) from released lots.
// ---------------------------------------------------------------------------
const express = require('express');
const z = require('zod');
const validate = require('../middleware/validate.cjs');
const { auth } = require('../middleware/auth.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const router = express.Router();
const batchRepo = createRepository({ name: 'inventory_batches', model: models.InventoryBatch, prefix: 'IB' });

/**
 * GET /api/inventory/stock — batches for the caller's organization.
 * Organization is taken from the JWT payload (never from the request),
 * so a caller can only ever see its own stock.
 */
router.get('/stock', auth, async (req, res, next) => {
  try {
    const org = req.user.organization || '';
    if (!org) return res.json({ stock: [] });
    const { items: batches } = await batchRepo.find({ filter: { organizationId: org }, sort: { expiryDate: 1 } });
    res.json({ stock: batches });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/inventory/stock — receive stock into the caller's organization.
 * The organization comes from the JWT (never the request). Merges into an
 * existing lot with the same medicine+batch, otherwise creates one — so a
 * dealer receiving stock sees it (and everyone in the org sees it) instantly.
 */
const receiveSchema = {
  body: z.object({
    medicineName: z.string().trim().min(2).max(200),
    genericName: z.string().trim().max(200).default(''),
    batchNumber: z.string().trim().min(1).max(60),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    quantity: z.number().int().min(1),
  }),
};

router.post('/stock', auth, validate(receiveSchema), async (req, res, next) => {
  try {
    const org = req.user.organization || req.user.name || '';
    if (!org) return res.status(422).json({ error: 'Your account has no organization; stock cannot be received.' });
    const { medicineName, genericName, batchNumber, expiryDate, quantity } = req.body;

    const existing = await batchRepo.findOne({ organizationId: org, batchNumber });
    if (existing) {
      const updated = await batchRepo.updateById(existing.id, {
        availableQuantity: (existing.availableQuantity || 0) + quantity,
      });
      return res.status(200).json({ lot: updated, merged: true });
    }

    const lot = await batchRepo.create({
      organizationId: org,
      medicineName,
      genericName: genericName || '',
      batchNumber,
      expiryDate,
      availableQuantity: quantity,
      status: 'released',
    });
    res.status(201).json({ lot, merged: false });
  } catch (err) {
    next(err);
  }
});

/** Seed a small synthetic starter stock for demo orgs (idempotent). */
async function seedDemoStock() {
  // Must match the demo accounts' `organization` (server/seed/demoUsers.cjs)
  // so each demo login actually sees its own stock.
  const DEMO_ORGS = ['Sahana Medicals', 'KMCH Hospitals'];
  const STOCK = [
    { medicineName: 'Paracetamol', genericName: 'Acetaminophen', batchNumber: 'PCM-2411', expiryDate: '2027-06-30', availableQuantity: 500 },
    { medicineName: 'Amoxicillin', genericName: 'Amoxicillin', batchNumber: 'AMX-2408', expiryDate: '2027-02-28', availableQuantity: 200 },
    { medicineName: 'Ibuprofen', genericName: 'Ibuprofen', batchNumber: 'IBU-2410', expiryDate: '2027-09-30', availableQuantity: 300 },
    { medicineName: 'Cetirizine', genericName: 'Cetirizine', batchNumber: 'CTZ-2412', expiryDate: '2028-01-31', availableQuantity: 400 },
    { medicineName: 'Omeprazole', genericName: 'Omeprazole', batchNumber: 'OMP-2409', expiryDate: '2027-04-30', availableQuantity: 150 },
    { medicineName: 'Metformin', genericName: 'Metformin', batchNumber: 'MET-2407', expiryDate: '2027-08-31', availableQuantity: 250 },
  ];
  let created = 0;
  for (const org of DEMO_ORGS) {
    for (const s of STOCK) {
      const exists = await batchRepo.findOne({ organizationId: org, batchNumber: s.batchNumber });
      if (!exists) {
        await batchRepo.create({
          organizationId: org,
          medicineName: s.medicineName,
          genericName: s.genericName,
          batchNumber: s.batchNumber,
          expiryDate: s.expiryDate,
          availableQuantity: s.availableQuantity,
          status: 'released',
        });
        created += 1;
      }
    }
  }
  return created;
}

module.exports = { router, batchRepo, seedDemoStock };
