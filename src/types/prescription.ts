// ---------------------------------------------------------------------------
// Prescription digitization types — PROTOTYPE ONLY.
// These types mirror the intended backend API contracts (see the Phase 4 plan)
// so a real service can replace the mock services without UI changes.
// No patient data in this file or in mock data is real. Synthetic demo only.
// ---------------------------------------------------------------------------

import type { UserRole } from './index';

export type PrescriptionRoleAccess = Extract<UserRole, 'dealer' | 'hospital'>;

export type PrescriptionStatus =
  | 'uploaded'
  | 'processing'
  | 'needs_correction'
  | 'analyzed'
  | 'safety_review_required'
  | 'clarification_requested'
  | 'approved'
  | 'rejected'
  | 'dispensed'
  | 'cancelled';

export type AlertSeverity = 'critical' | 'high' | 'moderate' | 'informational';

export type MatchStatus = 'matched' | 'possible_match' | 'not_found' | 'needs_review';

export type AlertReviewStatus = 'unreviewed' | 'acknowledged' | 'requires_clarification' | 'resolved';

export type DosageStatus =
  | 'within_expected_range'
  | 'possible_overdose'
  | 'possible_underdose'
  | 'frequency_concern'
  | 'duration_concern'
  | 'patient_specific_review_required'
  | 'unable_to_validate';

/** Where an analysis result came from. */
export type AnalysisProvider =
  | 'mock'
  | 'huggingface'
  | 'openai'
  | 'openai-compatible'
  | 'gemini'
  | 'gpt5'
  | 'googlevision'
  | 'awstextract'
  | 'azurevision'
  | 'olmocr'
  | 'custom';

/** A provider available on the backend (no credentials). */
export interface AvailableProvider {
  id: string;
  label: string;
  description: string;
  model: string;
}

/** Status of one pipeline (OCR / AI) in a parallel analysis run. */
export type ParallelPipelineStatus = 'complete' | 'failed';

/** Reference-database validation result for one extracted medicine. */
export interface MedicineValidation {
  queriedName: string | null;
  normalizedName: string | null;
  matchedName: string | null;
  confidence: number;
  similarity: number;
  method: 'exact' | 'alias' | 'token' | 'fuzzy' | 'below_cutoff' | 'none';
  source: string;
  exists: boolean;
  uncertain: boolean;
  needsVerification: boolean;
  genericName: string | null;
  category: string | null;
  dosageForm: string | null;
  strengthStatus: 'listed' | 'not_listed' | 'unknown';
  listedStrengths: string[] | null;
}

/** Machine-learning layer descriptor for the parallel comparison. */
export interface MlComparison {
  model: string;
  status: 'trained' | 'training_required';
  engine: string;
  verdict: 'match' | 'needs_verification';
  /** Only legitimately calculated values: field-agreement or a real trained-model output. */
  confidence: number;
  /** Where the confidence came from — never presented as model probability otherwise. */
  confidenceSource: 'trained_model' | 'field_agreement';
  drivers: string[];
  features: Record<string, number>;
  prediction: unknown;
  statusNote: string;
}

/** Full parallel OCR+AI analysis response. */
export interface ParallelAnalysisResult {
  success: boolean;
  startedAt: string;
  finishedAt: string;
  imageSource: string;
  ocr: {
    provider: string;
    status: ParallelPipelineStatus;
    error?: string;
    result: {
      provider: string;
      providerLabel: string;
      model: string;
      analyzedAt: string;
      overallConfidence: number;
      isOcrOnly: boolean;
      warnings: string[];
      doctor: { name: string | null; registrationNumber: string | null };
      patient: { name: string | null; age: number | null; gender: string | null };
      date: string | null;
      medicines: Array<{
        name: string | null;
        strength: string | null;
        dosage: string | null;
        frequency: string | null;
        duration: string | null;
        route: string | null;
        instructions?: string | null;
        confidence: number;
        needsVerification: boolean;
        validation?: MedicineValidation;
      }>;
    } | null;
  };
  ai: {
    provider: string;
    status: ParallelPipelineStatus;
    error?: string;
    result: {
      provider: string;
      providerLabel: string;
      model: string;
      analyzedAt: string;
      overallConfidence: number;
      warnings: string[];
      doctor: { name: string | null; registrationNumber: string | null };
      patient: { name: string | null; age: number | null; gender: string | null };
      date: string | null;
      medicines: ParallelAnalysisResult['ocr']['result'] extends null ? never : Array<{
        name: string | null;
        strength: string | null;
        dosage: string | null;
        frequency: string | null;
        duration: string | null;
        route: string | null;
        instructions?: string | null;
        confidence: number;
        needsVerification: boolean;
        validation?: MedicineValidation;
      }>;
    } | null;
  };
  comparison: AnalysisComparison | null;
  ml: MlComparison | null;
  mlStatus: 'trained' | 'training_required' | 'not_run';
  rfStatus: {
    algorithm: string;
    trained: boolean;
    modelVersion: string | null;
    treeCount: number;
    datasetAvailable: boolean;
    featureKeys: string[];
    trainingDataPath: string;
    note: string;
  };
}

