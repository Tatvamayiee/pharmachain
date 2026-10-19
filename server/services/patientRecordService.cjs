// ---------------------------------------------------------------------------
// Patient record store — privacy-compliant storage for the minimal patient
// context needed by prescription review. Names are stored only as salted
// hashes (lookups by reference stay possible); free-text clinical fields
// (allergies, conditions, current medicines) are AES-256-GCM encrypted at
// rest. Access is strictly org-scoped. This replaces storing clinical
// context in cleartext on the prescription document.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const mongoose = require('mongoose');
const { createRepository } = require('../db/repositories/repositoryFactory.cjs');
const models = require('../db/models/index.cjs');

const patientRepo = createRepository({ name: 'patient_records', model: models.PatientRecord, prefix: 'PAT' });

function recordKey() {
  const raw = process.env.PHARMACHAIN_PATIENT_KEY || process.env.PHARMACHAIN_FILE_KEY || '';
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PHARMACHAIN_PATIENT_KEY (or PHARMACHAIN_FILE_KEY) must be set in production');
  }
  if (!recordKey._warned) {
    console.warn('[patientRecords] No PHARMACHAIN_PATIENT_KEY — using an ephemeral dev key.');
    recordKey._warned = true;
  }
  return crypto.createHash('sha256').update('pharmachain-dev-patient-key').digest();
}

function encryptField(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', recordKey(), iv);
  const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

function decryptField(value) {
  if (!value || !value.startsWith('enc:v1:')) return value || '';
  try {
    const [, , ivB64, tagB64, dataB64] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', recordKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '[decryption failed]';
  }
}

function hashReference(reference) {
  const salt = crypto.createHash('sha256').update('pharmachain-ref-salt').digest();
  return crypto.createHmac('sha256', salt).update(String(reference || '')).digest('hex');
}

/** Upsert the patient context for a prescription. Encrypted at rest. */
async function upsertPatientContext({ organizationId, patientReference, patientName, patientAge, patientGender, allergies, existingConditions, currentMedicines }) {
  const refHash = hashReference(patientReference);
  const existing = await patientRepo.findOne({ organizationId, referenceHash: refHash });
  const doc = {
    organizationId,
    referenceHash: refHash,
    patientNameHash: patientName ? hashReference(patientName) : '',
    patientAge: patientAge ?? null,
    patientGender: patientGender || '',
    allergiesEnc: encryptField(allergies),
    existingConditionsEnc: encryptField(existingConditions),
    currentMedicinesEnc: encryptField(currentMedicines),
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    return patientRepo.updateById(existing.id, doc);
  }
  return patientRepo.create(doc);
}

/** Org-scoped read; decrypts fields for authorized callers only. */
async function getPatientContext({ organizationId, patientReference }) {
  const rec = await patientRepo.findOne({ organizationId, referenceHash: hashReference(patientReference) });
  if (!rec) return null;
  return {
    patientReference,
    patientAge: rec.patientAge,
    patientGender: rec.patientGender,
    allergies: decryptField(rec.allergiesEnc),
    existingConditions: decryptField(rec.existingConditionsEnc),
    currentMedicines: decryptField(rec.currentMedicinesEnc),
  };
}

module.exports = { patientRepo, upsertPatientContext, getPatientContext, encryptField, decryptField, hashReference };
