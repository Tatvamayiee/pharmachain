// ---------------------------------------------------------------------------
// Backend sync layer — mirrors the prototype prescription workflow onto the
// MongoDB-backed Express API. Every call is best-effort: when the backend is
// unreachable the prototype keeps working exactly as before (local session
// state), and failures never block or break the UI. No patient data is ever
// logged.
//
// Design rules:
//   - NEVER throws to the UI; every function resolves to a plain result.
//   - authLogin mirrors the demo login to POST /api/auth/login and caches the
//     presence of the HttpOnly session cookie for the api client. It probes the credentials silently —
//     a failure just means "backend not available", and prototype login stays
//     authoritative in the UI.
//   - createPrescription / recordAnalysis / decisions map to the server
//     contracts implemented in server/routes/prescriptions.cjs.
//   - listServerPrescriptions returns server records mapped to the frontend
//     PrescriptionRecord shape so the history page can merge them.
//   - serverAvailable() is a cached health probe used for UI badges.
// ---------------------------------------------------------------------------

import type {
  PrescriptionRecord, PrescriptionAnalysis, PrescriptionStatus, AnalysisProvider,
  ReviewChecklist, InteractionAlert, DosageAlert, MatchStatus, AlertSeverity,
  AlertReviewStatus, PrescriptionAuditEvent, WorkflowDecision,
  AvailableProvider, AnalysisComparison, AnalysisHistoryEntry,
  ParallelAnalysisResult,
} from '../../features/prescription/types/prescription';
import { api, apiUrl, backendSessionActive, setBackendSessionActive } from './api';

export type SyncOutcome = { ok: boolean; serverId?: string; error?: string };

let cachedHealthy: boolean | null = null;
let lastProbe = 0;

export async function serverAvailable(maxAgeMs = 30_000): Promise<boolean> {
  const now = Date.now();
  if (cachedHealthy !== null && now - lastProbe < maxAgeMs) return cachedHealthy;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(apiUrl('/api/health'), { signal: controller.signal });
    clearTimeout(timer);
    cachedHealthy = res.ok;
  } catch {
    cachedHealthy = false;
  }
  lastProbe = now;
  return cachedHealthy;
}

function invalidateHealth() {
  cachedHealthy = null;
  lastProbe = 0;
}

