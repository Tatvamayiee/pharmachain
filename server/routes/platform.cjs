// ---------------------------------------------------------------------------
// Platform data — read-only endpoints backing the admin/dashboards UI.
//
// Everything here is REAL server data (MongoDB or the in-memory fallback) so
// that what one login creates is visible to every other login — no per-tab
// mock state. Scoping:
//   - users / audit-logs: admin only (they are platform-wide).
//   - inventory/stock: org-scoped by the JWT (each org sees its own lots);
//     admin sees all lots.
// ---------------------------------------------------------------------------

const express = require('express');
const z = require('zod');
const jwt = require('jsonwebtoken');
const validate = require('../middleware/validate.cjs');
const { auth, requireRole } = require('../middleware/auth.cjs');
const { JWT_SECRET } = require('../config/env.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');
const drugDb = require('../services/drugDatabaseService.cjs');

const router = express.Router();

/**
 * Optional auth for the public verification endpoint: identify the caller
 * when a valid Bearer token is present, never reject — anonymous package
 * scans must still verify. Identity is only used to attribute scan logs.
 */
function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(h.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
      req.user = { id: payload.id, name: payload.name || '', organization: payload.organization || '' };
    } catch { /* invalid/expired token → treated as anonymous */ }
  }
  next();
}

const userRepo = createRepository({ name: 'users', model: models.User, prefix: 'U' });
const medicineRepo = createRepository({ name: 'medicines', model: models.Medicine, prefix: 'M' });
const batchRepo = createRepository({ name: 'batches', model: models.Batch, prefix: 'B' });
const inventoryRepo = createRepository({ name: 'inventory_batches', model: models.InventoryBatch, prefix: 'IB' });
const auditRepo = createRepository({ name: 'prescription_audits', model: models.PrescriptionAudit, prefix: 'PRA' });
const saleRepo = createRepository({ name: 'sales', model: models.Sale, prefix: 'S' });
const verificationRepo = createRepository({ name: 'qr_verifications', model: models.QRVerification, prefix: 'QV' });

