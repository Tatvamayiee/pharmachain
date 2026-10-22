// ---------------------------------------------------------------------------
// useScannerReview — single owner of the in-review analysis state.
//
// The prescription SERVICE owns the session record (status, checklist,
// pharmacist identity, decisions, audit trail). This hook is the single
// read/write facade the scanner UI uses: corrections are hook-local until a
// draft save or decision persists them; every alert review and workflow
// decision goes through a service mutation so audit events are recorded
// exactly once. Server-side AI (Hugging Face via /analyze) is the primary
// path; the clearly-labelled local prototype analysis is the fallback.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PrescriptionAnalysis, PrescriptionRecord, PrescriptionRoleAccess,
  ReviewChecklist, WorkflowDecision,
} from '../types/prescription';
import {
  ANALYSIS_STEPS,
  addRecordAlertNote,
  acknowledgeRecordAlert,
  approvePrescription,
  getPrescriptionByIdMock,
  registerLocalPrescriptionRecord,
  markPrescriptionDispensed,
  rematchMedicine,
  rejectPrescription,
  requestPrescriptionClarification,
  setRecordPharmacist,
  updateLocalPrescriptionAnalysis,
  updateReviewChecklist,
  uploadPrescriptionImage,
} from '../services/prescriptionService';
import type { WorkflowResult } from '../services/prescriptionService';
import {
  createServerPrescription, syncAnalysis, syncReview,
  approveServerPrescription, rejectServerPrescription,
  clarifyServerPrescription, dispenseServerPrescription,
  analyzeWithHuggingFace, serverAvailable, getServerPrescription,
} from '../../../platform/api/backendSync';

export type ReviewSource =
  | { kind: 'fresh' }
  | { kind: 'record'; recordId: string };

export interface AnalysisInput {
  file: File;
  fileUrl: string;
  form: {
    patientReference: string;
    patientAge: number;
    prescriptionDate: string;
    prescriberName?: string;
    department?: string;
    knownAllergies?: string;
    existingConditions?: string;
    currentMedicines?: string;
  };
}

/** AI failure surfaced to the UI with a retry affordance. */
export interface AiErrorState {
  message: string;
  retryable: boolean;
  serverId: string;
  input: AnalysisInput;
  uploadFailed?: boolean;
  /** True when the image payload was actually sent to /analyze (so a FAIL
   *  means the SERVER rejected it, not that it was never sent). */
  imageSent?: boolean;
}

