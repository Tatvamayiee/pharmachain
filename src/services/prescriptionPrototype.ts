// ---------------------------------------------------------------------------
// Prototype-mode compatibility layer for the prescription service.
//
// Clearly-labelled local fallbacks used when the backend AI is unreachable or
// unconfigured. The scanner UI shows 'Mock OCR result' for these results, so
// nothing here can be mistaken for a real clinical analysis. No network calls;
// nothing persists beyond the current page session.
// ---------------------------------------------------------------------------

import type {
  PrescriptionAnalysis, PrescriptionRecord, PrescriptionRoleAccess,
  PrescriptionFormData, PrescriptionStatus, ReviewChecklist, WorkflowDecision,
  AlertSeverity, MatchStatus, DosageStatus, AlertReviewStatus,
} from '../types/prescription';

export interface AnalyzePrescriptionInput {
  file: File;
  fileUrl: string;
  form: PrescriptionFormData;
  role: PrescriptionRoleAccess;
}

export interface AnalyzePrescriptionResult {
  record: PrescriptionRecord;
  analysis: PrescriptionAnalysis;
}

export const ANALYSIS_STEPS = [
  { id: 'read', label: 'Reading prescription image' },
  { id: 'ocr', label: 'Extracting handwritten text' },
  { id: 'extract', label: 'Identifying medicines' },
  { id: 'match', label: 'Matching medicine records' },
  { id: 'interactions', label: 'Checking demo interactions' },
  { id: 'dosage', label: 'Checking demo dosage rules' },
  { id: 'review', label: 'Preparing pharmacist review' },
] as const;

export const PROTOTYPE_LABELS = {
  ocrLabel: 'Mock OCR result',
  matchLabel: 'Mock drug database match',
} as const;

export const MAX_FILE_SIZE_MB = 10;

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function createLocalPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeLocalPreviewUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}

export type WorkflowResult =
  | { ok: true; record: PrescriptionRecord }
  | { ok: false; error: string };

// Local session store (stores current session records for UI mutations).
const localRecords: PrescriptionRecord[] = [];

export function registerLocalPrescriptionRecord(record: PrescriptionRecord): PrescriptionRecord {
  const idx = localRecords.findIndex((r) => r.id === record.id);
  if (idx >= 0) {
    localRecords[idx] = record;
  } else {
    localRecords.push(record);
  }
  return record;
}

export function getPrescriptionByIdMock(id: string): PrescriptionRecord | undefined {
  return localRecords.find((r) => r.id === id);
}