/** Single field comparison result from a two-provider comparison. */
export interface ComparisonField {
  category: string;
  field: string;
  label: string;
  medicineIndex?: number;
  ai1: string | number | null;
  ai2: string | number | null;
  status: 'match' | 'needs_verification';
}

/** Summary statistics of a two-provider comparison. */
export interface ComparisonSummary {
  totalFields: number;
  matched: number;
  disagreements: number;
  agreementPercent: number;
}

/** Full comparison result returned by POST /reanalyze. */
export interface AnalysisComparison {
  fields: ComparisonField[];
  summary: ComparisonSummary;
}

/** One entry in the analysisHistory[] for a prescription. */
export interface AnalysisHistoryEntry {
  attemptNumber: number;
  provider: string;
  providerLabel: string;
  model: string;
  analyzedAt: string;
  overallConfidence: number;
  medicineCount: number;
  warnings: string[];
  doctor: { name: string | null; registrationNumber: string | null };
  patient: { name: string | null; age: number | null; gender: string | null };
  date: string | null;
  medicines: Array<{
    id: string;
    name: string | null;
    strength: string | null;
    dosage: string | null;
    frequency: string | null;
    duration: string | null;
    route: string | null;
    confidence: number;
    needsVerification: boolean;
  }>;
}


export interface DrugMatch {
  /** Identifier in the (mock) drug database, or null when not found. */
  drugId: string | null;
  /** Medicine name as read from the prescription image. */
  extractedName: string;
  matchedName: string | null;
  genericName: string | null;
  brandName: string | null;
  strength: string | null;
  dosageForm: string | null;
  status: MatchStatus;
  /** 0–1 OCR confidence for this row. */
  confidence: number;
  /** True when confidence is below the manual-verification threshold. */
  manualVerificationRequired: boolean;
}

export interface PrescriptionMedicine {
  id: string;
  /** Free-text fields read by the (mock) OCR — editable by the reviewer. */
  extractedName: string;
  strength: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  confidence: number;
  match: DrugMatch;
}

export interface InteractionAlert {
  id: string;
  severity: AlertSeverity;
  /** Medicine (extracted) names involved. */
  medicines: string[];
  reason: string;
  potentialConcern: string;
  recommendedAction: string;
  source: string;
  reviewStatus: AlertReviewStatus;
  note?: string;
}

export interface DosageAlert {
  id: string;
  severity: AlertSeverity;
  medicine: string;
  status: DosageStatus;
  /** Which field triggered the warning (e.g. "frequency"). */
  flaggedField: string;
  reason: string;
  missingInformation: string[];
  suggestedAction: string;
  reviewStatus: AlertReviewStatus;
  note?: string;
}

export interface PrescriptionFormData {
  patientReference: string;
  patientName?: string;
  patientAge: number;
  patientGender?: 'female' | 'male' | 'other' | '';
  knownAllergies?: string;
  existingConditions?: string;
  currentMedicines?: string;
  prescriptionDate: string;
  prescriberName?: string;
  /** Hospital-only. */
  department?: string;
}

