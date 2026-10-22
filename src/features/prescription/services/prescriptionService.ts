// ---------------------------------------------------------------------------
// PRESCRIPTION SERVICE — backend-integrated, with a clearly-labelled local
// prototype fallback.
//
// Server calls go through the MongoDB-backed API. The prototype fallback
// (prescriptionPrototype.ts) keeps the scanner working when the backend AI is
// unreachable or unconfigured, and owns the session store the review UI
// mutates. Everything local is labelled (Mock OCR result) — never presented
// as clinically validated. No patient data is ever logged.
// ---------------------------------------------------------------------------

import { api } from '../../../platform/api/api';
import { listServerPrescriptions } from '../../../platform/api/backendSync';
import type {
  PrescriptionAnalysis, PrescriptionRecord, PrescriptionRoleAccess,
  PrescriptionFormData, PrescriptionStatus, ReviewChecklist, WorkflowDecision,
  AlertSeverity, AlertReviewStatus,
} from '../types/prescription';
import {
  listSessionRecords,
  approvePrescriptionLocal, rejectPrescriptionLocal,
  requestPrescriptionClarificationLocal, markPrescriptionDispensedLocal,
  type WorkflowResult,
} from './prescriptionPrototype';

// Re-export the prototype machinery so existing imports keep working.
export {
  ANALYSIS_STEPS, PROTOTYPE_LABELS, MAX_FILE_SIZE_MB,
  formatFileSize, createLocalPreviewUrl, revokeLocalPreviewUrl,
  analyzePrescriptionMock, getPrescriptionByIdMock, registerLocalPrescriptionRecord,
  updateLocalPrescriptionAnalysis, setRecordPharmacist, updateReviewChecklist,
  acknowledgeRecordAlert, addRecordAlertNote, rematchMedicine,
  listSessionRecords,
} from './prescriptionPrototype';
export type { WorkflowResult, AnalyzePrescriptionInput, AnalyzePrescriptionResult } from './prescriptionPrototype';

// ------------------------------ File validation ------------------------------

const ACCEPTED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const FILE_MAX_MB = 10;

// --------------------------- File normalization ---------------------------
// Screenshots and exports are frequently saved with a .png name but carry
// WebP/AVIF/etc. bytes, and the browser derives File.type from the EXTENSION.
// The server fail-closes on any declared-type vs content mismatch (correctly,
// for security). So we sniff the REAL format here and, when needed, rebuild
// or re-encode the file so the bytes always match what we declare.

type SniffedFormat = 'png' | 'jpeg' | 'pdf' | 'webp' | 'avif' | 'bmp' | 'gif' | 'unknown';

function sniffFormat(bytes: Uint8Array): SniffedFormat {
  const b = bytes;
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((v, i) => b[offset + i] === v);
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'webp'; // RIFF…WEBP
  if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) { // ftyp brand at offset 4
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
  }
  if (startsWith([0x42, 0x4d])) return 'bmp';
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return 'gif';
  return 'unknown';
}

const MIME_BY_FORMAT: Partial<Record<SniffedFormat, string>> = {
  png: 'image/png', jpeg: 'image/jpeg', pdf: 'application/pdf',
};

const EXT_BY_FORMAT: Partial<Record<SniffedFormat, string>> = {
  png: '.png', jpeg: '.jpg', pdf: '.pdf',
};

/** Decode any browser-supported image (WebP/AVIF/BMP/GIF…) and re-encode as
 *  PNG so the server's magic-byte validation always passes. Downscales to a
 *  4000px cap — prescriptions stay fully legible while the payload stays sane. */
async function reencodeToPng(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode-failed'));
      el.src = url;
    });
    const MAX_DIM = 4000;
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; // flatten transparency onto white like paper
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    const base = file.name.replace(/\.[^.]+$/, '') || 'prescription';
    return new File([blob], `${base}.png`, { type: 'image/png' });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Ensure the prescription file's bytes match its declared type before upload.
 * - Correctly-typed PNG/JPEG/PDF pass through unchanged (zero cost).
 * - Mislabeled files (e.g. JPEG bytes named .png) are rebuilt with the TRUE
 *   name + MIME so the server's sniff-vs-declared check passes.
 * - Browser-decodable non-server formats (WebP, AVIF, BMP, GIF) are converted
 *   to PNG via canvas.
 * - Anything else (corrupt files, text renamed .png) fails with an actionable
 *   message BEFORE any network round trip.
 */