/** Mirror the demo login to the backend; the server sets an HttpOnly cookie. */
export async function authLogin(email: string, password: string): Promise<SyncOutcome> {
  if (!(await serverAvailable())) return { ok: false, error: 'backend-unreachable' };
  try {
    const data = await api<{ user?: { role?: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.user?.role) {
      setBackendSessionActive(true);
      return { ok: true };
    }
    return { ok: false, error: 'no-user-session' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'login-sync-failed' };
  }
}

export function backendSession(): boolean {
  return backendSessionActive();
}

export function clearBackendSession() {
  setBackendSessionActive(false);
  localStorage.removeItem('pc_token');
  invalidateHealth();
}

/** Map a server prescription document to the frontend record shape. */
function mapServerRecord(raw: Record<string, unknown>): PrescriptionRecord {
  const s = (raw.prescription && typeof raw.prescription === 'object' ? raw.prescription : raw) as Record<string, unknown>;
  const meds = Array.isArray(s.medicines) ? s.medicines : [];
  const interactions = Array.isArray(s.interactionAlerts) ? s.interactionAlerts : [];
  const dosages = Array.isArray(s.dosageAlerts) ? s.dosageAlerts : [];
  const criticalAlerts =
    interactions.filter((a) => (a as { severity?: string }).severity === 'critical').length +
    dosages.filter((a) => (a as { severity?: string }).severity === 'critical').length;

  const audit: PrescriptionAuditEvent[] = []; // hydrated separately via /audit
  const record: PrescriptionRecord = {
    id: String(s.prescriptionId || s.id || ''),
    patientReference: String(s.patientReference || ''),
    prescriptionDate: String(s.prescriptionDate || ''),
    medicineCount: meds.length,
    criticalAlerts,
    status: (s.status as PrescriptionStatus) || 'uploaded',
    analysisProvider: (s.analysisProvider as AnalysisProvider) || 'openai-compatible',
    createdAt: String(s.createdAt || new Date().toISOString()),
    createdByRole: (s.createdByRole as PrescriptionRecord['createdByRole']) || (s.role as PrescriptionRecord['createdByRole']) || undefined,
    prescriberName: s.prescriberName ? String(s.prescriberName) : undefined,
    department: s.department ? String(s.department) : undefined,
    checklist: (s.reviewChecklist as ReviewChecklist) || undefined,
    pharmacistName: s.pharmacistReviewer ? String(s.pharmacistReviewer) : undefined,
    auditTrail: audit,
    reviewDraftSaved: false,
    analysisHistory: Array.isArray(s.analysisHistory)
      ? (s.analysisHistory as AnalysisHistoryEntry[])
      : undefined,
  };


  if (s.extractedText !== undefined || meds.length > 0) {
    const analysis: PrescriptionAnalysis = {
      prescriptionId: record.id,
      status: record.status,
      ocrText: String(s.extractedText || ''),
      medicines: meds.map((m, i) => mapMedicine(m as Record<string, unknown>, i)),
      interactionAlerts: interactions.map((a) => mapInteraction(a as Record<string, unknown>)),
      dosageAlerts: dosages.map((a) => mapDosage(a as Record<string, unknown>)),
      confidence: typeof s.analysisConfidence === 'number' ? s.analysisConfidence : 0.6,
      requiresHumanReview: (s.requiresHumanReview !== undefined ? Boolean(s.requiresHumanReview) : true) as true,
      analysisProvider: ((s.analysisProvider as AnalysisProvider) || 'openai-compatible') as AnalysisProvider,
      analysisModel: s.analysisModel ? String(s.analysisModel) : undefined,
      analysisConfidence: typeof s.analysisConfidence === 'number' ? s.analysisConfidence : undefined,
      analyzedAt: String(s.updatedAt || s.createdAt || new Date().toISOString()),
    };
    record.analysis = analysis;
  }
  return record;
}

function mapMedicine(m: Record<string, unknown>, i: number) {
  const confidence = typeof m.confidence === 'number' ? m.confidence : 0.5;
  const raw = (m.matchStatus as MatchStatus) ||
    (confidence >= 0.75 ? 'matched' : confidence >= 0.4 ? 'possible_match' : 'needs_review');
  return {
    id: String(m.id || `srv-med-${i}`),
    extractedName: String(m.name || m.extractedName || ''),
    strength: String(m.strength || ''),
    dosage: String(m.dosage || ''),
    route: String(m.route || ''),
    frequency: String(m.frequency || ''),
    duration: String(m.duration || ''),
    quantity: String(m.quantity ?? ''),
    confidence,
    match: {
      drugId: m.drugId ? String(m.drugId) : null,
      extractedName: String(m.name || m.extractedName || ''),
      matchedName: m.matchedName ? String(m.matchedName) : null,
      genericName: m.genericName ? String(m.genericName) : null,
      brandName: m.brandName ? String(m.brandName) : null,
      strength: m.strength ? String(m.strength) : null,
      dosageForm: m.dosageForm ? String(m.dosageForm) : null,
      status: raw,
    } as PrescriptionRecord['analysis'] extends never ? never : import('../../features/prescription/types/prescription').DrugMatch,
  };
}

function mapInteraction(a: Record<string, unknown>): InteractionAlert {
  return {
    id: String(a.id || `srv-ia-${Math.random().toString(36).slice(2, 8)}`),
    severity: (a.severity as AlertSeverity) || 'moderate',
    medicines: Array.isArray(a.medicines) ? a.medicines.map(String) : [],
    reason: String(a.reason || ''),
    potentialConcern: String(a.concern || a.potentialConcern || ''),
    recommendedAction: String(a.action || a.recommendedAction || ''),
    source: String(a.source || 'AI analysis'),
    reviewStatus: (a.reviewStatus as AlertReviewStatus) ||
      ((a as { status?: string }).status === 'acknowledged' ? 'acknowledged' : 'unreviewed'),
    note: a.note ? String(a.note) : undefined,
  };
}

function mapDosage(a: Record<string, unknown>): DosageAlert {
  return {
    id: String(a.id || `srv-da-${Math.random().toString(36).slice(2, 8)}`),
    severity: (a.severity as AlertSeverity) || 'moderate',
    medicine: String(a.medicine || (Array.isArray(a.medicines) ? a.medicines[0] : '') || ''),
    status: (a.status as DosageAlert['status']) || 'unable_to_validate',
    flaggedField: String(a.flaggedField || 'dose'),
    reason: String(a.reason || ''),
    missingInformation: Array.isArray(a.missingInformation) ? a.missingInformation.map(String) : [],
    suggestedAction: String(a.action || a.suggestedAction || ''),
    reviewStatus: (a.reviewStatus as AlertReviewStatus) || 'unreviewed',
    note: a.note ? String(a.note) : undefined,
  };
}

/** Create the record server-side (organization scoping happens on the server). */
export async function createServerPrescription(
  form: { patientReference: string; patientAge: number; prescriptionDate: string; prescriberName?: string; department?: string; allergies?: string; existingConditions?: string; currentMedicines?: string },
): Promise<SyncOutcome> {
  if (!(await serverAvailable()) || !backendSession()) return { ok: false, error: 'no-session' };
  try {
    const data = await api<{ prescriptionId: string }>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    return { ok: true, serverId: data.prescriptionId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'create-failed' };
  }
}

/** Persist an analysis result onto the server record (PATCH + audit). */
export async function syncAnalysis(
  serverId: string,
  analysis: PrescriptionAnalysis,
): Promise<SyncOutcome> {
  if (!serverId) return { ok: false, error: 'no-server-id' };
  try {
    await api(`/api/prescriptions/${encodeURIComponent(serverId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        extractedText: analysis.ocrText,
        medicines: analysis.medicines.map((m) => ({
          id: m.id,
          name: m.extractedName,
          strength: m.strength,
          dosage: m.dosage,
          route: m.route,
          frequency: m.frequency,
          duration: m.duration,
          quantity: Number(m.quantity) || 0,
          confidence: m.confidence,
          matchStatus: m.match.status,
        })),
        interactionAlerts: analysis.interactionAlerts,
        dosageAlerts: analysis.dosageAlerts,
      }),
    });
    return { ok: true, serverId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'analysis-sync-failed' };
  }
}

/** Persist the review checklist + pharmacist identity. */
export async function syncReview(
  serverId: string,
  checklist: ReviewChecklist,
  pharmacistName: string,
  notes = '',
): Promise<SyncOutcome> {
  if (!serverId) return { ok: false, error: 'no-server-id' };
  try {
    await api(`/api/prescriptions/${encodeURIComponent(serverId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ checklist, notes, pharmacistName }),
    });
    return { ok: true, serverId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'review-sync-failed' };
  }
}

