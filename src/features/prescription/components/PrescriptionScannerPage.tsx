// ---------------------------------------------------------------------------
// AI Prescription Scanner — PROTOTYPE — composition root.
//
// Owns only glue: file session state + URL revocation, dialog targeting, and
// toast wiring. All review state lives in useScannerReview (single owner);
// rendering lives in the section components. Nothing here mutates analysis
// directly.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PrescriptionFormData, PrescriptionRoleAccess } from '../types/prescription';
import { revokeLocalPreviewUrl } from '../services/prescriptionService';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { useToast } from '../../../app/providers/ToastContext';
import { BackendConnectionStatus } from './shared';
import UploadCard from './UploadCard';
import PatientInfoForm from './PatientInfoForm';
import AnalysisResults, { AnalysisStepper } from './AnalysisResults';
import StockAvailability from './StockAvailability';
import SafetyAlerts from './SafetyAlerts';
import PharmacistReviewPanel from './PharmacistReviewPanel';
import { WorkflowStepper, BlockchainPanel, type WorkflowStage } from './WorkflowStepper';
import {
  ApproveDialog, ClarifyDialog, DispenseDialog, DraftDialog, NoteDialog, RejectDialog,
} from './ReviewDialogs';
import type { WorkflowDecision } from '../types/prescription';
import { EMPTY_CHECKLIST } from '../types/prescription';
import { useScannerReview } from './useScannerReview';
import DiagnosticPanel from './DiagnosticPanel';
import ReanalyzeWorkflow from './ReanalyzeWorkflow';
import { serverAvailable } from '../../../platform/api/backendSync';

type NoteTarget = { kind: 'interaction' | 'dosage'; alertId: string; title: string };

