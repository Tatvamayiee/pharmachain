// ---------------------------------------------------------------------------
// RANDOM FOREST — ML comparison/confidence layer for the parallel OCR+AI
// prescription pipeline. Server-side only.
//
// HONEST STATUS (do not remove or soften):
//   There is currently NO trained Random Forest model and NO labeled
//   evaluation dataset in this repository. This module therefore reports
//   `trained: false` and `predict()` returns null. The parallel-analysis
//   pipeline falls back to a DETERMINISTIC heuristic comparison whose
//   behavior is transparent and auditable — no fabricated confidence, no
//   invented accuracy claims.
//
//   When a real labeled dataset exists, use `exportTrainingRow()` from the
//   review flow (every human pharmacist verification is a ground-truth
//   label) to accumulate data, then train offline (e.g. Python
//   scikit-learn / ONNX) and load the artifact via RANDOM_FOREST_MODEL_PATH.
//   `loadTrainedModel()` accepts a JSON model description and verifies its
//   shape — it NEVER synthesizes a model to pretend training happened.
//
// The Random Forest never sees the prescription image. It only ever
// receives the structured feature vector produced by buildFeatureVector().
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

// Optional: point RANDOM_FOREST_MODEL_PATH at a trained model artifact.
const MODEL_PATH = (process.env.RANDOM_FOREST_MODEL_PATH || '').trim();

// Expected feature keys — the single contract between the feature pipeline,
// training export, and inference. Order matters for the training CSV/JSONL.
const FEATURE_KEYS = [
  'ocrConfidence',        // 0..1  — PaddleOCR overall confidence
  'aiConfidence',         // 0..1  — AI model overall confidence
  'medicineCountDelta',   // |#ocrMeds - #aiMeds|
  'nameSimilarityMean',   // 0..1  — mean medicine-name similarity (trigram)
  'strengthMatchRate',    // 0..1  — fraction of paired strengths equal
  'dosageMatchRate',      // 0..1
  'frequencyMatchRate',   // 0..1
  'durationMatchRate',    // 0..1
  'routeMatchRate',       // 0..1
  'instructionSimilarity', // 0..1 — mean instruction text similarity
  'ocrTextQuality',       // 0..1  — share of OCR alnum chars that are letters
  'missingFieldRate',     // 0..1  — share of null/empty fields across both sides
  'disagreementCount',    // integer — raw field disagreement count
];

let loadedModel = null;

/**
 * Attempt to load a trained model artifact from disk. Returns metadata only
 * (never the model weights to callers) — used to report honest status.
 */
function loadTrainedModel() {
  if (!MODEL_PATH) return null;
  try {
    const raw = fs.readFileSync(MODEL_PATH, 'utf8');
    const model = JSON.parse(raw);
    if (!Array.isArray(model.trees) || model.trees.length === 0) {
      console.warn('[RANDOM-FOREST] Model file has no trees — ignoring (not trained).');
      return null;
    }
    if (!Array.isArray(model.featureKeys) || model.featureKeys.length !== FEATURE_KEYS.length) {
      console.warn('[RANDOM-FOREST] Model feature schema mismatch — ignoring.');
      return null;
    }
    loadedModel = model;
    console.log(`[RANDOM-FOREST] Loaded trained model: ${model.trees.length} trees, version ${model.version || 'unknown'}`);
    return model;
  } catch (err) {
    console.warn(`[RANDOM-FOREST] Could not load model (${err.message}) — running untrained.`);
    return null;
  }
}

/** Honest status report consumed by the API and the UI. */
function getStatus() {
  const model = loadedModel || (MODEL_PATH ? loadTrainedModel() : null);
  let dataset = null;
  try { dataset = require('./trainingData.cjs').datasetReport(); } catch (error) { console.warn('[RANDOM-FOREST] Dataset status unavailable:', error.message); }
  return {
    algorithm: 'random-forest',
    trained: !!model,
    modelVersion: model ? model.version || 'unknown' : null,
    treeCount: model ? model.trees.length : 0,
    datasetAvailable: !!dataset && dataset.validRows > 0,
    rawRows: dataset?.rawRows || 0,
    uniqueRows: dataset?.uniqueRows || 0,
    validRows: dataset?.validRows || 0,
    invalidRows: dataset?.invalidRows || 0,
    duplicateRows: dataset?.duplicateRows || 0,
    labeledRows: dataset?.labeledRows || 0,
    matchRows: dataset?.matchRows || 0,
    needsVerificationRows: dataset?.needsVerificationRows || 0,
    minimumRequired: dataset?.minimumRequired || 200,
    rowsNeeded: dataset?.rowsNeeded || 0,
    datasetReady: !!dataset?.datasetReady,
    trainingStatus: model ? 'trained' : 'not_trained',
    featureKeys: FEATURE_KEYS,
    trainingDataPath: path.join(__dirname, '..', 'ml', 'training-data'),
    note: model
      ? 'Trained model loaded — predictions are active.'
      : 'No trained Random Forest model or labeled dataset exists yet. The deterministic comparison layer is authoritative until a model is trained and validated on real pharmacist-verified data.',
  };
}

