const express = require('express');
const z = require('zod');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const drugDb = require('../services/drugDatabaseService.cjs');

const router = express.Router();

router.get('/search', auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').slice(0, 120);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    res.json({ items: drugDb.searchMedicines(q, limit), source: 'reference_dataset' });
  } catch (err) {
    next(err);
  }
});

const interactionsSchema = {
  body: z.object({
    medicines: z.array(z.string().min(1)).min(1).max(30),
  }),
};

router.post('/interactions/check', auth, validate(interactionsSchema), async (req, res, next) => {
  try {
    const result = drugDb.checkInteractions(req.body.medicines);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const dosageSchema = {
  body: z.object({
    medicineName: z.string().min(1),
    strength: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    quantity: z.number().optional(),
    patientAge: z.number().min(0).max(130).optional(),
  }),
};

router.post('/dosage/validate', auth, validate(dosageSchema), async (req, res, next) => {
  try {
    const result = drugDb.validateDosage(req.body);
    res.json({ ...result, source: 'reference_dataset' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
