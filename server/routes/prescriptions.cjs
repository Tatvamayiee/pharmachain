const express = require('express');
const z = require('zod');
const multer = require('multer');
const { auth, requireRole } = require('../middleware/auth.cjs');
const validate = require('../middleware/validate.cjs');
const { prescriptionRepo, auditRepo, createAudit } = require('../services/prescriptionService.cjs');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');
const fileStorageService = require('../services/fileStorageService.cjs');
const huggingfacePrescriptionAnalyzer = require('../services/huggingfacePrescriptionAnalyzer.cjs');
const multiAiAnalysis = require('../services/multiAiAnalysis.cjs');
const randomForestComparison = require('../services/randomForestComparison.cjs');
const trainingData = require('../services/trainingData.cjs');
const blockchainRegistry = require('../services/blockchainRegistry.cjs');
const patientRecordService = require('../services/patientRecordService.cjs');

const router = express.Router();
const allowedRoles = ['dealer', 'hospital', 'admin'];
const inventoryRepo = createRepository({ name: 'inventory_batches', model: models.InventoryBatch, prefix: 'IB' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Authorization helper to ensure users only see their organization's prescriptions (except admin)
function canAccess(req, prescription) {
  if (req.user.role === 'admin') return true;
  return req.user.organization === prescription.organizationId;
}

const createSchema = {
  body: z.object({
    patientReference: z.string().min(1),
    patientAge: z.number().min(0).max(130).optional(),
    patientGender: z.enum(['female', 'male', 'other', '']).optional(),
    prescriptionDate: z.string(),
    prescriberName: z.string().optional(),
    department: z.string().optional(),
    allergies: z.string().optional(),
    existingConditions: z.string().optional(),
    currentMedicines: z.string().optional(),
    createdByRole: z.enum(['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'admin', 'transport', 'pharmacy', '']).optional(),
  })
};

router.post('/', auth, requireRole(allowedRoles), validate(createSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const prescriptionId = `PRX-${Date.now()}`;
    const createdByRole = data.createdByRole || req.user.role || '';
    const p = await prescriptionRepo.create({
      prescriptionId,
      organizationId: req.user.organization || '',
      uploadedBy: req.user.id,
      createdByRole,
      ...data,
      status: 'uploaded',
    });

    if (data.allergies || data.existingConditions || data.currentMedicines) {
      try {
        await patientRecordService.upsertPatientContext({
          organizationId: req.user.organization || '',
          patientReference: data.patientReference,
          patientAge: data.patientAge,
          patientGender: data.patientGender,
          allergies: data.allergies || '',
          existingConditions: data.existingConditions || '',
          currentMedicines: data.currentMedicines || '',
        });
      } catch {
        // Non-fatal
      }
    }

    await createAudit(p.prescriptionId, req.user, 'CREATED', 'Prescription created');
    res.status(201).json(p);
  } catch (err) {
    next(err);
  }
});

const querySchema = {
  query: z.object({
    status: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  })
};

router.get('/', auth, requireRole(allowedRoles), validate(querySchema), async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') {
      filter.organizationId = req.user.organization;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const { items, total } = await prescriptionRepo.find({ filter, page: req.query.page, limit: req.query.limit, sort: { createdAt: -1 } });
    res.json({ items, total });
  } catch (err) {
    next(err);
  }
});

// ML training status must be mounted BEFORE /:id to prevent route clash
router.get('/ml-training-status', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const report = trainingData.datasetReport();
    const { entries, ...safeReport } = report;
    res.json(safeReport);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

const prescriptionPatchSchema = {
  body: z.object({
    medicines: z.array(z.record(z.unknown())).max(100).optional(),
    interactionAlerts: z.array(z.record(z.unknown())).max(200).optional(),
    dosageAlerts: z.array(z.record(z.unknown())).max(200).optional(),
    extractedText: z.string().max(100_000).optional(),
    analysisProvider: z.string().max(80).optional(),
    analysisModel: z.string().max(160).optional(),
    analysisConfidence: z.number().min(0).max(1).nullable().optional(),
    requiresHumanReview: z.boolean().optional(),
  }).strict(),
};

router.patch('/:id', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const prescription = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, prescription)) return res.status(403).json({ error: 'Forbidden' });
    req.prescription = prescription;
    return next();
  } catch (err) {
    return next(err);
  }
}, (req, res, next) => {
  const workflowFields = ['status', 'reviewChecklist', 'pharmacistReviewer', 'reviewNotes'];
  if (workflowFields.some((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field))) {
    return res.status(400).json({ error: 'Workflow fields must be changed through their dedicated endpoints.' });
  }
  return next();
}, validate(prescriptionPatchSchema), async (req, res, next) => {
  try {
    const updated = await prescriptionRepo.updateById(req.prescription.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const statusTransitions = {
  uploaded: ['processing'],
  processing: ['analyzed', 'needs_correction', 'safety_review_required'],
  analyzed: ['needs_correction', 'safety_review_required', 'clarification_requested'],
  needs_correction: ['processing', 'analyzed', 'safety_review_required'],
  safety_review_required: ['needs_correction', 'clarification_requested'],
  clarification_requested: ['needs_correction', 'safety_review_required'],
};
const statusSchema = {
  body: z.object({
    status: z.enum(['processing', 'analyzed', 'needs_correction', 'safety_review_required', 'clarification_requested']),
  }).strict(),
};

router.post('/:id/status', auth, requireRole(allowedRoles), validate(statusSchema), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });
    if (!(statusTransitions[p.status] || []).includes(req.body.status)) {
      return res.status(400).json({ error: `Cannot move prescription from ${p.status} to ${req.body.status}.` });
    }
    const updated = await prescriptionRepo.updateById(p.id, { status: req.body.status });
    await createAudit(p.prescriptionId, req.user, 'STATUS_CHANGED', `Status changed to ${req.body.status}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upload', auth, requireRole(allowedRoles), (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds the 10 MB limit.' });
      }
      return res.status(422).json({ error: err.message });
    }
    try {
      const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
      if (!p) return res.status(404).json({ error: 'Prescription not found' });
      if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(422).json({ error: 'Empty or missing file.' });
      }

      try {
        fileStorageService.validateImageInput({
          mimetype: req.file.mimetype,
          size: req.file.buffer.length,
          buffer: req.file.buffer,
        });
      } catch (valErr) {
        return res.status(valErr.status || 422).json({ error: valErr.message });
      }

      const fileMeta = await fileStorageService.saveFile({
        organizationId: p.organizationId,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
      });

      const updated = await prescriptionRepo.updateById(p.id, { fileMetadata: fileMeta });
      await createAudit(p.prescriptionId, req.user, 'FILE_UPLOADED', 'Prescription file uploaded');
      res.status(201).json({ file: fileMeta, prescription: updated });
    } catch (e) {
      next(e);
    }
  });
});

router.get('/:id/file', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    if (!p.fileMetadata || !p.fileMetadata.fileId) {
      return res.status(404).json({ error: 'No file found for this prescription' });
    }

    const buffer = await fileStorageService.readFile({
      organizationId: p.organizationId,
      fileId: p.fileMetadata.fileId,
    });

    res.setHeader('Content-Type', p.fileMetadata.mimetype || 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/patient-context', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const ctx = await patientRecordService.getPatientContext({
      organizationId: p.organizationId,
      patientReference: p.patientReference,
    });

    if (!ctx) {
      return res.json({
        patientReference: p.patientReference,
        patientAge: p.patientAge,
        patientGender: p.patientGender,
        allergies: p.allergies || '',
        existingConditions: p.existingConditions || '',
        currentMedicines: p.currentMedicines || '',
      });
    }

    res.json(ctx);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/analyze', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    let buffer = null;
    let mimetype = null;

    if (req.body && req.body.image && req.body.image.data) {
      buffer = Buffer.from(req.body.image.data, 'base64');
      mimetype = req.body.image.mimetype || 'image/png';
    } else if (p.fileMetadata && p.fileMetadata.fileId) {
      try {
        buffer = await fileStorageService.readFile({ organizationId: p.organizationId, fileId: p.fileMetadata.fileId });
        mimetype = p.fileMetadata.mimetype || 'image/png';
      } catch {
        return res.status(400).json({ error: 'Stored prescription file could not be read' });
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'No prescription file was uploaded.' });
    }

    try {
      huggingfacePrescriptionAnalyzer.validateImage({ buffer, mimetype });
    } catch (valErr) {
      return res.status(valErr.status || 422).json({ error: valErr.message });
    }

    if (!huggingfacePrescriptionAnalyzer.isConfigured()) {
      return res.status(501).json({ error: huggingfacePrescriptionAnalyzer.configurationError() });
    }

    try {
      const result = await huggingfacePrescriptionAnalyzer.analyzeImage(buffer, mimetype);
      const updateData = {
        status: 'analyzed',
        aiExtraction: result,
        analysisModel: result._meta ? result._meta.model : '',
        analysisConfidence: result.overall_confidence,
        analysisProvider: result._meta ? result._meta.provider : 'huggingface',
        analysisFailed: false,
        medicines: (result.medicines || []).map((m, idx) => ({
          id: `m_${idx}_${Date.now()}`,
          name: m.name || '',
          strength: m.strength || '',
          dosage: m.dosage || '',
          frequency: m.frequency || '',
          duration: m.duration || '',
          route: m.route || '',
          instructions: m.instructions || '',
          confidence: m.confidence || 0.5,
          matchStatus: m.confidence >= 0.75 ? 'matched' : m.confidence >= 0.4 ? 'possible_match' : 'needs_review',
        })),
        requiresHumanReview: true,
      };

      const updated = await prescriptionRepo.updateById(p.id, updateData);
      await createAudit(p.prescriptionId, req.user, 'ANALYSIS_COMPLETED', `Analyzed by ${updateData.analysisProvider} (${updateData.analysisModel})`);
      res.json(updated);
    } catch (err) {
      await prescriptionRepo.updateById(p.id, { analysisFailed: true });
      const status = err.status || 502;
      return res.status(status).json({ error: err.message });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/:id/providers', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const providers = multiAiAnalysis.getAvailableProviders();
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reanalyze', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const providerId = req.body.provider;
    if (!providerId) return res.status(400).json({ error: 'Provider is required' });

    let buffer = null;
    let mimetype = 'image/png';

    if (p.fileMetadata && p.fileMetadata.fileId) {
      buffer = await fileStorageService.readFile({
        organizationId: p.organizationId,
        fileId: p.fileMetadata.fileId,
      });
      mimetype = p.fileMetadata.mimetype || 'image/png';
    } else if (req.body.image && req.body.image.data) {
      buffer = Buffer.from(req.body.image.data, 'base64');
      mimetype = req.body.image.mimetype || 'image/png';
    } else {
      return res.status(400).json({ error: 'No stored image available to re-analyze.' });
    }

    const reanalysisRaw = await multiAiAnalysis.analyzeWithProvider(buffer, mimetype, providerId);
    const reanalysis = {
      provider: providerId,
      model: reanalysisRaw.model,
      confidence: reanalysisRaw.overallConfidence,
      medicines: reanalysisRaw.medicines,
      doctor: reanalysisRaw.doctor,
      patient: reanalysisRaw.patient,
      date: reanalysisRaw.date,
      analyzedAt: reanalysisRaw.analyzedAt,
    };

    const primaryMeds = p.medicines || [];
    const primaryAnalysis = {
      date: p.prescriptionDate || '',
      doctor: { name: p.prescriberName || '' },
      patient: { name: p.patientReference || '', age: p.patientAge, gender: p.patientGender },
      medicines: primaryMeds,
    };

    const comparison = multiAiAnalysis.compareAnalyses(primaryAnalysis, reanalysisRaw);

    const history = Array.isArray(p.analysisHistory) ? [...p.analysisHistory] : [];
    history.push(reanalysis);

    const updated = await prescriptionRepo.updateById(p.id, {
      analysisHistory: history,
      lastReanalysisProvider: providerId,
      lastReanalysisAt: new Date().toISOString(),
    });

    await createAudit(p.prescriptionId, req.user, 'REANALYZED', `Re-analyzed with ${providerId}`);
    res.json({ success: true, reanalysis, comparison, prescription: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/parallel-analysis', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const ocrProvider = req.body.ocrProvider || 'paddleocr';
    const aiProvider = req.body.aiProvider || 'gemini';

    let buffer = null;
    let mimetype = 'image/png';

    if (p.fileMetadata && p.fileMetadata.fileId) {
      buffer = await fileStorageService.readFile({
        organizationId: p.organizationId,
        fileId: p.fileMetadata.fileId,
      });
      mimetype = p.fileMetadata.mimetype || 'image/png';
    } else if (req.body.image && req.body.image.data) {
      buffer = Buffer.from(req.body.image.data, 'base64');
      mimetype = req.body.image.mimetype || 'image/png';
    } else {
      return res.status(400).json({ error: 'No stored image available for parallel analysis.' });
    }

    const [ocrResult, aiResult] = await Promise.all([
      multiAiAnalysis.analyzeWithProvider(buffer, mimetype, ocrProvider),
      multiAiAnalysis.analyzeWithProvider(buffer, mimetype, aiProvider),
    ]);

    const comparison = multiAiAnalysis.compareAnalyses(ocrResult, aiResult);
    const features = randomForestComparison.buildFeatureVector(ocrResult, aiResult, comparison);

    const parallelSnapshot = {
      features,
      fieldComparison: comparison,
      providers: { ocr: ocrProvider, ai: aiProvider },
      startedAt: new Date().toISOString(),
      ocrMedicines: ocrResult.medicines,
      aiMedicines: aiResult.medicines,
    };

    const updated = await prescriptionRepo.updateById(p.id, {
      parallelAnalysis: parallelSnapshot,
    });

    res.json({ success: true, parallelAnalysis: parallelSnapshot, prescription: updated });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = {
  body: z.object({
    checklist: z.record(z.boolean()),
    notes: z.string().optional()
  })
};

router.post('/:id/review', auth, requireRole(allowedRoles), validate(reviewSchema), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });
    
    const updated = await prescriptionRepo.updateById(p.id, {
      reviewChecklist: req.body.checklist,
      reviewNotes: req.body.notes || '',
      pharmacistReviewer: req.user.name || req.user.email || 'Pharmacist',
    });
    
    await createAudit(p.prescriptionId, req.user, 'REVIEWED', 'Pharmacist review saved');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const medicines = req.body.medicines;
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(422).json({ error: 'medicines array is required for confirmation' });
    }

    const confirmedAt = new Date().toISOString();
    const confirmedBy = req.user.name || req.user.email || req.user.id;

    const hash = blockchainRegistry.prescriptionHash({
      prescriptionId: p.prescriptionId,
      patientReference: p.patientReference,
      prescriptionDate: p.prescriptionDate,
      medicines,
      status: 'approved',
      pharmacistReviewer: confirmedBy,
    });

    if (p.parallelAnalysis && p.parallelAnalysis.features && p.parallelAnalysis.fieldComparison) {
      try {
        trainingData.captureTrainingRow({
          prescriptionId: p.prescriptionId,
          features: p.parallelAnalysis.features,
          fieldComparison: p.parallelAnalysis.fieldComparison,
          confirmedMedicines: medicines,
          aiMedicines: p.medicines,
          confirmedBy,
          confirmedAt,
        });
      } catch (trainErr) {
        console.warn('Training row capture warning:', trainErr.message);
      }
    }

    const updated = await prescriptionRepo.updateById(p.id, {
      confirmedMedicines: medicines,
      confirmedAt,
      confirmedBy,
      confirmedHash: hash,
    });

    await createAudit(p.prescriptionId, req.user, 'CONFIRMED', 'Prescription confirmed by pharmacist');
    res.json({ hash, prescription: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });
    
    if (p.status !== 'safety_review_required') {
      return res.status(400).json({ error: 'Prescription must pass safety review before approval.' });
    }
    if (!p.reviewChecklist || !p.reviewChecklist.decisionConfirmed) {
      return res.status(400).json({ error: 'Cannot approve without completing checklist' });
    }
    
    const hasCriticalUnresolved = (p.interactionAlerts || []).some(a => a.severity === 'critical' && !a.resolved);
    if (hasCriticalUnresolved) {
      return res.status(400).json({ error: 'Cannot approve with unresolved critical alerts' });
    }

    const updated = await prescriptionRepo.updateById(p.id, { status: 'approved' });
    await createAudit(p.prescriptionId, req.user, 'APPROVED', 'Prescription approved');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const rejectSchema = {
  body: z.object({
    reason: z.string().min(1)
  })
};

router.post('/:id/reject', auth, requireRole(allowedRoles), validate(rejectSchema), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });
    if (['dispensed', 'cancelled'].includes(p.status)) {
      return res.status(400).json({ error: `Cannot reject a ${p.status} prescription.` });
    }

    const updated = await prescriptionRepo.updateById(p.id, { status: 'rejected' });
    await createAudit(p.prescriptionId, req.user, 'REJECTED', `Rejected: ${req.body.reason}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const clarificationSchema = {
  body: z.object({
    recipientType: z.string(),
    message: z.string().min(1)
  })
};

router.post('/:id/clarification', auth, requireRole(allowedRoles), validate(clarificationSchema), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prescriptionRepo.updateById(p.id, { status: 'clarification_requested' });
    await createAudit(p.prescriptionId, req.user, 'CLARIFICATION_REQUESTED', `To ${req.body.recipientType}: ${req.body.message}`);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/dispense', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    if (p.status === 'dispensed') {
      return res.status(400).json({ error: 'Cannot dispense already dispensed prescription' });
    }
    if (p.status !== 'approved') {
      return res.status(400).json({ error: 'Cannot dispense unless approved' });
    }

    const meds = Array.isArray(p.medicines) ? p.medicines : [];
    const deductedMeds = [];
    const unfulfilledMeds = [];
    let inventoryDeducted = false;

    for (const med of meds) {
      const medName = med.name || med.matchedName || '';
      const neededQty = Number(med.quantity) || 1;
      const lotsResult = await inventoryRepo.find({
        filter: {
          organizationId: p.organizationId,
          status: 'released',
        },
        limit: 100,
      });

      const matchingLots = (lotsResult.items || [])
        .filter((lot) => lot.availableQuantity > 0 && lot.medicineName.toLowerCase() === medName.toLowerCase())
        .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      let remainingToFulfill = neededQty;
      const lotsUsed = [];

      for (const lot of matchingLots) {
        if (remainingToFulfill <= 0) break;
        const take = Math.min(lot.availableQuantity, remainingToFulfill);
        lot.availableQuantity -= take;
        await inventoryRepo.updateById(lot.id, { availableQuantity: lot.availableQuantity });
        lotsUsed.push({ batchNumber: lot.batchNumber, deducted: take });
        remainingToFulfill -= take;
      }

      const fulfilledQty = neededQty - remainingToFulfill;
      if (fulfilledQty > 0) {
        inventoryDeducted = true;
        deductedMeds.push({
          name: medName,
          requested: neededQty,
          fulfilled: fulfilledQty,
          lots: lotsUsed,
        });
      }
      if (remainingToFulfill > 0) {
        unfulfilledMeds.push({
          name: medName,
          requested: neededQty,
          unfulfilled: remainingToFulfill,
        });
      }
    }

    const dispensingRecord = {
      dispensedAt: new Date().toISOString(),
      dispensedBy: req.user.name || req.user.email,
      medicines: deductedMeds,
      unfulfilled: unfulfilledMeds,
    };

    const updated = await prescriptionRepo.updateById(p.id, {
      status: 'dispensed',
      dispensingRecord,
    });

    await createAudit(p.prescriptionId, req.user, 'DISPENSED', 'Prescription dispensed');
    res.json({
      message: 'Prescription dispensed successfully',
      prescription: updated,
      inventoryDeducted,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/audit', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    const audits = await auditRepo.find({ filter: { prescriptionId: req.params.id }, sort: { createdAt: 1 } });
    res.json(audits.items);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/blockchain/register', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    if (!p.confirmedHash) {
      return res.status(400).json({ error: 'Prescription must be confirmed before registering on blockchain' });
    }

    if (!blockchainRegistry.contractConfigured()) {
      return res.status(501).json({ error: 'Blockchain registry is not configured' });
    }

    const tx = await blockchainRegistry.registerHash(p.prescriptionId, p.confirmedHash);
    const updated = await prescriptionRepo.updateById(p.id, {
      blockchain: tx,
    });

    await createAudit(p.prescriptionId, req.user, 'BLOCKCHAIN_ANCHORED', `Anchored on blockchain: ${tx.transactionHash}`);
    res.json({ transaction: tx, prescription: updated });
  } catch (err) {
    const status = err.status || 502;
    res.status(status).json({ error: err.message });
  }
});

router.get('/:id/blockchain/verify', auth, requireRole(allowedRoles), async (req, res, next) => {
  try {
    const p = await prescriptionRepo.findOne({ prescriptionId: req.params.id });
    if (!p) return res.status(404).json({ error: 'Prescription not found' });
    if (!canAccess(req, p)) return res.status(403).json({ error: 'Forbidden' });

    if (!blockchainRegistry.contractConfigured()) {
      return res.status(501).json({ error: 'Blockchain registry is not configured' });
    }

    const outcome = await blockchainRegistry.verifyHash(p.prescriptionId, p.confirmedHash || '');
    res.json({
      verified: outcome.matches,
      registered: outcome.registered,
      onChainHash: outcome.onChainHash,
      localHash: p.confirmedHash,
      reason: outcome.matches ? 'Hash matches on-chain record' : 'Hash does not match or record not found on blockchain',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