export function useScannerReview(role: PrescriptionRoleAccess, recordId: string | null) {
  const [analysis, setAnalysis] = useState<PrescriptionAnalysis | null>(null);
  const [originalAnalysis, setOriginalAnalysis] = useState<PrescriptionAnalysis | null>(null);
  const [analysisRecordId, setAnalysisRecordId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);
  const [draftPharmacist, setDraftPharmacist] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [initialReference, setInitialReference] = useState<string | null>(null);
  /** Server-side record id (MongoDB) when the backend accepted the sync. */
  const [serverId, setServerId] = useState<string | null>(null);
  /** True once the server has a copy of the latest analysis. */
  const [synced, setSynced] = useState(false);
  /** Server AI failure state with retry affordance. */
  const [aiError, setAiError] = useState<AiErrorState | null>(null);
  /** Where the displayed analysis came from: server AI. */
  const [aiSource, setAiSource] = useState<'server' | 'local' | null>(null);
  // Bumped after every service mutation so record-derived UI re-renders.
  const [recordVersion, setRecordVersion] = useState(0);

  // Hydrate from history (router state id). The authoritative source is the
  // SERVER record — hydrating from it sets serverId so confirm/blockchain
  // anchoring works for historical prescriptions, not just fresh scans.
  // Falls back to the session store when the backend is unreachable.
  useEffect(() => {
    if (!recordId) return;
    let alive = true;
    (async () => {
      try {
        const server = await getServerPrescription(recordId);
        if (server && server.analysis && alive) {
          registerLocalPrescriptionRecord(server);
          setAnalysis(server.analysis);
          setOriginalAnalysis(server.analysis);
          setAnalysisRecordId(server.id);
          setSavedDraft(!!server.reviewDraftSaved);
          setInitialReference(server.patientReference ?? null);
          setServerId(server.id);
          setAiSource('server');
          setStepIndex(ANALYSIS_STEPS.length);
          return;
        }
      } catch {
        // Backend unreachable — fall through to the session record.
      }
      if (!alive) return;
      const rec = getPrescriptionByIdMock(recordId);
      if (!rec || !rec.analysis) {
        setNotice(`Record ${recordId} is no longer available in this session. Run a new analysis.`);
        return;
      }
      setAnalysis(rec.analysis);
      setOriginalAnalysis(rec.analysis);
      setAnalysisRecordId(rec.id);
      setSavedDraft(!!rec.reviewDraftSaved);
      setInitialReference(rec.patientReference ?? null);
      setStepIndex(ANALYSIS_STEPS.length);
    })();
    return () => { alive = false; };
  }, [recordId]);

  const runAnalysis = useCallback(async (input: AnalysisInput) => {
    setAnalysis(null);
    setOriginalAnalysis(null);
    setSavedDraft(false);
    setDraftPharmacist(null);
    setStepIndex(0);
    setSynced(false);
    setAiError(null);
    setAiSource(null);
    setNotice(null);

    // 1. Check Backend Availability
    const isServerUp = await serverAvailable(5_000);
    if (!isServerUp) {
      setStepIndex(null);
      setAiError({
        message: 'Backend server is unreachable. Please ensure the backend server is running.',
        retryable: true,
        serverId: '',
        input,
      });
      setNotice('Unable to analyze this prescription. Please try again.');
      return null;
    }

    // 2. Create prescription record on the backend
    setStepIndex(0); // reading prescription image
    const created = await createServerPrescription({
      patientReference: input.form.patientReference,
      patientAge: input.form.patientAge,
      prescriptionDate: input.form.prescriptionDate,
      prescriberName: input.form.prescriberName,
      department: input.form.department,
      allergies: input.form.knownAllergies,
      existingConditions: input.form.existingConditions,
      currentMedicines: input.form.currentMedicines,
    });

    if (!created.ok || !created.serverId) {
      setStepIndex(null);
      setAiError({
        message: created.error || 'Failed to create prescription record on backend.',
        retryable: true,
        serverId: '',
        input,
      });
      setNotice('Unable to analyze this prescription. Please try again.');
      return null;
    }

    const srvId = created.serverId;
    setServerId(srvId);

    // 3. Upload the real image file to server storage
    setStepIndex(1); // uploading file
    try {
      await uploadPrescriptionImage(srvId, input.file);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0;
      setStepIndex(null);
      setAiError({
        message: err instanceof Error ? err.message : 'Prescription image could not be uploaded.',
        retryable: status === 0 || status >= 500 || status === 429,
        serverId: srvId,
        input,
        uploadFailed: true,
        imageSent: false,
      });
      setNotice('Unable to analyze this prescription. Please try again.');
      return null;
    }

    // 4. Analyze the encrypted server-side copy; do not send the image a second time.
    setStepIndex(2); // extracting text (server AI)
    const aiResult = await analyzeWithHuggingFace(srvId);

    if (!aiResult.ok) {
      // Real AI analysis failed — honest error, NO mock fallback
      setStepIndex(null);
      setAiError({
        message: aiResult.error || 'Prescription analysis failed.',
        retryable: aiResult.retryable,
        serverId: srvId,
        input,
        imageSent: true,
      });
      setNotice('Unable to analyze this prescription. Please try again.');
      return null;
    }

    if (!aiResult.record.analysis) {
      setStepIndex(null);
      setAiError({
        message: 'No analysis returned from AI provider.',
        retryable: true,
        serverId: srvId,
        input,
      });
      setNotice('Unable to analyze this prescription. Please try again.');
      return null;
    }

    const realAnalysis = aiResult.record.analysis;
    registerLocalPrescriptionRecord(aiResult.record);

    setStepIndex(ANALYSIS_STEPS.length);
    setAnalysis(realAnalysis);
    setOriginalAnalysis(realAnalysis);
    setAnalysisRecordId(aiResult.record.id);
    setRecordVersion((v) => v + 1);
    setSynced(true);
    setAiSource('server');
    setAiError(null);
    setNotice(null);
    return { record: aiResult.record, analysis: realAnalysis };
  }, []);

  // ---- Corrections (hook-local until draft save / decision) -----------------

  const correctionsDirty =
    !!analysis && !!originalAnalysis &&
    JSON.stringify(analysis.medicines) !== JSON.stringify(originalAnalysis.medicines);

  const rematchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateMedicine = useCallback((medId: string, patch: Record<string, string>) => {
    setAnalysis((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        medicines: prev.medicines.map((m) => (m.id === medId ? { ...m, ...patch } : m)),
      };
    });
    // Debounced re-match when the reviewer corrects the medicine name — clears
    // the manual-verification blocker on a clean match. The corrected name is
    // preserved in the merge below so the service-owned record update cannot
    // resurrect the pre-correction text.
    if ('extractedName' in patch && analysisRecordId) {
      const correctedName = patch.extractedName;
      if (rematchTimer.current) clearTimeout(rematchTimer.current);
      rematchTimer.current = setTimeout(async () => {
        const clean = await rematchMedicine(medId, correctedName);
        if (clean) {
          const rec = getPrescriptionByIdMock(analysisRecordId);
          const fresh = rec?.analysis;
          if (rec && fresh) {
            setAnalysis((prev) => (prev
              ? { ...prev, ...fresh, medicines: fresh.medicines.map((m) => (m.id === medId ? { ...m, extractedName: correctedName } : m)) }
              : prev));
            setRecordVersion((v) => v + 1);
          }
        }
      }, 600);
    }
  }, [analysisRecordId]);

  const resetCorrections = useCallback(() => {
    setAnalysis((prev) => (prev && originalAnalysis
      ? { ...prev, medicines: originalAnalysis.medicines }
      : prev));
  }, [originalAnalysis]);

  // ---- Write-through (draft save / pre-decision persist) --------------------

  const persistAnalysis = useCallback((): boolean => {
    if (!analysis || !analysisRecordId) return false;
    const ok = updateLocalPrescriptionAnalysis(analysisRecordId, analysis);
    if (ok) setRecordVersion((v) => v + 1);
    return ok;
  }, [analysis, analysisRecordId]);

  const saveDraft = useCallback((pharmacistName: string): boolean => {
    if (!analysis || !analysisRecordId) return false;
    const ok = persistAnalysis();
    if (ok) {
      setRecordPharmacist(analysisRecordId, pharmacistName);
      setSavedDraft(true);
      setDraftPharmacist(pharmacistName);
      setRecordVersion((v) => v + 1);
      if (serverId) {
        syncAnalysis(serverId, analysis).then((r) => setSynced(r.ok));
        syncReview(serverId, analysisRecordId ? (getPrescriptionByIdMock(analysisRecordId)?.checklist ?? ({} as never)) : ({} as never), pharmacistName);
      }
    }
    return ok;
  }, [analysis, analysisRecordId, persistAnalysis, serverId]);

  // ---- Alert review (via service mutations → audit trail) -------------------

  const mutateAlert = useCallback((
    kind: 'interaction' | 'dosage',
    alertId: string,
    mutation: (id: string, actor: string) => WorkflowResult,
    fallback: (a: PrescriptionAnalysis | null) => PrescriptionAnalysis | null,
  ) => {
    if (analysisRecordId) {
      const result = mutation(analysisRecordId, 'Demo pharmacist (unrecorded)');
      if (result.ok) {
        setAnalysis(result.record.analysis ?? null);
        setRecordVersion((v) => v + 1);
      }
      return result;
    }
    setAnalysis((prev) => fallback(prev));
    return null;
  }, [analysisRecordId]);

  const acknowledgeAlert = useCallback((kind: 'interaction' | 'dosage', alertId: string) => {
    return mutateAlert(kind, alertId,
      (id, actor) => acknowledgeRecordAlert(id, kind, alertId, actor),
      (prev) => {
        if (!prev) return null;
        return {
          ...prev,
          interactionAlerts: prev.interactionAlerts.map((a) => (a.id === alertId && kind === 'interaction'
            ? { ...a, reviewStatus: 'acknowledged' }
            : a)),
          dosageAlerts: prev.dosageAlerts.map((a) => (a.id === alertId && kind === 'dosage'
            ? { ...a, reviewStatus: 'acknowledged' }
            : a)),
        };
      });
  }, [mutateAlert]);

  const noteAlert = useCallback((kind: 'interaction' | 'dosage', alertId: string, note: string) => {
    return mutateAlert(kind, alertId,
      (id, actor) => addRecordAlertNote(id, kind, alertId, note, actor),
      (prev) => {
        if (!prev) return null;
        return {
          ...prev,
          interactionAlerts: prev.interactionAlerts.map((a) => (a.id === alertId && kind === 'interaction'
            ? { ...a, note, reviewStatus: a.reviewStatus === 'unreviewed' ? 'requires_clarification' : a.reviewStatus }
            : a)),
          dosageAlerts: prev.dosageAlerts.map((a) => (a.id === alertId && kind === 'dosage'
            ? { ...a, note, reviewStatus: a.reviewStatus === 'unreviewed' ? 'requires_clarification' : a.reviewStatus }
            : a)),
        };
      });
  }, [mutateAlert]);

  // ---- Workflow decisions (service validates transitions + blockers) --------

  const updateChecklist = useCallback((checklist: ReviewChecklist) => {
    if (!analysisRecordId) return;
    const result = updateReviewChecklist(analysisRecordId, checklist);
    if (result.ok) setRecordVersion((v) => v + 1);
  }, [analysisRecordId]);

  const setPharmacist = useCallback((name: string) => {
    if (!analysisRecordId) return;
    const result = setRecordPharmacist(analysisRecordId, name);
    if (result.ok) setRecordVersion((v) => v + 1);
  }, [analysisRecordId]);

  const approve = useCallback((decision: WorkflowDecision) => {
    if (!analysisRecordId) return { ok: false as const, error: 'No analysis record to approve.' };
    const result = approvePrescription(analysisRecordId, decision);
    if (result.ok) {
      setRecordVersion((v) => v + 1);
      if (serverId) approveServerPrescription(serverId);
    }
    return result;
  }, [analysisRecordId, serverId]);

  const reject = useCallback((decision: WorkflowDecision) => {
    if (!analysisRecordId) return { ok: false as const, error: 'No analysis record to reject.' };
    const result = rejectPrescription(analysisRecordId, decision);
    if (result.ok) {
      setRecordVersion((v) => v + 1);
      if (serverId) rejectServerPrescription(serverId, decision);
    }
    return result;
  }, [analysisRecordId, serverId]);

  const clarify = useCallback((decision: WorkflowDecision) => {
    if (!analysisRecordId) return { ok: false as const, error: 'No analysis record to clarify.' };
    const result = requestPrescriptionClarification(analysisRecordId, decision);
    if (result.ok) {
      setRecordVersion((v) => v + 1);
      if (serverId) clarifyServerPrescription(serverId, decision);
    }
    return result;
  }, [analysisRecordId, serverId]);

  const dispense = useCallback((decision: WorkflowDecision) => {
    if (!analysisRecordId) return { ok: false as const, error: 'No analysis record to dispense.' };
    const result = markPrescriptionDispensed(analysisRecordId, decision);
    if (result.ok) {
      setRecordVersion((v) => v + 1);
      if (serverId) dispenseServerPrescription(serverId);
    }
    return result;
  }, [analysisRecordId, serverId]);

  /** Retry the server AI analysis after a failure (same record, same image). */
  const retryAiAnalysis = useCallback(async (): Promise<boolean> => {
    if (!aiError || !aiError.serverId) return false;
    setNotice(null);
    if (aiError.uploadFailed) {
      setStepIndex(1);
      try {
        await uploadPrescriptionImage(aiError.serverId, aiError.input.file);
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        setStepIndex(null);
        setAiError((prev) => (prev ? {
          ...prev,
          message: err instanceof Error ? err.message : 'Prescription image could not be uploaded.',
          retryable: status === 0 || status >= 500 || status === 429,
        } : prev));
        setNotice('Unable to analyze this prescription. Please try again.');
        return false;
      }
      setAiError((prev) => (prev ? { ...prev, uploadFailed: false } : prev));
    }
    setStepIndex(2);
    const aiResult = await analyzeWithHuggingFace(aiError.serverId);
    if (!aiResult.ok) {
      setStepIndex(null);
      setAiError((prev) => (prev ? { ...prev, message: aiResult.error || 'Prescription analysis failed.', retryable: aiResult.retryable } : prev));
      setNotice('Unable to analyze this prescription. Please try again.');
      return false;
    }

    if (!aiResult.record.analysis) {
      setStepIndex(null);
      setAiError((prev) => (prev ? { ...prev, message: 'No analysis returned from AI provider.', retryable: true } : prev));
      setNotice('Unable to analyze this prescription. Please try again.');
      return false;
    }

    const realAnalysis = aiResult.record.analysis;
    registerLocalPrescriptionRecord(aiResult.record);

    setStepIndex(ANALYSIS_STEPS.length);
    setAnalysis(realAnalysis);
    setOriginalAnalysis(realAnalysis);
    setAnalysisRecordId(aiResult.record.id);
    setRecordVersion((v) => v + 1);
    setSynced(true);
    setAiSource('server');
    setAiError(null);
    setNotice(null);
    return true;
  }, [aiError]);

  const clearNotice = useCallback(() => setNotice(null), []);

  // The live record (service-owned). recordVersion forces re-render after
  // in-place service mutations.
  const record: PrescriptionRecord | null =
    (analysisRecordId ? getPrescriptionByIdMock(analysisRecordId) : null) ?? null;
  void recordVersion;

  return {
    // state
    analysis, originalAnalysis, analysisRecordId, stepIndex, savedDraft,
    draftPharmacist, notice, initialReference, record, serverId, synced, aiError, aiSource,
    // derived
    analyzing: stepIndex !== null && (analysis === null || stepIndex < ANALYSIS_STEPS.length),
    correctionsDirty,
    // actions
    runAnalysis, updateMedicine, resetCorrections, persistAnalysis, saveDraft,
    acknowledgeAlert, noteAlert, retryAiAnalysis,
    updateChecklist, setPharmacist, approve, reject, clarify, dispense,
    clearNotice,
  };
}

export type { WorkflowResult };