/** GET /api/platform/users — admin-only directory of registered users. */
router.get('/users', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { items } = await userRepo.find({ filter: {}, sort: { createdAt: -1 }, limit: 500 });
    res.json({
      users: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        organization: u.organization || '',
        status: u.status || 'active',
        createdAt: u.createdAt || new Date().toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/platform/audit-logs — admin-only, most recent first. */
router.get('/audit-logs', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const { items } = await auditRepo.find({ filter: {}, sort: { createdAt: -1 }, limit: 300 });
    res.json({
      logs: items.map((a) => ({
        id: a.id,
        actorId: a.actorId || '',
        actorRole: a.actorRole || '',
        action: a.action || '',
        entity: 'Prescription',
        entityId: a.prescriptionId || '',
        description: a.note || a.action || '',
        timestamp: a.createdAt || new Date().toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/inventory — org-scoped stock lots.
 * Dealer/hospital see their own organization's lots (JWT-scoped, like the
 * dispensing deduction path); admin sees everything.
 */
router.get('/inventory', auth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { organizationId: req.user.organization || '__none__' };
    const { items } = await inventoryRepo.find({ filter, sort: { expiryDate: 1 }, limit: 500 });
    res.json({ stock: items });
  } catch (err) {
    next(err);
  }
});

/** GET /api/platform/medicines — reference catalog (authenticated, any role). */
router.get('/medicines', auth, async (req, res, next) => {
  try {
    const { items } = await medicineRepo.find({ filter: {}, sort: { name: 1 }, limit: 1000 });
    res.json({ medicines: items });
  } catch (err) {
    next(err);
  }
});

const medicineCreateSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(200),
    genericName: z.string().trim().max(200).default(''),
    category: z.string().trim().max(80).default('Other'),
    dosageForm: z.string().trim().max(80).default(''),
    strength: z.string().trim().max(80).default(''),
  }),
};

/** POST /api/platform/medicines — register a catalog medicine (manufacturer). */
router.post('/medicines', auth, requireRole(['manufacturer', 'admin']), validate(medicineCreateSchema), async (req, res, next) => {
  try {
    const org = req.user.organization || req.user.name;
    const { name, genericName, category, dosageForm, strength } = req.body;

    const dupe = await medicineRepo.findOne({ name, manufacturerId: org });
    if (dupe) return res.status(409).json({ error: `Medicine "${name}" already exists in your catalog.` });

    const created = await medicineRepo.create({
      name, genericName, category, dosageForm, strength,
      manufacturerId: org,
      status: 'active',
    });
    res.status(201).json({ medicine: created });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/platform/medicines/:id — remove a catalog medicine.
 *  Blocked while batches referencing it still exist. */
router.delete('/medicines/:id', auth, requireRole(['manufacturer', 'admin']), async (req, res, next) => {
  try {
    const med = await medicineRepo.findOne({ id: req.params.id });
    if (!med) return res.status(404).json({ error: 'Medicine not found' });
    if (req.user.role !== 'admin' && med.manufacturerId !== (req.user.organization || req.user.name)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { items: linked } = await batchRepo.find({ filter: { medicineId: med.id }, limit: 1 });
    if (linked.length > 0) {
      return res.status(409).json({ error: 'This medicine has batches — delete is blocked. Recall or expire the batches first.' });
    }
    await medicineRepo.deleteById(med.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Batches — REAL production batches (manufacturer flows).
// Manufacturers see only their own batches (organization from the JWT);
// admin sees all. Creation also upserts the medicine into the catalog so the
// batch's medicine reference resolves everywhere. Status changes (recall /
// expire) are visible to every login that reads batches.
// ---------------------------------------------------------------------------

const batchCreateSchema = {
  body: z.object({
    medicineName: z.string().trim().min(2),
    genericName: z.string().trim().default(''),
    category: z.string().trim().default('Other'),
    dosageForm: z.string().trim().default(''),
    strength: z.string().trim().default(''),
    batchNumber: z.string().trim().min(3).max(60),
    manufacturingDate: z.string().min(8),
    expiryDate: z.string().min(8),
    quantityProduced: z.number().int().positive(),
    storageConditions: z.string().trim().max(300).optional(),
    price: z.number().nonnegative().optional(),
    description: z.string().max(500).optional(),
  }).refine((b) => new Date(b.expiryDate) > new Date(b.manufacturingDate), {
    message: 'Expiry must be after manufacturing date', path: ['expiryDate'],
  }),
};

const batchStatusSchema = {
  body: z.object({
    status: z.enum(['in_production', 'released', 'quarantine', 'expired', 'recalled']),
    reason: z.string().trim().max(300).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
};

function batchToUi(b) {
  return {
    id: b.id,
    medicineId: b.medicineId || '',
    medicineName: b.medicineName || '',
    batchNumber: b.batchNumber,
    manufacturingDate: b.manufacturingDate || '',
    expiryDate: b.expiryDate || '',
    quantityProduced: b.quantityProduced ?? 0,
    availableQuantity: b.availableQuantity ?? 0,
    status: b.status || 'released',
    qrCode: `https://pharmachain.app/verify/${encodeURIComponent(b.batchNumber)}`,
    recallReason: b.recallReason || undefined,
    organizationId: b.manufacturerId || '',
    createdAt: b.createdAt || new Date().toISOString(),
  };
}

/** GET /api/platform/batches — manufacturer's own batches (admin: all). */
router.get('/batches', auth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { manufacturerId: req.user.organization || '__none__' };
    const { items } = await batchRepo.find({ filter, sort: { createdAt: -1 }, limit: 500 });
    res.json({ batches: items.map(batchToUi) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/platform/batches — register a production batch (manufacturer).
 * Upserts a matching catalog medicine (by name+manufacturer org) so the
 * batch references a stable medicineId.
 */
router.post('/batches', auth, requireRole(['manufacturer', 'admin']), validate(batchCreateSchema), async (req, res, next) => {
  try {
    const b = req.body;
    // Organization/manufacturer identity is always derived from the verified JWT.
    const org = req.user.organization || req.user.name;
    if (!org) return res.status(422).json({ error: 'Your account has no organization; a batch cannot be created.' });

    // Validate against the existing reference/master system before creating any
    // catalog or batch record. This is an identity check, not medical approval.
    const medicineValidation = drugDb.validateMedicine(b.medicineName, b.strength);
    if (!medicineValidation.exists) {
      return res.status(422).json({
        error: `Medicine "${b.medicineName}" was not found in the medicine master. No batch was created.`,
        medicineValidation,
      });
    }

    // Batch numbers are globally unique (schema-level); never overwrite.
    const dupe = await batchRepo.findOne({ batchNumber: b.batchNumber });
    if (dupe) return res.status(409).json({ error: `Batch ${b.batchNumber} already exists.` });

    // This is the application's organization catalog, not the reference master.
    // It is created only after master validation succeeds, and is never used to
    // make an unknown medicine appear valid.
    let med = await medicineRepo.findOne({ name: medicineValidation.matchedName, manufacturerId: org });
    if (!med) {
      med = await medicineRepo.create({
        name: medicineValidation.matchedName,
        genericName: b.genericName || medicineValidation.genericName || '',
        category: b.category || medicineValidation.category || 'Other',
        dosageForm: b.dosageForm || medicineValidation.dosageForm || '',
        strength: b.strength || '',
        manufacturerId: org,
        status: 'active',
      });
    }

    // Fuzzy, alias, uncertain, or unlisted-strength matches remain in
    // quarantine. Only a confident match may enter the released QR1 state.
    const initialStatus = medicineValidation.needsVerification ? 'quarantine' : 'released';
    const created = await batchRepo.create({
      medicineId: med.id,
      medicineName: medicineValidation.matchedName || b.medicineName,
      manufacturerId: org,
      batchNumber: b.batchNumber,
      manufacturingDate: b.manufacturingDate,
      expiryDate: b.expiryDate,
      quantityProduced: b.quantityProduced,
      availableQuantity: b.quantityProduced,
      status: initialStatus,
    });

    res.status(201).json({
      batch: batchToUi(created),
      medicineValidation: {
        ...medicineValidation,
        note: 'Master-database existence is not medical approval.'
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/platform/batches/:id/status — recall / expire / release.
 * Status is global: every login reading batches sees the change.
 */
router.patch('/batches/:id/status', auth, requireRole(['manufacturer', 'admin']), validate(batchStatusSchema), async (req, res, next) => {
  try {
    const batch = await batchRepo.findOne({ id: req.params.id });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (req.user.role !== 'admin' && batch.manufacturerId !== req.user.organization) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { status, reason, severity } = req.body;
    const patch = { status };
    if (status === 'recalled') {
      if (reason) patch.recallReason = reason;
      if (severity) patch.recallSeverity = severity;
    } else {
      // Leaving the recalled state clears the recall annotation.
      patch.recallReason = '';
      patch.recallSeverity = '';
    }

    const updated = await batchRepo.updateById(batch.id, patch);
    if (!updated) return res.status(404).json({ error: 'Batch not found' });

    // Propagate to every org's inventory lot of this batch number so dealer
    // and hospital stock pages show the recall without any manual step.
    if (status === 'recalled' || batch.status === 'recalled') {
      const lotPatch = status === 'recalled'
        ? { status: 'recalled' }
        : { status: 'released' };
      const { items: lots } = await inventoryRepo.find({ filter: { batchNumber: batch.batchNumber }, limit: 1000 });
      await Promise.all(lots.map((lot) => inventoryRepo.updateById(lot.id, lotPatch)));
    }

    res.json({ batch: batchToUi(updated) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/verify/:code — REAL batch verification by batch number
 * (also accepts a full verification URL — everything after the last / is
 * used). PUBLIC: this is the backend behind the QR printed on the package,
 * which anyone with a phone camera scans — verification is performed here,
 * in the database, never in the client. Caller identity is attributed when
 * a valid Bearer token is present; every scan is logged to qr_verifications.
 */
router.get('/verify/:code', optionalAuth, async (req, res, next) => {
  try {
    const raw = decodeURIComponent(req.params.code || '').trim();
    const code = raw.split('/').filter(Boolean).pop() || raw;
    const batch = await batchRepo.findOne({ batchNumber: code });

    if (!batch) {
      await verificationRepo.create({
        code, result: 'invalid', batchId: '', batchNumber: code,
        verifiedBy: req.user?.name || '', organizationId: req.user?.organization || '',
      });
      return res.status(404).json({ error: 'Unknown batch — this medicine could not be verified.' });
    }

    const expired = batch.expiryDate && new Date(batch.expiryDate).getTime() < Date.now();
    const recalled = batch.status === 'recalled';
    // 'released' is the only backend-confirmed state; everything else is a
    // real, known batch whose verification is not complete (⚠ state).
    const pendingVerification = !recalled && !expired && batch.status !== 'released';
    const result = recalled ? 'recalled' : expired ? 'expired' : pendingVerification ? 'quarantine' : 'authentic';

    await verificationRepo.create({
      code, result, batchId: batch.id, batchNumber: batch.batchNumber,
      verifiedBy: req.user?.name || '', organizationId: req.user?.organization || '',
    });

    res.json({
      verification: {
        result,
        message:
          result === 'authentic' ? 'This medicine appears to be authentic.'
          : result === 'expired' ? 'This medicine has expired.'
          : result === 'recalled' ? 'This batch has been recalled.'
          : 'This batch is recorded in PharmaChain but has not completed verification yet.',
        batch: {
          id: batch.id,
          batchNumber: batch.batchNumber,
          medicineName: batch.medicineName || batch.medicineId,
          genericName: '',
          manufacturer: batch.manufacturerId || '',
          manufacturingDate: batch.manufacturingDate
            ? new Date(batch.manufacturingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '',
          expiryDate: batch.expiryDate
            ? new Date(batch.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '',
          availableQuantity: batch.availableQuantity ?? 0,
          status: batch.status,
          qrPayload: batch.qrCode || `https://pharmachain.app/verify/${encodeURIComponent(batch.batchNumber)}`,
          recallReason: batch.recallReason || undefined,
          // The package/serial identifier this system actually has is the
          // batch code — no per-package serial subsystem exists.
          packageId: batch.batchNumber,
          // Integrity/blockchain status: surfaced only if the Batch record
          // carries a real anchor. The schema has none today, so this stays
          // null and the UI shows "Not available" — never fabricated.
          integrity: null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/platform/verifications — recent scan log (history table). */
router.get('/verifications', auth, async (req, res, next) => {
  try {
    const { items } = await verificationRepo.find({ filter: {}, sort: { createdAt: -1 }, limit: 50 });
    res.json({ verifications: items });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/recalls — recall cases derived from REAL recalled batches.
 * Global on purpose: a recall issued by any manufacturer is visible to every
 * role (manufacturer list, dealer/hospital/customer alerts, admin oversight).
 * - admin: all recalled batches
 * - manufacturer: own recalled batches
 * - other roles: ALL recalled batches too — recalls are safety information,
 *   not commercial data, so every org gets full visibility (reason + severity).
 */
router.get('/recalls', auth, async (req, res, next) => {
  try {
    const filter = { status: 'recalled' };
    const { items } = await batchRepo.find({ filter, sort: { createdAt: -1 }, limit: 300 });
    res.json({
      recalls: items.map((b) => ({
        id: `RCL-${b.id}`,
        batchId: b.id,
        batchNumber: b.batchNumber,
        medicineName: b.medicineName || b.medicineId,
        manufacturerId: b.manufacturerId || '',
        reason: b.recallReason || 'No reason recorded',
        severity: b.recallSeverity || 'high',
        status: 'open',
        affectedQuantity: b.quantityProduced ?? 0,
        createdAt: b.createdAt || new Date().toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Sales — REAL POS records (dealer/pharmacy). Org-scoped: a dealer sees its
// own sales; admin sees all. Recording a sale also deducts the quantity from
// the org's matching inventory lot (earliest expiry first) so stock pages and
// dashboards agree across logins.
// ---------------------------------------------------------------------------

const saleCreateSchema = {
  body: z.object({
    medicineName: z.string().trim().min(2).max(200),
    batchNumber: z.string().trim().max(60).default(''),
    customerName: z.string().trim().max(120).default('Walk-in customer'),
    quantity: z.number().int().min(1),
    unitPrice: z.number().nonnegative().default(0),
  }),
};

function saleToUi(s) {
  return {
    id: s.id,
    dealerId: s.organizationId || '',
    dealerName: s.dealerName || '',
    batchId: s.batchNumber || '',
    medicineId: s.medicineName || '',
    medicineName: s.medicineName || '',
    customerName: s.customerName || 'Walk-in customer',
    quantity: s.quantity ?? 0,
    unitPrice: s.unitPrice ?? 0,
    total: s.total ?? 0,
    timestamp: s.createdAt || new Date().toISOString(),
  };
}

/** GET /api/platform/sales — caller's org sales (admin: all), newest first. */
router.get('/sales', auth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { organizationId: req.user.organization || '__none__' };
    const { items } = await saleRepo.find({ filter, sort: { createdAt: -1 }, limit: 500 });
    res.json({ sales: items.map(saleToUi) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/platform/sales — record a sale and deduct stock (FIFO over the
 * org's released lots of the named medicine, earliest expiry first). The
 * deduction and the sale record happen on the server so every login sees a
 * consistent picture; insufficient stock is rejected with 409.
 */
router.post('/sales', auth, requireRole('dealer', 'pharmacy', 'hospital', 'admin'), validate(saleCreateSchema), async (req, res, next) => {
  try {
    const { medicineName, batchNumber, customerName, quantity, unitPrice } = req.body;
    const org = req.user.organization || req.user.name;
    if (!org) return res.status(422).json({ error: 'Your account has no organization; sales cannot be recorded.' });

    // Find matching released lots (optionally pinned to a batch), earliest
    // expiry first — mirrors the dispensing FIFO rule.
    const lotFilter = {
      organizationId: org,
      medicineName: medicineName,
      status: 'released',
      ...(batchNumber ? { batchNumber } : {}),
    };
    const { items: lots } = await inventoryRepo.find({ filter: lotFilter, sort: { expiryDate: 1 } });
    const available = lots.reduce((sum, l) => sum + (l.availableQuantity || 0), 0);
    if (available < quantity) {
      return res.status(409).json({
        error: `Insufficient stock: ${available} unit(s) of ${medicineName} available, ${quantity} requested.`,
      });
    }

    // FIFO deduction across lots.
    let remaining = quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.availableQuantity || 0);
      if (take > 0) {
        await inventoryRepo.updateById(lot.id, { availableQuantity: lot.availableQuantity - take });
        remaining -= take;
      }
    }

    const created = await saleRepo.create({
      organizationId: org,
      dealerName: req.user.name || '',
      medicineName,
      batchNumber: batchNumber || (lots[0] ? lots[0].batchNumber : ''),
      customerName: customerName || 'Walk-in customer',
      quantity,
      unitPrice: unitPrice || 0,
      total: Number(((unitPrice || 0) * quantity).toFixed(2)),
    });

    res.status(201).json({ sale: saleToUi(created) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