export async function analyzePrescriptionMock(
  input: AnalyzePrescriptionInput,
  onStep?: (i: number) => void,
): Promise<AnalyzePrescriptionResult> {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const { form, role } = input;

  const record: PrescriptionRecord = {
    id: `RX-${String(localRecords.length + 1).padStart(6, '0')}`,
    patientReference: form.patientReference,
    prescriptionDate: form.prescriptionDate,
    medicineCount: 0,
    criticalAlerts: 0,
    status: 'uploaded',
    analysisProvider: 'mock',
    createdAt: new Date().toISOString(),
    createdByRole: role,
    prescriberName: form.prescriberName,
    department: form.department,
    auditTrail: [],
  };
  localRecords.push(record);

  const demoMeds = [
    { name: 'Paracetamol 650 mg', strength: '650 mg', dosage: '1 tablet', frequency: 'three times daily', duration: '5 days', route: 'oral', confidence: 0.92 },
    { name: 'Cetirizine 10 mg', strength: '10 mg', dosage: '1 tablet', frequency: 'once daily', duration: '5 days', route: 'oral', confidence: 0.55 },
  ].map((m, i) => ({
    id: `mock-med-${i + 1}`,
    extractedName: m.name,
    strength: m.strength,
    dosage: m.dosage,
    route: m.route,
    frequency: m.frequency,
    duration: m.duration,
    quantity: '10',
    confidence: m.confidence,
    match: {
      drugId: null,
      extractedName: m.name,
      matchedName: m.name,
      genericName: m.name.split(' ')[0],
      brandName: null,
      strength: m.strength,
      dosageForm: 'Tablet',
      status: (m.confidence >= 0.75 ? 'matched' : m.confidence >= 0.4 ? 'possible_match' : 'needs_review') as MatchStatus,
      confidence: m.confidence,
      manualVerificationRequired: m.confidence < 0.75,
    },
  }));

  const interactionAlerts = [{
    id: 'ia-demo-1',
    severity: 'moderate' as AlertSeverity,
    medicines: demoMeds.map((m) => m.extractedName),
    reason: 'Demo pairwise rule matched (synthetic).',
    potentialConcern: 'Demo concern — no clinical basis.',
    recommendedAction: 'Verify with the prescriber if clinically indicated.',
    source: 'Demo interaction rules (synthetic)',
    reviewStatus: 'unreviewed' as AlertReviewStatus,
  }];
  const dosageAlerts = demoMeds.filter((m) => m.confidence < 0.6).map((m) => ({
    id: `da-demo-${m.id}`,
    severity: 'informational' as AlertSeverity,
    medicine: m.extractedName,
    status: 'unable_to_validate' as DosageStatus,
    flaggedField: 'dose',
    reason: 'Low OCR confidence — demo dosage rules could not validate.',
    missingInformation: ['patient weight'],
    suggestedAction: 'Manual verification of the dose is required.',
    reviewStatus: 'unreviewed' as AlertReviewStatus,
  }));

  onStep?.(0); await wait(400);
  onStep?.(1); await wait(450);
  onStep?.(2); await wait(400);
  onStep?.(3); await wait(420);
  onStep?.(4); await wait(350);
  onStep?.(5); await wait(350);
  onStep?.(6); await wait(300);

  const analysis: PrescriptionAnalysis = {
    prescriptionId: record.id,
    status: 'analyzed',
    ocrText: [
      'Rx',
      `Patient ref: ${form.patientReference}  Age: ${form.patientAge}${form.patientGender ? `  Sex: ${form.patientGender}` : ''}`,
      ...demoMeds.map((m) => `1. Tab ${m.extractedName} — ${m.dosage}, ${m.frequency}, ${m.duration}`),
      '',
      '[Mock OCR result — demo text, not read from the uploaded image]',
    ].join('\n'),
    medicines: demoMeds,
    interactionAlerts,
    dosageAlerts,
    confidence: demoMeds.reduce((s, m) => s + m.confidence, 0) / Math.max(demoMeds.length, 1),
    requiresHumanReview: true,
    analysisProvider: 'mock',
    analyzedAt: new Date().toISOString(),
  };
  record.status = analysis.status;
  record.analysis = analysis;
  record.medicineCount = demoMeds.length;
  record.criticalAlerts = 0;
  return { record, analysis };
}

export function updateLocalPrescriptionAnalysis(id: string, analysis: PrescriptionAnalysis): boolean {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return false;
  rec.analysis = analysis;
  rec.medicineCount = analysis.medicines.length;
  rec.status = analysis.status;
  return true;
}

export function setRecordPharmacist(id: string, name: string): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  rec.pharmacistName = name;
  return { ok: true, record: rec };
}

export function updateReviewChecklist(id: string, checklist: ReviewChecklist): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  rec.checklist = checklist;
  return { ok: true, record: rec };
}

function mutateLocalAlert(
  id: string,
  kind: 'interaction' | 'dosage',
  alertId: string,
  mutate: (a: { reviewStatus?: AlertReviewStatus; note?: string }) => { reviewStatus?: AlertReviewStatus; note?: string },
): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  const analysis = rec?.analysis;
  if (!rec || !analysis) return { ok: false, error: 'Record not found.' };
  const apply = <T extends { id: string; reviewStatus: AlertReviewStatus; note?: string }>(list: T[]) =>
    list.map((a) => (a.id === alertId ? { ...a, ...mutate(a) } : a));
  if (kind === 'interaction') analysis.interactionAlerts = apply(analysis.interactionAlerts);
  else analysis.dosageAlerts = apply(analysis.dosageAlerts);
  return { ok: true, record: rec };
}