/** True only when a real trained model is loaded. */
function isTrained() {
  return !!(loadedModel || (MODEL_PATH && loadTrainedModel()));
}

// ---------------------------------------------------------------------------
// Feature generation — from two normalized analyses + their field comparison.
// Pure function; no I/O, no network, no image access.
// ---------------------------------------------------------------------------

function trigramSimilarity(a, b) {
  const sa = String(a || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const sb = String(b || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  const grams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    if (set.size === 0) set.add(s);
    return set;
  };
  const ga = grams(sa), gb = grams(sb);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  return inter / (ga.size + gb.size - inter);
}

function buildFeatureVector(ocrResult, aiResult, fieldComparison) {
  const ocrMeds = Array.isArray(ocrResult.medicines) ? ocrResult.medicines : [];
  const aiMeds = Array.isArray(aiResult.medicines) ? aiResult.medicines : [];

  const count = Math.min(ocrMeds.length, aiMeds.length) || Math.max(ocrMeds.length, aiMeds.length) || 1;
  const rate = (key) => {
    if (ocrMeds.length === 0 && aiMeds.length === 0) return 0;
    let eq = 0, tot = 0;
    const n = Math.max(ocrMeds.length, aiMeds.length);
    for (let i = 0; i < n; i++) {
      const a = ocrMeds[i]?.[key] ?? null;
      const b = aiMeds[i]?.[key] ?? null;
      if (a === null && b === null) { tot += 1; continue; }
      tot += 1;
      if (a !== null && b !== null && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()) eq += 1;
    }
    return tot ? eq / tot : 0;
  };

  let nameSim = 0;
  const nameN = Math.max(ocrMeds.length, aiMeds.length);
  for (let i = 0; i < nameN; i++) {
    nameSim += trigramSimilarity(ocrMeds[i]?.name, aiMeds[i]?.name);
  }
  nameSim = nameN ? nameSim / nameN : 0;

  const instrA = (ocrMeds.map((m) => m.instructions).filter(Boolean)).join(' ');
  const instrB = (aiMeds.map((m) => m.instructions).filter(Boolean)).join(' ');
  const instructionSim = instrA || instrB ? trigramSimilarity(instrA, instrB) : 0;

  const ocrText = String(ocrResult.rawOcrText || '');
  const letters = (ocrText.match(/[a-z]/gi) || []).length;
  const alnum = (ocrText.match(/[a-z0-9]/gi) || []).length;
  const ocrTextQuality = alnum ? letters / alnum : 0;

  const fields = Array.isArray(fieldComparison?.fields) ? fieldComparison.fields : [];
  const disagreements = fields.filter((f) => f.status === 'needs_verification').length;
  const nullish = (v) => v === null || v === undefined || v === '';
  const missingCount = fields.filter((f) => nullish(f.ai1) || nullish(f.ai2)).length;
  const missingFieldRate = fields.length ? missingCount / fields.length : 1;

  const vec = {
    ocrConfidence: Number(ocrResult.overallConfidence) || 0,
    aiConfidence: Number(aiResult.overallConfidence) || 0,
    medicineCountDelta: Math.abs(ocrMeds.length - aiMeds.length),
    nameSimilarityMean: Number(nameSim.toFixed(4)),
    strengthMatchRate: Number(rate('strength').toFixed(4)),
    dosageMatchRate: Number(rate('dosage').toFixed(4)),
    frequencyMatchRate: Number(rate('frequency').toFixed(4)),
    durationMatchRate: Number(rate('duration').toFixed(4)),
    routeMatchRate: Number(rate('route').toFixed(4)),
    instructionSimilarity: Number(instructionSim.toFixed(4)),
    ocrTextQuality: Number(ocrTextQuality.toFixed(4)),
    missingFieldRate: Number(missingFieldRate.toFixed(4)),
    disagreementCount: disagreements,
  };
  // Guarantee schema completeness.
  for (const k of FEATURE_KEYS) if (!(k in vec)) vec[k] = 0;
  return vec;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — transparent, auditable, used until a REAL trained
// model exists. Produces the comparison verdict + a confidence number that is
// honestly derived from agreement rates (NOT a fabricated ML probability).
// ---------------------------------------------------------------------------

function deterministicVerdict(features, fieldComparison) {
  const fields = Array.isArray(fieldComparison?.fields) ? fieldComparison.fields : [];
  const summary = fieldComparison?.summary || {
    totalFields: fields.length,
    matched: fields.filter((f) => f.status === 'match').length,
    disagreements: features.disagreementCount,
    agreementPercent: fields.length
      ? Math.round((fields.filter((f) => f.status === 'match').length / fields.length) * 100)
      : 100,
  };

  // Agreement-weighted confidence: the only quantity we can legitimately
  // compute without a trained model. Weighted so medicine fields matter more
  // than doctor/patient metadata.
  let weightSum = 0, matchSum = 0;
  for (const f of fields) {
    const w = f.category === 'medicine' || f.category === 'medicines' ? 2 : 1;
    weightSum += w;
    if (f.status === 'match') matchSum += w;
  }
  const confidence = weightSum > 0 ? Number((matchSum / weightSum).toFixed(4)) : 0;

  // Disagreement severity: any medicine-field disagreement, or ≥4 total
  // disagreements, forces the "needs_verification" verdict.
  const medDisagreements = fields.filter(
    (f) => (f.category === 'medicine' || f.category === 'medicines') && f.status === 'needs_verification',
  ).length;
  const verdict = medDisagreements > 0 || features.disagreementCount >= 4
    ? 'needs_verification'
    : 'match';

  const drivers = [];
  if (medDisagreements > 0) drivers.push(`${medDisagreements} medicine-field disagreement(s)`);
  if (features.disagreementCount > 0) drivers.push(`${features.disagreementCount} total disagreement(s)`);
  if (features.missingFieldRate > 0.2) drivers.push(`${Math.round(features.missingFieldRate * 100)}% of fields missing on at least one side`);
  if (features.ocrTextQuality < 0.6 && features.ocrConfidence < 0.5) drivers.push('low OCR text quality');

  return { verdict, confidence, summary, drivers, engine: 'deterministic' };
}

// ---------------------------------------------------------------------------
// Random Forest inference — active ONLY with a real trained model.
// ---------------------------------------------------------------------------

function predictWithForest(features) {
  const model = loadedModel || (MODEL_PATH ? loadTrainedModel() : null);
  if (!model) return null; // honest: no trained model → no ML prediction

  // Minimal, deterministic JSON-tree inference (depth-limited).
  const runTree = (node) => {
    let n = node;
    let guard = 0;
    while (n && typeof n === 'object' && !('value' in n) && guard++ < 64) {
      const v = Number(features[n.feature]);
      n = v <= n.threshold ? n.left : n.right;
    }
    return n && typeof n === 'object' && 'value' in n ? n.value : null;
  };

  try {
    const outputs = model.trees.map(runTree).filter((v) => v !== null);
    if (outputs.length === 0) return null;
    const mean = outputs.reduce((a, b) => a + b, 0) / outputs.length;
    return {
      verdict: mean >= 0.5 ? 'match' : 'needs_verification',
      confidence: Number(mean.toFixed(4)),
      engine: 'random-forest',
      modelVersion: model.version || 'unknown',
      treeCount: model.trees.length,
    };
  } catch (err) {
    console.warn('[RANDOM-FOREST] Inference failed:', err.message);
    return null;
  }
}

/** Full comparison decision: forest when truly available, else deterministic. */
function decide(ocrResult, aiResult, fieldComparison) {
  const features = buildFeatureVector(ocrResult, aiResult, fieldComparison);
  const forest = predictWithForest(features);
  const fallback = deterministicVerdict(features, fieldComparison);
  return {
    features,
    prediction: forest,           // null when untrained — the UI reports "Training Required"
    fallback,                     // always present, transparent
    effective: forest || fallback,
    status: forest ? 'trained' : 'training_required',
  };
}

/**
 * Export one labeled training row (features + the pharmacist's final
 * ground-truth decisions). Called from the human-verification flow — the
 * pharmacist IS the label source. Rows are appended locally only when
 * ML_TRAINING_CAPTURE=true; nothing is uploaded anywhere.
 */
function exportTrainingRow(payload, pharmacistResolvedFields) {
  // New callers must provide the complete confirmation provenance contract.
  if (payload && payload.prescriptionId) {
    return require('./trainingData.cjs').captureTrainingRow(payload)?.path || null;
  }
  return null;
}

module.exports = {
  FEATURE_KEYS,
  getStatus,
  isTrained,
  buildFeatureVector,
  deterministicVerdict,
  predictWithForest,
  decide,
  exportTrainingRow,
};
