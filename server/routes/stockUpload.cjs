// ---------------------------------------------------------------------------
// Manufacturer stock upload — CSV/XLSX → real server data.
// One server endpoint (POST /api/platform/stock/upload, manufacturer/admin
// only) parses the file, validates every row against the medicine master and
// zod, upserts the medicine catalog entry and creates the Batch (the system's
// stock unit). Rows that fail validation are reported per-row; valid rows are
// still imported. Uses the existing repos/zod/validate/auth stack only.
// ---------------------------------------------------------------------------

const XLSX = require('xlsx');

const express = require('express');
const multer = require('multer');
const z = require('zod');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');
const drugDb = require('../services/drugDatabaseService.cjs');

const router = express.Router();
const medicineRepo = createRepository({ name: 'medicine', model: models.Medicine, prefix: 'MED' });
const batchRepo = createRepository({ name: 'batch', model: models.Batch, prefix: 'BAT' });
const saleRepo = createRepository({ name: 'sale', model: models.Sale, prefix: 'SAL' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const headerHints = {
  medicineName: ['medicinename', 'name', 'medicine', 'productname', 'product', 'drugname', 'drug'],
  medicineCode: ['medicineid', 'medicinecode', 'code', 'sku', 'productcode', 'productid'],
  batchNumber: ['batchnumber', 'batch', 'batchno', 'batchid', 'lot', 'lotnumber'],
  quantity: ['quantity', 'qty', 'stock', 'stockquantity', 'units'],
  expiryDate: ['expirydate', 'expiry', 'expirationdate', 'expiration', 'expdate', 'exp'],
  manufacturingDate: ['manufacturingdate', 'mfgdate', 'mfg', 'manufactureddate', 'manufacturedon'],
  manufacturer: ['manufacturer', 'manufacturername', 'maker'],
  strength: ['strength', 'potency'],
  genericName: ['genericname', 'generic', 'composition', 'salt'],
};

function normHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map a spreadsheet row (object keyed by original header) onto our fields.
function mapRow(row) {
  const out = {};
  for (const [field, hints] of Object.entries(headerHints)) {
    for (const key of Object.keys(row)) {
      if (hints.includes(normHeader(key))) { out[field] = row[key]; break; }
    }
  }
  return out;
}

function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);            // dd/mm/yyyy
  if (m1) { const [, d, m, y] = m1; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  const num = Number(s);
  if (Number.isFinite(num) && num > 20000 && num < 80000) {              // Excel serial
    const d = XLSX.SSF.parse_date_code(num);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const rowSchema = z.object({
  medicineName: z.string().trim().min(2).max(200),
  medicineCode: z.string().trim().max(60).default(''),
  batchNumber: z.string().trim().min(2).max(60),
  quantity: z.coerce.number().int('Quantity must be a whole number').positive('Quantity must be positive'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date is missing or not a valid date (use YYYY-MM-DD)'),
  manufacturingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  manufacturer: z.string().trim().max(200).default(''),
  strength: z.string().trim().max(100).default(''),
  genericName: z.string().trim().max(200).default(''),
});

/** POST /api/platform/stock/upload — multipart 'file' (csv/xlsx/xls). */
router.post('/stock/upload', auth, requireRole('manufacturer', 'admin'),
  upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(422).json({ error: 'No file received. Attach a CSV or Excel file in the "file" field.' });

      let wb;
      try {
        wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      } catch (e) {
        return res.status(422).json({ error: `Could not parse the file as CSV or Excel: ${e.message}` });
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return res.status(422).json({ error: 'The file has no sheets.' });

      // defval:'' keeps empty cells as '' so column mapping is stable.
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!rows.length) return res.status(422).json({ error: 'The file has no data rows.' });

      const org = req.user.organization || req.user.name;
      if (!org) return res.status(422).json({ error: 'Your account has no organization; stock cannot be uploaded.' });

      const added = [];
      const updated = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const lineNo = i + 2; // +2: header row + 1-indexing
        const mapped = mapRow(raw);
        const parsed = rowSchema.safeParse({
          medicineName: String(mapped.medicineName ?? '').trim(),
          medicineCode: String(mapped.medicineCode ?? '').trim(),
          batchNumber: String(mapped.batchNumber ?? '').trim(),
          quantity: mapped.quantity,
          expiryDate: toIsoDate(mapped.expiryDate) ?? '',
          manufacturingDate: toIsoDate(mapped.manufacturingDate) || undefined,
          manufacturer: String(mapped.manufacturer ?? '').trim(),
          strength: String(mapped.strength ?? '').trim(),
          genericName: String(mapped.genericName ?? '').trim(),
        });
        if (!parsed.success) {
          errors.push({ row: lineNo, medicineName: String(mapped.medicineName || '(missing name)'), error: parsed.error.issues.map((iss) => `${iss.path.join('.') || 'row'}: ${iss.message}`).join('; ') });
          continue;
        }
        const b = parsed.data;

        // Medicine-master existence check (identity, not medical approval) —
        // the same rule as single batch creation.
        const mv = drugDb.validateMedicine(b.medicineName, b.strength);
        if (!mv.exists) {
          errors.push({ row: lineNo, medicineName: b.medicineName, error: `Medicine "${b.medicineName}" was not found in the medicine master.` });
          continue;
        }
        const name = mv.matchedName || b.medicineName;

        const dup = await batchRepo.findOne({ batchNumber: b.batchNumber });
        if (dup) {
          if (dup.medicineName && name && dup.medicineName.toLowerCase() !== name.toLowerCase()) {
            errors.push({ row: lineNo, medicineName: b.medicineName, error: `Batch ${b.batchNumber} already exists for medicine ${dup.medicineName}; cannot reassign it to ${name}.` });
            continue;
          }
          // Update existing batch/stock instead of creating duplicates.
          await batchRepo.updateById(dup.id, {
            availableQuantity: (dup.availableQuantity || 0) + b.quantity,
            quantityProduced: (dup.quantityProduced || 0) + b.quantity,
            expiryDate: b.expiryDate,
          });
          updated.push({ id: dup.id, batchNumber: b.batchNumber, medicineName: name, quantityAdded: b.quantity });
          continue;
        }

        // Catalog medicine upsert (org-scoped), same as the single-create route.
        let med = await medicineRepo.findOne({ name, manufacturerId: org });
        if (!med) {
          med = await medicineRepo.create({
            name,
            genericName: b.genericName || mv.genericName || '',
            category: mv.category || 'Other',
            dosageForm: mv.dosageForm || '',
            strength: b.strength || '',
            manufacturerId: org,
            status: 'active',
          });
        }
        // Fuzzy/alias master matches stay in quarantine, mirroring the
        // single-create route: only a confident match enters the released state.
        const initialStatus = mv.needsVerification ? 'quarantine' : 'released';
        const created = await batchRepo.create({
          medicineId: med.id,
          medicineName: name,
          manufacturerId: org,
          batchNumber: b.batchNumber,
          manufacturingDate: b.manufacturingDate || undefined,
          expiryDate: b.expiryDate,
          quantityProduced: b.quantity,
          availableQuantity: b.quantity,
          status: initialStatus,
        });
        added.push({ id: created.id, batchNumber: b.batchNumber, medicineName: name, quantity: b.quantity, status: initialStatus });
      }

      res.json({ ok: true, total: rows.length, added: added.length, updated: updated.length, failed: errors.length, items: added, updatedItems: updated, errors });
    } catch (err) { next(err); }
  });

// ---------------------------------------------------------------------------
// Real stock availability for prescription scanning. Aggregate available
// quantity per medicine name across released Batch lots (the same store the
// upload fills). GET /api/platform/stock-availability?names=A|B|C
// ---------------------------------------------------------------------------
router.get('/stock-availability', auth, async (req, res, next) => {
  try {
    const names = String(req.query.names || '').split('|').map((s) => s.trim()).filter(Boolean).slice(0, 30);
    if (!names.length) return res.json({ availability: {} });
    const { items: batches } = await batchRepo.find({ filter: { status: 'released' } });
    const sums = new Map();
    for (const b of batches) {
      const key = String(b.medicineName || '').trim().toLowerCase();
      if (!key) continue;
      sums.set(key, (sums.get(key) || 0) + (b.availableQuantity || 0));
    }
    const availability = {};
    for (const n of names) {
      const s = sums.get(n.toLowerCase());
      let found = s !== undefined;
      let available = s ?? 0;
      if (!found) {
        // The scanner extracts brand text ("Dolo 650") while stock is stored
        // under the master-matched name ("Paracetamol") — resolve through the
        // same master the upload used before declaring the medicine absent.
        const mv = drugDb.validateMedicine(n);
        if (mv.exists && mv.matchedName) {
          const m = sums.get(mv.matchedName.toLowerCase());
          if (m !== undefined) { available = m; found = true; }
        }
      }
      availability[n] = { available, found };
    }
    res.json({ availability });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// Purchase — server verifies stock, deducts FIFO over released Batch lots
// (earliest expiry first), records the transaction in the existing Sale
// collection. Insufficient stock → 409, nothing is deducted.
// ---------------------------------------------------------------------------
const purchaseSchema = {
  body: z.object({
    medicineName: z.string().trim().min(2).max(200),
    quantity: z.number().int().min(1),
    customerName: z.string().trim().max(120).default('Walk-in customer'),
    unitPrice: z.number().nonnegative().default(0),
  }),
};

router.post('/purchase', auth, requireRole('dealer', 'pharmacy', 'hospital', 'distributor', 'customer', 'admin'),
  validate(purchaseSchema), async (req, res, next) => {
    try {
      const { medicineName, quantity, customerName, unitPrice } = req.body;
      // Resolve through the medicine master so a scanned brand name ("Dolo
      // 650 Tablet") matches lots stored under the master name ("Paracetamol")
      // — the same normalization the upload applied.
      let lotName = medicineName;
      const mv = drugDb.validateMedicine(medicineName);
      if (mv.exists && mv.matchedName) lotName = mv.matchedName;
      const { items: lots } = await batchRepo.find({
        filter: { medicineName: lotName, status: 'released' },
        sort: { expiryDate: 1 },
      });
      if (!lots.length && lotName !== medicineName) {
        const fallback = await batchRepo.find({
          filter: { medicineName, status: 'released' },
          sort: { expiryDate: 1 },
        });
        if (fallback.items.length) { lots.push(...fallback.items); lotName = medicineName; }
      }
      const available = lots.reduce((s, l) => s + (l.availableQuantity || 0), 0);
      if (available < quantity) {
        return res.status(409).json({
          error: `Insufficient stock: ${available} unit(s) of ${medicineName} available, ${quantity} requested.`,
          available,
        });
      }
      let remaining = quantity;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, lot.availableQuantity || 0);
        if (take > 0) {
          await batchRepo.updateById(lot.id, { availableQuantity: lot.availableQuantity - take });
          remaining -= take;
        }
      }
      const sale = await saleRepo.create({
        organizationId: req.user.organization || req.user.name || 'Direct purchase',
        dealerName: req.user.name || '',
        medicineName: lotName,
        batchNumber: lots[0] ? lots[0].batchNumber : '',
        customerName: customerName || 'Walk-in customer',
        quantity,
        unitPrice: unitPrice || 0,
        total: Number(((unitPrice || 0) * quantity).toFixed(2)),
      });
      res.status(201).json({ ok: true, purchase: { id: sale.id, medicineName, quantity }, remainingStock: available - quantity });
    } catch (err) { next(err); }
  });

module.exports = router;