export function acknowledgeRecordAlert(id: string, kind: 'interaction' | 'dosage', alertId: string, _actor: string): WorkflowResult {
  return mutateLocalAlert(id, kind, alertId, () => ({ reviewStatus: 'acknowledged' }));
}

export function addRecordAlertNote(id: string, kind: 'interaction' | 'dosage', alertId: string, note: string, _actor: string): WorkflowResult {
  return mutateLocalAlert(id, kind, alertId, (a) => ({ reviewStatus: a.reviewStatus === 'unreviewed' ? 'requires_clarification' : a.reviewStatus, note }));
}

export async function rematchMedicine(medId: string, name: string): Promise<PrescriptionAnalysis['medicines'] | null> {
  await new Promise<void>((r) => setTimeout(r, 250));
  const clean = name.trim().toLowerCase();
  const generic = ['paracetamol', 'cetirizine', 'amoxicillin', 'ibuprofen', 'metformin', 'warfarin'];
  const isMatch = generic.some((g) => clean.includes(g));
  return [{
    id: medId,
    extractedName: name,
    strength: '',
    dosage: '',
    route: '',
    frequency: '',
    duration: '',
    quantity: '',
    confidence: isMatch ? 0.9 : 0.4,
    match: {
      drugId: isMatch ? `local-${clean}` : null,
      extractedName: name,
      matchedName: isMatch ? name : null,
      genericName: isMatch ? name.split(' ')[0] : null,
      brandName: null,
      strength: null,
      dosageForm: null,
      status: (isMatch ? 'matched' : 'needs_review') as MatchStatus,
      confidence: isMatch ? 0.9 : 0.4,
      manualVerificationRequired: !isMatch,
    },
  }] as PrescriptionAnalysis['medicines'];
}

// Local workflow decisions (used when the record lives only in the session).
const REJECT_FROM: PrescriptionStatus[] = ['safety_review_required', 'clarification_requested', 'analyzed'];
const CLARIFY_FROM: PrescriptionStatus[] = ['safety_review_required', 'analyzed'];

export function approvePrescriptionLocal(id: string, decision: WorkflowDecision): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  rec.status = 'approved';
  rec.pharmacistName = decision.actor;
  return { ok: true, record: rec };
}

export function rejectPrescriptionLocal(id: string, decision: WorkflowDecision): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  if (!REJECT_FROM.includes(rec.status)) return { ok: false, error: `Invalid transition: cannot reject from "${rec.status}".` };
  if (!decision.reason) return { ok: false, error: 'A rejection reason is required.' };
  rec.status = 'rejected';
  return { ok: true, record: rec };
}

export function requestPrescriptionClarificationLocal(id: string, decision: WorkflowDecision): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  if (!CLARIFY_FROM.includes(rec.status)) return { ok: false, error: `Invalid transition: cannot clarify from "${rec.status}".` };
  if (!decision.note) return { ok: false, error: 'A clarification message is required.' };
  rec.status = 'clarification_requested';
  return { ok: true, record: rec };
}

export function markPrescriptionDispensedLocal(id: string, _decision: WorkflowDecision): WorkflowResult {
  const rec = getPrescriptionByIdMock(id);
  if (!rec) return { ok: false, error: 'Record not found.' };
  if (rec.status !== 'approved') return { ok: false, error: 'Only approved prescriptions can be dispensed.' };
  rec.status = 'dispensed';
  return { ok: true, record: rec };
}

/** All session records for a role (used by the sync list pages). */
export function listSessionRecords(role: PrescriptionRoleAccess): PrescriptionRecord[] {
  return localRecords.filter((r) => r.createdByRole === role);
}