export interface PrescriptionAnalysis {
  prescriptionId: string;
  status: PrescriptionStatus;
  /** Raw (mock) OCR text. */
  ocrText: string;
  medicines: PrescriptionMedicine[];
  interactionAlerts: InteractionAlert[];
  dosageAlerts: DosageAlert[];
  /** 0–1 overall analysis confidence. */
  confidence: number;
  requiresHumanReview: true;
  analysisProvider: AnalysisProvider;
  /** Optional model name (e.g. 'Qwen/Qwen2.5-VL-3B-Instruct'). */
  analysisModel?: string;
  /** Optional per-analysis confidence distinct from overall. */
  analysisConfidence?: number;
  analyzedAt: string;
}

// ---------------------------- Phase 2: workflow -----------------------------

/** Fixed review checklist enforced before approval. */
export interface ReviewChecklist {
  originalReviewed: boolean;
  namesVerified: boolean;
  strengthsVerified: boolean;
  dosagesReviewed: boolean;
  frequencyReviewed: boolean;
  durationReviewed: boolean;
  allergiesReviewed: boolean;
  interactionsReviewed: boolean;
  dosageAlertsReviewed: boolean;
  decisionConfirmed: boolean;
}

export const EMPTY_CHECKLIST: ReviewChecklist = {
  originalReviewed: false, namesVerified: false, strengthsVerified: false,
  dosagesReviewed: false, frequencyReviewed: false, durationReviewed: false,
  allergiesReviewed: false, interactionsReviewed: false, dosageAlertsReviewed: false,
  decisionConfirmed: false,
};

export const CHECKLIST_LABELS: Record<keyof ReviewChecklist, string> = {
  originalReviewed: 'Original prescription reviewed',
  namesVerified: 'Medicine names verified',
  strengthsVerified: 'Strengths verified',
  dosagesReviewed: 'Dosages reviewed',
  frequencyReviewed: 'Frequency reviewed',
  durationReviewed: 'Duration reviewed',
  allergiesReviewed: 'Patient allergies reviewed',
  interactionsReviewed: 'Drug interactions reviewed',
  dosageAlertsReviewed: 'Dosage alerts reviewed',
  decisionConfirmed: 'Final decision confirmed',
};

export type AuditEventType =
  | 'created'
  | 'uploaded'
  | 'analysis_started'
  | 'analysis_completed'
  | 'medicine_corrected'
  | 'alert_acknowledged'
  | 'note_added'
  | 'clarification_requested'
  | 'approved'
  | 'rejected'
  | 'dispensed'
  | 'draft_saved';

export interface PrescriptionAuditEvent {
  id: string;
  type: AuditEventType;
  label: string;
  actor: string;
  timestamp: string;
  note?: string;
}

/** Who performed a workflow decision (approval/rejection/clarification/dispense). */
export interface WorkflowDecision {
  actor: string;
  reason?: string;
  note?: string;
  recipient?: 'prescriber' | 'department' | 'patient' | 'internal_pharmacist';
}

export interface PrescriptionRecord {
  id: string;
  patientReference: string;
  prescriptionDate: string;
  medicineCount: number;
  criticalAlerts: number;
  status: PrescriptionStatus;
  analysisProvider: AnalysisProvider;
  createdAt: string;
  /** Role that created the record — controls visibility in the mock history. */
  createdByRole: PrescriptionRoleAccess;
  /** Copied from the form at creation — used by hospital list views. */
  prescriberName?: string;
  /** Copied from the form at creation — used by hospital list views. */
  department?: string;
  analysis?: PrescriptionAnalysis;
  /** Per-record review checklist (reset on new analysis). */
  checklist?: ReviewChecklist;
  /** Pharmacist identity captured with the draft/approval. */
  pharmacistName?: string;
  /** Last workflow decision metadata (approval/rejection/clarification/dispense). */
  decision?: WorkflowDecision;
  /** True once "Save local review draft" has written an analysis locally. */
  reviewDraftSaved?: boolean;
  /** Session-local, append-only audit trail (prototype only). */
  auditTrail: PrescriptionAuditEvent[];
  /** History of re-analyses (attempt 2+). Attempt 1 is the primary analysis. */
  analysisHistory?: AnalysisHistoryEntry[];
}


/** Analysis step descriptor used by the scanner progress stepper. */
export interface AnalysisStep {
  id: string;
  label: string;
}
