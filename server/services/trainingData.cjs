 const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { FEATURE_KEYS } = require('./randomForestComparison.cjs');

const TRAINING_DIR = path.join(__dirname, '..', 'ml', 'training-data');
const FEATURE_VERSION = 'rf-features-v1';
const LABEL_SCHEMA = 'pharmacist-confirmed-v1';
const MINIMUM_REQUIRED = Number.parseInt(process.env.RF_MIN_SAMPLES || '200', 10);

function files() {
  if (!fs.existsSync(TRAINING_DIR)) return [];
  return fs.readdirSync(TRAINING_DIR).filter((name) => name.endsWith('.json')).sort();
}
function readRows() {
  return files().map((file) => {
    try { return { file, row: JSON.parse(fs.readFileSync(path.join(TRAINING_DIR, file), 'utf8')) }; }
    catch (error) { return { file, row: null, error }; }
  });
}
function validFeatures(features) {
  if (!features || typeof features !== 'object') return false;
  return FEATURE_KEYS.every((key) => {
    const value = Number(features[key]);
    if (!Number.isFinite(value)) return false;
    if (key !== 'medicineCountDelta' && key !== 'disagreementCount' && (value < 0 || value > 1)) return false;
    if ((key === 'medicineCountDelta' || key === 'disagreementCount') && (!Number.isInteger(value) || value < 0)) return false;
    return true;
  });
}
function validComparison(comparison) {
  const fields = comparison && Array.isArray(comparison.fields) ? comparison.fields : [];
  const summary = comparison && comparison.summary;
  return fields.length > 0 && summary && Number.isInteger(summary.totalFields)
    && Number.isInteger(summary.matched) && Number.isInteger(summary.disagreements)
    && summary.totalFields === fields.length
    && summary.matched + summary.disagreements === summary.totalFields;
}
function normalize(value) { return String(value ?? '').trim().toLowerCase(); }
function pharmacistLabel(confirmedMedicines, aiMedicines) {
  const confirmed = Array.isArray(confirmedMedicines) ? confirmedMedicines : [];
  const ai = Array.isArray(aiMedicines) ? aiMedicines : [];
  const fields = ['name', 'strength', 'dosage', 'frequency', 'duration', 'route', 'instructions'];
  const differs = confirmed.length !== ai.length || confirmed.some((medicine, index) => {
    const other = ai[index] || {};
    return fields.some((key) => normalize(medicine[key]) !== normalize(other[key]));
  });
  return differs ? 'needs_verification' : 'match';
}
function rowIdentity(row) {
  return row && (row.prescriptionId || row.referenceId || row.source?.prescriptionId || null);
}
function validateRow(entry) {
  const row = entry.row;
  const reasons = [];
  if (!row) reasons.push('unparseable row');
  if (!row || row.pharmacistConfirmation?.confirmed !== true || row.source?.type !== 'pharmacist-confirmation') reasons.push('missing pharmacist confirmation provenance');
  if (!row || !row.prescriptionId) reasons.push('missing prescription/reference ID');
  if (!row || !row.confirmationTimestamp || Number.isNaN(Date.parse(row.confirmationTimestamp))) reasons.push('missing confirmation timestamp');
  if (!row || row.featureVersion !== FEATURE_VERSION) reasons.push('missing/invalid feature version');
  if (!row || !validFeatures(row.features)) reasons.push('missing/malformed features');
  if (!row || !validComparison(row.fieldComparison)) reasons.push('incomplete comparison');
  if (!row || !['match', 'needs_verification'].includes(row.groundTruthLabel)) reasons.push('missing label');
  return { valid: reasons.length === 0, reasons, prescriptionId: rowIdentity(row), label: row?.groundTruthLabel };
}
function datasetReport() {
  const entries = readRows();
  const results = entries.map(validateRow);
  const identityCounts = new Map();
  for (const result of results) if (result.prescriptionId) identityCounts.set(result.prescriptionId, (identityCounts.get(result.prescriptionId) || 0) + 1);
  const duplicateRows = results.filter((result) => result.prescriptionId && identityCounts.get(result.prescriptionId) > 1).length;
  const validRows = results.filter((result) => result.valid && identityCounts.get(result.prescriptionId) === 1);
  const labeledRows = results.filter((result) => result.valid && result.label);
  const matchRows = labeledRows.filter((result) => result.label === 'match').length;
  const needsVerificationRows = labeledRows.filter((result) => result.label === 'needs_verification').length;
  const invalidRows = results.length - validRows.length;
  return {
    rawRows: entries.length,
    uniqueRows: new Set(results.map((result) => result.prescriptionId).filter(Boolean)).size,
    validRows: validRows.length,
    invalidRows,
    duplicateRows,
    missingLabels: results.filter((result) => result.reasons.includes('missing label')).length,
    missingFeatures: results.filter((result) => result.reasons.includes('missing/malformed features')).length,
    labeledRows: labeledRows.length,
    matchRows,
    needsVerificationRows,
    minimumRequired: MINIMUM_REQUIRED,
    rowsNeeded: Math.max(0, MINIMUM_REQUIRED - validRows.length),
    datasetReady: validRows.length >= MINIMUM_REQUIRED && matchRows > 0 && needsVerificationRows > 0 && duplicateRows === 0,
    trainingStatus: 'not_trained',
    entries,
  };
}
function captureTrainingRow({ prescriptionId, features, fieldComparison, confirmedMedicines, aiMedicines, confirmedBy, confirmedAt }) {
  if (String(process.env.ML_TRAINING_CAPTURE || '').toLowerCase() !== 'true') return null;
  if (!prescriptionId || !validFeatures(features) || !validComparison(fieldComparison) || !confirmedBy || !confirmedAt) return null;
  fs.mkdirSync(TRAINING_DIR, { recursive: true });
  const existing = readRows().find((entry) => rowIdentity(entry.row) === prescriptionId);
  if (existing) return { path: path.join(TRAINING_DIR, existing.file), duplicate: true, row: existing.row };
  const row = {
    rowId: crypto.createHash('sha256').update(String(prescriptionId)).digest('hex'),
    prescriptionId,
    referenceId: prescriptionId,
    confirmationTimestamp: confirmedAt,
    featureVersion: FEATURE_VERSION,
    features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, Number(features[key])])),
    fieldComparison,
    groundTruthLabel: pharmacistLabel(confirmedMedicines, aiMedicines),
    pharmacistConfirmation: { confirmed: true, marker: 'pharmacist-confirmed', confirmedBy },
    source: { type: 'pharmacist-confirmation', endpoint: 'POST /api/prescriptions/:id/confirm', prescriptionId },
  };
  const filename = `training-row-${crypto.createHash('sha256').update(String(prescriptionId)).digest('hex').slice(0, 24)}.json`;
  const target = path.join(TRAINING_DIR, filename);
  try { fs.writeFileSync(target, JSON.stringify(row, null, 2), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return { path: target, duplicate: true, row: JSON.parse(fs.readFileSync(target, 'utf8')) };
  }
  return { path: target, duplicate: false, row };
}
module.exports = { TRAINING_DIR, FEATURE_VERSION, MINIMUM_REQUIRED, validFeatures, validComparison, validateRow, datasetReport, captureTrainingRow };