export async function normalizePrescriptionFile(
  file: File,
): Promise<{ ok: true; file: File; converted: boolean } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: 'The selected file is empty.' };
  if (file.size > FILE_MAX_MB * 1024 * 1024) {
    return { ok: false, error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${FILE_MAX_MB} MB.` };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  } catch {
    return { ok: false, error: 'The selected file could not be read. Please re-save it and try again.' };
  }

  const sniffed = sniffFormat(bytes);

  // Bytes already match a server-accepted format…
  if (sniffed === 'png' || sniffed === 'jpeg' || sniffed === 'pdf') {
    const declaredMime = MIME_BY_FORMAT[sniffed];
    if (file.type === declaredMime) {
      return { ok: true, file, converted: false };
    }
    // …but the declared type disagrees (misnamed file): rebuild with true type.
    const ext = EXT_BY_FORMAT[sniffed];
    const base = file.name.replace(/\.[^.]+$/, '') || 'prescription';
    const rebuilt = new File([file], `${base}${ext}`, { type: declaredMime });
    return { ok: true, file: rebuilt, converted: true };
  }

  // WebP/AVIF/BMP/GIF: the browser can usually decode them — convert to PNG.
  const converted = await reencodeToPng(file);
  if (converted) return { ok: true, file: converted, converted: true };

  return {
    ok: false,
    error: 'This file does not look like a valid PNG, JPG or PDF prescription. Re-save or export it as PNG or JPG and try again.',
  };
}

export function validatePrescriptionFile(file: File): string | null {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
    return 'Unsupported file type. Please upload a PNG, JPG, JPEG or PDF file.';
  }
  if (file.size > FILE_MAX_MB * 1024 * 1024) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is ${FILE_MAX_MB} MB.`;
  }
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

// ------------------------------ Server-backed ops ----------------------------

/** Create the record server-side; falls back to a session-shell record. */
export async function createPrescription(
  form: PrescriptionFormData,
  role: PrescriptionRoleAccess,
): Promise<PrescriptionRecord> {
  try {
    const { prescriptionId } = await api<{ prescriptionId: string }>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    const server = await api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`);
    return server;
  } catch {
    // Offline: session-only shell (the mock analyze path fills it in).
    return {
      id: `RX-local-${Date.now()}`,
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
  }
}

/** Analyze via the backend AI (HF/OpenAI vision). Throws honest errors. */
export async function analyzePrescription(prescriptionId: string): Promise<PrescriptionAnalysis> {
  try {
    return await api<PrescriptionAnalysis>(
      `/api/prescriptions/${encodeURIComponent(prescriptionId)}/analyze`,
      { method: 'POST', body: JSON.stringify({}), timeoutMs: 120_000 },
    );
  } catch (err) {
    throw new Error(`Failed to analyze prescription: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function uploadPrescriptionImage(prescriptionId: string, file: File): Promise<{ fileId: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api<{ file: { fileId: string; size: number } }>(
    `/api/prescriptions/${encodeURIComponent(prescriptionId)}/upload`,
    { method: 'POST', body: formData },
  );
  return response.file;
}

export async function getPrescriptionById(id: string): Promise<PrescriptionRecord> {
  return api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(id)}`);
}

/** Persist corrected analysis (server PATCH, org-scoped). */
export async function updatePrescriptionAnalysis(
  prescriptionId: string,
  analysis: PrescriptionAnalysis,
): Promise<PrescriptionRecord> {
  return api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      extractedText: analysis.ocrText,
      medicines: analysis.medicines.map((m) => ({
        id: m.id, name: m.extractedName, strength: m.strength, dosage: m.dosage,
        route: m.route, frequency: m.frequency, duration: m.duration,
        quantity: Number(m.quantity) || 0, confidence: m.confidence, matchStatus: m.match.status,
      })),
      interactionAlerts: analysis.interactionAlerts,
      dosageAlerts: analysis.dosageAlerts,
      analysisProvider: analysis.analysisProvider,
      analysisModel: analysis.analysisModel,
      analysisConfidence: analysis.analysisConfidence,
      requiresHumanReview: analysis.requiresHumanReview,
    }),
  });
}

export async function saveReviewDraft(
  prescriptionId: string,
  pharmacistName: string,
  checklist: ReviewChecklist,
  notes = '',
): Promise<PrescriptionRecord> {
  return api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ checklist, notes, pharmacistName }),
  });
}

export async function acknowledgeAlert(
  prescriptionId: string, kind: 'interaction' | 'dosage', alertId: string, actor: string,
): Promise<PrescriptionRecord> {
  return api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ checklist: {}, notes: `ack:${kind}:${alertId} by ${actor}` }),
  });
}

export async function addAlertNote(
  prescriptionId: string, kind: 'interaction' | 'dosage', alertId: string, note: string, actor: string,
): Promise<PrescriptionRecord> {
  return api<PrescriptionRecord>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}/review`, {
    method: 'POST',
    body: JSON.stringify({ checklist: {}, notes: `note:${kind}:${alertId}: ${note} (${actor})` }),
  });
}

// --------------------- Workflow decisions (local + mirror) -------------------
// The session record is mutated synchronously (audit trail + UI update), and
// the same decision is mirrored best-effort to the server, where the real
// transition validation + safety rules + audit live.

function mirror(path: string, body?: Record<string, unknown>): void {
  void api(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => {});
}

export function approvePrescription(id: string, decision: WorkflowDecision): WorkflowResult {
  const result = approvePrescriptionLocal(id, decision);
  if (result.ok) mirror(`/api/prescriptions/${encodeURIComponent(id)}/approve`);
  return result;
}

export function rejectPrescription(id: string, decision: WorkflowDecision): WorkflowResult {
  const result = rejectPrescriptionLocal(id, decision);
  if (result.ok) mirror(`/api/prescriptions/${encodeURIComponent(id)}/reject`, { reason: decision.reason || decision.note || 'Rejected' });
  return result;
}

export function requestPrescriptionClarification(id: string, decision: WorkflowDecision): WorkflowResult {
  const result = requestPrescriptionClarificationLocal(id, decision);
  if (result.ok) {
    mirror(`/api/prescriptions/${encodeURIComponent(id)}/clarification`, {
      recipientType: decision.recipient || 'prescriber',
      message: decision.note || decision.reason || 'Clarification requested',
    });
  }
  return result;
}

export function markPrescriptionDispensed(id: string, decision: WorkflowDecision): WorkflowResult {
  const result = markPrescriptionDispensedLocal(id, decision);
  if (result.ok) mirror(`/api/prescriptions/${encodeURIComponent(id)}/dispense`);
  return result;
}

// ------------------------------- List queries --------------------------------

/** Server history merged with session records (history page). */
export async function getPrescriptionHistory(role: PrescriptionRoleAccess): Promise<PrescriptionRecord[]> {
  const local = listSessionRecords(role);
  const mapped = await listServerPrescriptions();
  const serverMapped = mapped.filter((r) => r.createdByRole === role);
  const seen = new Set(serverMapped.map((r) => r.id));
  return [...serverMapped, ...local.filter((r) => !seen.has(r.id))];
}

/** Sync list over the session store (prototype list pages). */
export function getPrescriptionsByStatus(role: PrescriptionRoleAccess, statuses: PrescriptionStatus[]): PrescriptionRecord[] {
  return listSessionRecords(role).filter((r) => statuses.includes(r.status));
}

/** Session records carrying alerts (alert pages). */
export function getPrescriptionsWithAlerts(role: PrescriptionRoleAccess, unresolvedOnly = false): PrescriptionRecord[] {
  return listSessionRecords(role).filter((r) => {
    if (!r.analysis) return false;
    if (!unresolvedOnly) return true;
    const open = (s: AlertReviewStatus) => s === 'unreviewed' || s === 'requires_clarification';
    return r.analysis.interactionAlerts.some((a) => open(a.reviewStatus))
      || r.analysis.dosageAlerts.some((a) => open(a.reviewStatus));
  });
}

// --------------------------- Record-level helpers ----------------------------

export function getAllRecordAlerts(r: PrescriptionRecord): Array<{ kind: 'interaction' | 'dosage'; alert: { id: string; severity: AlertSeverity; reviewStatus: AlertReviewStatus; note?: string; reason?: string; medicines?: string[]; medicine?: string } }> {
  if (!r.analysis) return [];
  return [
    ...r.analysis.interactionAlerts.map((alert) => ({ kind: 'interaction' as const, alert })),
    ...r.analysis.dosageAlerts.map((alert) => ({ kind: 'dosage' as const, alert })),
  ];
}

export function hasUnresolvedCriticalAlerts(r: PrescriptionRecord): boolean {
  if (!r.analysis) return false;
  const unresolved = (s: string) => s !== 'acknowledged' && s !== 'resolved';
  return r.analysis.interactionAlerts.some((a) => a.severity === 'critical' && unresolved(a.reviewStatus))
    || r.analysis.dosageAlerts.some((a) => a.severity === 'critical' && unresolved(a.reviewStatus));
}

export function hasBlockingMatches(r: PrescriptionRecord): boolean {
  if (!r.analysis) return false;
  return r.analysis.medicines.some((m) => m.match.status === 'not_found' || m.match.manualVerificationRequired);
}

export function getApprovalBlockers(r: PrescriptionRecord): string[] {
  const blockers: string[] = [];
  if (!r.analysis) blockers.push('No analysis available — run the analysis first.');
  if (r.status === 'rejected') blockers.push('This prescription was rejected and cannot be approved.');
  if (r.status === 'dispensed') blockers.push('This prescription has already been dispensed.');
  if (hasUnresolvedCriticalAlerts(r)) blockers.push('Unresolved critical safety alerts must be acknowledged or resolved first.');
  if (r.status === 'clarification_requested') blockers.push('This prescription is awaiting clarification — resume safety review before approving.');
  if (hasBlockingMatches(r)) blockers.push('A medicine is unmatched or flagged for manual verification — correct or verify it first.');
  return blockers;
}

export function worstSeverityOf(r: PrescriptionRecord): AlertSeverity | null {
  const severities = [
    ...(r.analysis?.interactionAlerts.map((a) => a.severity) ?? []),
    ...(r.analysis?.dosageAlerts.map((a) => a.severity) ?? []),
  ];
  const order: AlertSeverity[] = ['critical', 'high', 'moderate', 'informational'];
  return order.find((s) => severities.includes(s)) ?? null;
}