export default function PrescriptionScannerPage({ role }: { role: PrescriptionRoleAccess }) {
  const isHospital = role === 'hospital';
  const location = useLocation();
  const { toast } = useToast();
  const recordId = (location.state as { prescriptionId?: string } | null)?.prescriptionId ?? null;

  const review = useScannerReview(role, recordId);

  // ---- File session (page-owned because submit needs both file and URL) -----
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  useEffect(() => () => { revokeLocalPreviewUrl(fileUrlRef.current); }, []);

  const handleFileAccepted = useCallback((f: File, url: string) => {
    revokeLocalPreviewUrl(fileUrlRef.current);
    fileUrlRef.current = url;
    setFile(f);
    setFileUrl(url);
  }, []);

  const handleFileCleared = useCallback(() => {
    revokeLocalPreviewUrl(fileUrlRef.current);
    fileUrlRef.current = null;
    setFile(null);
    setFileUrl(null);
  }, []);

  // ---- Dialog targeting ------------------------------------------------------

  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [dialog, setDialog] = useState<'approve' | 'reject' | 'clarify' | 'dispense' | null>(null);

  // ---- Flows ------------------------------------------------------------------

  const handleAnalyze = useCallback(async (values: PrescriptionFormData) => {
    if (!file || !fileUrl) {
      setFileError('Please attach a prescription image or PDF before analyzing.');
      return;
    }
    const result = await review.runAnalysis({ file, fileUrl, form: values });
    if (!result) return;
    toast(`Analysis complete for ${result.record.id} — AI-assisted extraction, verification required.`, 'info');
  }, [file, fileUrl, review, toast]);

  const handleResetCorrections = useCallback(() => {
    review.resetCorrections();
    toast('Corrections reset to the original AI extraction.', 'info');
  }, [review, toast]);

  const handleSaveNote = useCallback((note: string) => {
    if (!noteTarget) return;
    review.noteAlert(noteTarget.kind, noteTarget.alertId, note);
    setNoteTarget(null);
    toast('Pharmacist note added and saved to the prescription record.', 'success');
  }, [noteTarget, review, toast]);

  const handleSaveDraft = useCallback((pharmacistName: string) => {
    if (review.saveDraft(pharmacistName)) {
      setDraftDialogOpen(false);
      toast(`Local review draft saved for ${review.analysisRecordId} by ${pharmacistName}. Nothing is persisted in any backend.`, 'success');
    }
  }, [review, toast]);

  const decision = useCallback((extra: Partial<WorkflowDecision> = {}): WorkflowDecision =>
    ({ actor: review.record?.pharmacistName || 'Demo pharmacist (unrecorded)', ...extra }), [review.record]);

  const handleApprove = useCallback(() => {
    if (!review.record) return;
    const result = review.approve(decision());
    if (result.ok) {
      toast(`${review.record.id} approved and ready for dispensing.`, 'success');
      setDialog(null);
    } else {
      toast(result.error, 'error');
    }
  }, [decision, review, toast]);

  const handleReject = useCallback((reason: string, note: string) => {
    if (!review.record) return;
    const result = review.reject(decision({ reason, note: note || undefined }));
    if (result.ok) {
      toast(`${review.record.id} rejected — audit event recorded.`, 'warning');
      setDialog(null);
    } else {
      toast(result.error, 'error');
    }
  }, [decision, review, toast]);

  const handleClarify = useCallback((message: string, recipient: NonNullable<WorkflowDecision['recipient']>) => {
    if (!review.record) return;
    const result = review.clarify(decision({ note: message, recipient }));
    if (result.ok) {
      toast(`Clarification requested for ${review.record.id}.`, 'info');
      setDialog(null);
    } else {
      toast(result.error, 'error');
    }
  }, [decision, review, toast]);

  const handleDispense = useCallback((notes: string) => {
    if (!review.record) return;
    const result = review.dispense(decision({ note: notes || undefined }));
    if (result.ok) {
      toast(`${review.record.id} marked as dispensed.`, 'success');
      setDialog(null);
    } else {
      toast(result.error, 'error');
    }
  }, [decision, review, toast]);

  const historyPath = isHospital ? '/hospital/prescriptions' : '/dealer/prescriptions';
  const { analysis, stepIndex, analyzing } = review;

  // Five-stage workflow position: Upload → Analyze → Review → Verify → Blockchain.
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    serverAvailable().then((h) => {
      if (mounted) setServerHealthy(h);
    });
    return () => { mounted = false; };
  }, [review.stepIndex, review.aiError]);

  const workflowStage: WorkflowStage = !file && !analysis ? 0
    : analyzing || (stepIndex !== null && !analysis) ? 1
    : analysis && !review.savedDraft ? 2
    : 3;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="AI Prescription Scanner"
        subtitle="Digitize a handwritten prescription and review safety alerts before dispensing."
        crumbs={[{ label: isHospital ? 'Hospital' : 'Dealer / Pharmacy' }, { label: 'Prescription Scanner' }]}
      />

      <div className="space-y-5">
        <WorkflowStepper stage={workflowStage} />

        <DiagnosticPanel
          file={file}
          serverHealthy={serverHealthy}
          analyzing={analyzing}
          stepIndex={stepIndex}
          analysis={analysis}
          aiError={review.aiError}
          aiSource={review.aiSource}
        />

        {review.notice && (
          <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {review.notice}
            <button type="button" onClick={review.clearNotice} className="ml-3 font-semibold underline">Dismiss</button>
          </p>
        )}

        {review.aiError && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
            <p className="text-sm font-semibold text-red-900">Unable to analyze this prescription. Please try again.</p>
            <p className="mt-0.5 text-sm text-red-800">{review.aiError.message}</p>
            {review.aiError.retryable && (
              <button
                type="button"
                onClick={() => { void review.retryAiAnalysis(); }}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Retry AI analysis
              </button>
            )}
          </div>
        )}

        <BackendConnectionStatus />

        <UploadCard
          file={file}
          fileUrl={fileUrl}
          error={fileError}
          onFileAccepted={handleFileAccepted}
          onFileCleared={handleFileCleared}
          onError={setFileError}
        />

        <PatientInfoForm
          role={role}
          analyzing={analyzing}
          initialReference={review.initialReference}
          onSubmit={handleAnalyze}
        />

        {stepIndex !== null && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="rx-progress-heading" aria-live="polite">
            <h2 id="rx-progress-heading" className="text-base font-semibold text-slate-900">Analysis progress</h2>
            <div className="mt-3 grid gap-6 md:grid-cols-[1fr_260px]">
              <div>
                {analyzing && <AnalysisStepper current={stepIndex} />}
                {!analyzing && analysis && (
                  <AnalysisResults
                    analysis={analysis}
                    analysisRecordId={review.analysisRecordId}
                    savedDraft={review.savedDraft}
                    draftPharmacist={review.draftPharmacist}
                    correctionsDirty={review.correctionsDirty}
                    historyPath={historyPath}
                    source={review.aiSource ?? 'server'}
                    onUpdateMedicine={review.updateMedicine}
                    onResetCorrections={handleResetCorrections}
                  />
                )}
              </div>
              {analyzing && (
                <aside className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                    {review.aiSource === 'server' ? 'AI pipeline' : 'Analysis pipeline'}
                  </p>
                  <div className="mt-3"><AnalysisStepper current={stepIndex} /></div>
                  <p className="mt-3 text-[11px] leading-relaxed text-indigo-700/70">
                    {review.aiSource === 'server'
                      ? 'AI-assisted extraction — verification required.'
                      : 'Simulated steps — no OCR or clinical service is actually running.'}
                  </p>
                </aside>
              )}
            </div>
          </section>
        )}

        {analysis && (
          <StockAvailability medicines={analysis.medicines.map((m) => ({ id: m.id, extractedName: m.extractedName, quantity: m.quantity }))} />
        )}

        {analysis && (
          <SafetyAlerts
            analysis={analysis}
            onAcknowledge={review.acknowledgeAlert}
            onRequestNote={(kind, alertId, title) => setNoteTarget({ kind, alertId, title })}
          />
        )}

        {analysis && review.serverId && (
          <ReanalyzeWorkflow
            serverId={review.serverId}
            file={file}
            firstProviderLabel="Primary analysis"
            analysisHistory={review.record?.analysisHistory ?? []}
          />
        )}

        {analysis && (
          <BlockchainPanel serverId={review.serverId} analysis={analysis} />
        )}


        {analysis && review.record && (
          <PharmacistReviewPanel
            record={review.record}
            onSaveDraft={() => setDraftDialogOpen(true)}
            onToggleChecklist={(key) => {
              const cl = review.record?.checklist ?? EMPTY_CHECKLIST;
              review.updateChecklist({ ...cl, [key]: !cl[key] });
            }}
            onPharmacistChange={review.setPharmacist}
            onApprove={() => setDialog('approve')}
            onReject={() => setDialog('reject')}
            onClarify={() => setDialog('clarify')}
            onDispense={() => setDialog('dispense')}
            draftDisabled={!review.analysisRecordId}
          />
        )}
      </div>

      <NoteDialog
        target={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSave={handleSaveNote}
      />
      <DraftDialog
        isOpen={draftDialogOpen}
        recordId={review.analysisRecordId}
        onClose={() => setDraftDialogOpen(false)}
        onSave={handleSaveDraft}
      />
      <ApproveDialog
        isOpen={dialog === 'approve'}
        record={review.record}
        onClose={() => setDialog(null)}
        onConfirm={handleApprove}
      />
      <RejectDialog
        isOpen={dialog === 'reject'}
        recordId={review.analysisRecordId}
        onClose={() => setDialog(null)}
        onConfirm={handleReject}
      />
      <ClarifyDialog
        isOpen={dialog === 'clarify'}
        recordId={review.analysisRecordId}
        onClose={() => setDialog(null)}
        onConfirm={handleClarify}
      />
      <DispenseDialog
        isOpen={dialog === 'dispense'}
        record={review.record}
        onClose={() => setDialog(null)}
        onConfirm={handleDispense}
      />
    </div>
  );
}