async function decision(
  serverId: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<SyncOutcome> {
  if (!serverId) return { ok: false, error: 'no-server-id' };
  try {
    await api(`/api/prescriptions/${encodeURIComponent(serverId)}/${path}`, {
      method: 'POST',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ok: true, serverId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'decision-sync-failed' };
  }
}

export const approveServerPrescription = (id: string) => decision(id, 'approve');
export const rejectServerPrescription = (id: string, d: WorkflowDecision) => decision(id, 'reject', { reason: d.reason || d.note || 'Rejected' });
export const clarifyServerPrescription = (id: string, d: WorkflowDecision) => decision(id, 'clarification', { recipientType: d.recipient || 'prescriber', message: d.note || d.reason || 'Clarification requested' });
export const dispenseServerPrescription = (id: string) => decision(id, 'dispense');

/** Server list (org-scoped server-side). Returns [] when unreachable. */
export async function listServerPrescriptions(): Promise<PrescriptionRecord[]> {
  if (!(await serverAvailable()) || !backendSession()) return [];
  try {
    const data = await api<{ items: Record<string, unknown>[] }>('/api/prescriptions?limit=100');
    return data.items.map(mapServerRecord);
  } catch {
    return [];
  }
}

/** Fetch one server record (mapped), or null. */
export async function getServerPrescription(id: string): Promise<PrescriptionRecord | null> {
  if (!(await serverAvailable()) || !backendSession()) return null;
  try {
    const s = await api<Record<string, unknown>>(`/api/prescriptions/${encodeURIComponent(id)}`);
    return mapServerRecord(s);
  } catch {
    return null;
  }
}

/** Honest Random-Forest dataset progress (row counts toward the trainer gate). */
export interface MlTrainingStatus {
  rawRows: number; uniqueRows: number; validRows: number; invalidRows: number; duplicateRows: number;
  labeledRows: number; matchRows: number; needsVerificationRows: number;
  minimumRequired: number; rowsNeeded: number; datasetReady: boolean; trainingStatus: string;
  gate: number; needed: number; progressPct: number; trained: boolean; trainingBlockedReason: string | null;
}

export async function getMlTrainingStatus(): Promise<MlTrainingStatus | null> {
  if (!(await serverAvailable()) || !backendSession()) return null;
  try {
    return await api<MlTrainingStatus>('/api/prescriptions/ml-training-status');
  } catch {
    return null;
  }
}

export type { PrescriptionStatus };

// --- Confirm → Hash → Blockchain (Polygon Amoy) -----------------------------

export interface ConfirmResult {
  ok: boolean;
  hash?: string;
  error?: string;
}

/** Confirm the reviewed medicines; the server computes the SHA-256 over them. */
export async function confirmPrescription(
  serverId: string,
  medicines: { name: string; correctedName?: string | null; strength?: string | null; dosage?: string | null; frequency?: string | null; duration?: string | null; route?: string | null; instructions?: string | null; quantity?: number | null }[],
): Promise<ConfirmResult> {
  if (!serverId) return { ok: false, error: 'The prescription is not saved on the server.' };
  try {
    const data = await api<{ hash: string }>(`/api/prescriptions/${encodeURIComponent(serverId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ medicines }),
    });
    return { ok: true, hash: data.hash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Confirmation failed.' };
  }
}

export interface BlockchainRegistration {
  network: string;
  txHash: string;
  blockNumber?: number;
  explorerUrl: string;
  contractAddress: string;
  registeredAt: string;
  hash: string;
}

/** Anchor the confirmed hash on Polygon Amoy. Never fabricates success. */
export async function registerOnBlockchain(serverId: string): Promise<
  { ok: true; tx: BlockchainRegistration } | { ok: false; error: string; hint?: string; status: number }
> {
  if (!serverId) return { ok: false, error: 'The prescription is not saved on the server.', status: 400 };
  try {
    const data = await api<{ transaction: BlockchainRegistration }>(`/api/prescriptions/${encodeURIComponent(serverId)}/blockchain/register`, {
      method: 'POST',
      timeoutMs: 120_000, // chain confirmation can be slow
    });
    return { ok: true, tx: data.transaction };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    const hint = (err as { details?: string }).details;
    return { ok: false, error: err instanceof Error ? err.message : 'Registration failed.', hint, status };
  }
}

export interface BlockchainVerification {
  verified: boolean;
  registered: boolean;
  onChainHash?: string;
  localHash?: string;
  reason: string;
}

/** Re-read the on-chain hash and compare with the confirmed data hash. */
export async function verifyOnBlockchain(serverId: string): Promise<
  { ok: true; result: BlockchainVerification } | { ok: false; error: string; status: number }
> {
  if (!serverId) return { ok: false, error: 'The prescription is not saved on the server.', status: 400 };
  try {
    const result = await api<BlockchainVerification>(`/api/prescriptions/${encodeURIComponent(serverId)}/blockchain/verify`, {
      method: 'GET',
      timeoutMs: 30_000,
    });
    return { ok: true, result };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed.', status };
  }
}

/**
 * Ask the backend to analyze the already-uploaded, encrypted prescription
 * image. Resolves to the updated server record or a typed failure.
 */
export async function analyzeWithHuggingFace(
  serverId: string,
): Promise<{ ok: true; record: PrescriptionRecord } | { ok: false; error: string; retryable: boolean; status: number }> {
  if (!serverId) return { ok: false, error: 'The prescription was not saved on the server.', retryable: false, status: 400 };
  try {
    const updated = await api<Record<string, unknown>>(`/api/prescriptions/${encodeURIComponent(serverId)}/analyze`, {
      method: 'POST',
      body: JSON.stringify({}),
      timeoutMs: 90_000,
    });
    return { ok: true, record: mapServerRecord(updated) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI analysis could not be completed.';
    const status = (err as { status?: number }).status ?? 0;
    return { ok: false, error: msg, retryable: status === 0 || status >= 500 || status === 429, status };
  }
}

// ---------------------------------------------------------------------------
// Multi-AI provider support
// ---------------------------------------------------------------------------

/**
 * Fetch the list of AI providers currently configured on the backend.
 * Returns [] if the backend is unreachable or no providers are configured.
 * Never exposes credentials.
 */
export async function getAvailableProviders(serverId: string): Promise<AvailableProvider[]> {
  if (!serverId || !backendSession()) return [];
  try {
    const data = await api<{ providers: AvailableProvider[] }>(
      `/api/prescriptions/${encodeURIComponent(serverId)}/providers`,
    );
    return Array.isArray(data.providers) ? data.providers : [];
  } catch {
    return [];
  }
}

/**
 * Re-analyze the SAME original image with a different AI provider.
 * The backend stores the result in analysisHistory[] WITHOUT overwriting
 * the primary analysis. Returns the re-analysis entry and the comparison.
 */
export async function reanalyzeWithProvider(
  serverId: string,
  _file: File | null,
  providerId: string,
): Promise<
  { ok: true; reanalysis: AnalysisHistoryEntry; comparison: AnalysisComparison | null }
  | { ok: false; error: string; retryable: boolean }
> {
  if (!serverId) return { ok: false, error: 'The prescription is not saved on the server.', retryable: false };

  // No image is sent: the backend re-reads the STORED encrypted original so
  // every provider analyzes byte-identical input.

  try {
    const result = await api<{
      success: boolean;
      reanalysis: AnalysisHistoryEntry;
      comparison: AnalysisComparison | null;
    }>(`/api/prescriptions/${encodeURIComponent(serverId)}/reanalyze`, {
      method: 'POST',
      body: JSON.stringify({
        provider: providerId,
      }),
      timeoutMs: 240_000,
    });
    return { ok: true, reanalysis: result.reanalysis, comparison: result.comparison };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Re-analysis failed.';
    const status = (err as { status?: number }).status ?? 0;
    return { ok: false, error: msg, retryable: status === 0 || status >= 500 || status === 429 };
  }
}

/**
 * Run the independent OCR engine AND the AI model IN PARALLEL on the same
 * stored original image, then compare field-by-field through the ML
 * comparison layer. No image is uploaded from the client — the server re-reads
 * the stored encrypted original so both pipelines see byte-identical input.
 * Never throws: resolves to a typed result either way.
 */
export async function runParallelAnalysis(
  serverId: string,
  ocrProvider: string,
  aiProvider: string,
): Promise<
  { ok: true; data: ParallelAnalysisResult }
  | { ok: false; error: string; retryable: boolean }
> {
  if (!serverId) return { ok: false, error: 'The prescription is not saved on the server.', retryable: false };
  try {
    const data = await api<ParallelAnalysisResult>(
      `/api/prescriptions/${encodeURIComponent(serverId)}/parallel-analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrProvider, aiProvider }),
        timeoutMs: 300_000,
      },
    );
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Parallel analysis failed.';
    const status = (err as { status?: number }).status ?? 0;
    return { ok: false, error: msg, retryable: status === 0 || status >= 500 || status === 429 };
  }
}
