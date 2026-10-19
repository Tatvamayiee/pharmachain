// ---------------------------------------------------------------------------
// Pharmacy billing (POS) — multi-item checkout over the REAL Batch store.
//
// One endpoint, POST /api/platform/bills: the server verifies stock for every
// line, deducts FIFO across released lots (earliest expiry first — the same
// rule the purchase/sales endpoints use), records one Sale row per line and
// persists the bill (the printable receipt). All-or-nothing: if any line
// lacks stock, nothing is deducted and the error names every short line.
// ---------------------------------------------------------------------------

const express = require('express');
const z = require('zod');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');
const drugDb = require('../services/drugDatabaseService.cjs');

const router = express.Router();
const batchRepo = createRepository({ name: 'batch', model: models.Batch, prefix: 'BAT' });
const billRepo = createRepository({ name: 'bill', model: models.Bill, prefix: 'BILL' });
const saleRepo = createRepository({ name: 'sale', model: models.Sale, prefix: 'SAL' });

const TAX_RATE = 0.05; // flat demo GST-style rate, applied server-side

const billCreateSchema = {
  body: z.object({
    customerName: z.string().trim().max(120).default('Walk-in customer'),
    patientRef: z.string().trim().max(60).default(''),
    prescriptionId: z.string().trim().max(60).default(''),
    paymentMethod: z.enum(['cash', 'card', 'upi']).default('cash'),
    discount: z.number().nonnegative().default(0),
    items: z.array(z.object({
      medicineName: z.string().trim().min(2).max(200),
      quantity: z.number().int().min(1),
      unitPrice: z.number().nonnegative().default(0),
    })).min(1, 'A bill needs at least one line item'),
  }),
};

/**
 * GET /api/platform/bills — the caller's org bills (admin: all), newest first.
 */
router.get('/bills', auth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { organizationId: req.user.organization || '__none__' };
    const { items } = await billRepo.find({ filter, sort: { createdAt: -1 }, limit: 200 });
    res.json({ bills: items });
  } catch (err) { next(err); }
});

/**
 * GET /api/platform/bills/:id — one bill (org-scoped; admin sees all).
 */
router.get('/bills/:id', auth, async (req, res, next) => {
  try {
    const bill = await billRepo.findOne({ id: req.params.id });
    if (!bill) return res.status(404).json({ error: 'Bill not found.' });
    if (req.user.role !== 'admin' && bill.organizationId !== (req.user.organization || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({ bill });
  } catch (err) { next(err); }
});

/**
 * POST /api/platform/bills — verify stock for every line, deduct FIFO across
 * released lots, record Sales, persist the bill. Insufficient stock on any
 * line → 409 naming each short line; nothing is deducted.
 */
router.post('/bills', auth, requireRole('dealer', 'pharmacy', 'hospital', 'distributor', 'customer', 'admin'),
  validate(billCreateSchema), async (req, res, next) => {
    try {
      const { customerName, patientRef, prescriptionId, paymentMethod, discount, items } = req.body;
      const org = req.user.organization || req.user.name;
      if (!org) return res.status(422).json({ error: 'Your account has no organization; billing is unavailable.' });

      // Resolve every line through the medicine master so scanned brand names
      // ("Tab. Paracetamol 650 mg") match lots stored under the master name.
      const shortages = [];
      const lines = [];
      for (const item of items) {
        let lotName = item.medicineName;
        const mv = drugDb.validateMedicine(item.medicineName);
        if (mv.exists && mv.matchedName) lotName = mv.matchedName;
        const { items: lots } = await batchRepo.find({
          filter: { medicineName: lotName, status: 'released' },
          sort: { expiryDate: 1 },
        });
        const available = lots.reduce((s, l) => s + (l.availableQuantity || 0), 0);
        if (available < item.quantity) {
          shortages.push(`${item.medicineName}: ${available} available, ${item.quantity} requested`);
          continue;
        }
        lines.push({ ...item, lotName, lots });
      }
      if (shortages.length) {
        return res.status(409).json({ error: `Insufficient stock — ${shortages.join('; ')}.` });
      }

      // Deduct FIFO, oldest expiry first, and record one Sale per line.
      const saleIds = [];
      const billItems = [];
      let subtotal = 0;
      for (const line of lines) {
        let remaining = line.quantity;
        for (const lot of line.lots) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, lot.availableQuantity || 0);
          if (take > 0) {
            await batchRepo.updateById(lot.id, { availableQuantity: lot.availableQuantity - take });
            remaining -= take;
          }
        }
        const lineTotal = Number(((line.unitPrice || 0) * line.quantity).toFixed(2));
        subtotal += lineTotal;
        const sale = await saleRepo.create({
          organizationId: org,
          dealerName: req.user.name || '',
          medicineName: line.lotName,
          batchNumber: line.lots[0] ? line.lots[0].batchNumber : '',
          customerName: customerName || 'Walk-in customer',
          quantity: line.quantity,
          unitPrice: line.unitPrice || 0,
          total: lineTotal,
        });
        saleIds.push(sale.id);
        billItems.push({
          medicineName: line.lotName,
          batchNumber: line.lots[0] ? line.lots[0].batchNumber : '',
          quantity: line.quantity,
          unitPrice: line.unitPrice || 0,
          total: lineTotal,
        });
      }

      const tax = Number((subtotal * TAX_RATE).toFixed(2));
      const appliedDiscount = Math.min(discount || 0, subtotal);
      const grandTotal = Number((subtotal + tax - appliedDiscount).toFixed(2));

      // Bill numbers are DB-derived so restarts can't collide.
      const stamp = Date.now().toString(36).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const bill = await billRepo.create({
        billNumber: `BILL-${stamp}-${rand}`,
        organizationId: org,
        customerName: customerName || 'Walk-in customer',
        patientRef: patientRef || '',
        prescriptionId: prescriptionId || '',
        items: billItems,
        subtotal: Number(subtotal.toFixed(2)),
        tax,
        discount: appliedDiscount,
        grandTotal,
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        saleIds,
      });

      res.status(201).json({ bill });
    } catch (err) { next(err); }
  });

module.exports = router;
