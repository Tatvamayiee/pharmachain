// ---------------------------------------------------------------------------
// PrescriptionReviewPage — record-level pharmacist review for both roles.
// Reached from history actions with router state { prescriptionId, dialog? }.
// State ownership is identical to the scanner: the SERVICE owns the record,
// useScannerReview is the single read/write facade, this page only glues
// dialogs + toasts. All decisions re-validate in the service.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import type {
  PrescriptionRoleAccess, ReviewChecklist, WorkflowDecision,
} from '../../types/prescription';
import { EMPTY_CHECKLIST } from '../../types/prescription';
import PageHeader from '../ui/PageHeader';
import { useToast } from '../../contexts/ToastContext';
import { StatusBadgeFor } from './shared';
import AnalysisResults from './AnalysisResults';
import SafetyAlerts from './SafetyAlerts';
import PharmacistReviewPanel from './PharmacistReviewPanel';
import {
  ApproveDialog, ClarifyDialog, DispenseDialog, DraftDialog, NoteDialog, RejectDialog,
} from './ReviewDialogs';
import { useScannerReview } from './useScannerReview';

type DialogKind = 'approve' | 'reject' | 'clarify' | 'dispense';

interface ReviewLocationState {
  prescriptionId?: string;
  dialog?: DialogKind;
}

export default function PrescriptionReviewPage({ role }: { role: PrescriptionRoleAccess }) {
  const isHospital = role === 'hospital';
  const location = useLocation();
  const { toast } = useToast();
  const state = (location.state ?? {}) as ReviewLocationState;

  const review = useScannerReview(role, state.prescriptionId ?? null);
  const { record, analysis, notice } = review;

  const [noteTarget, setNoteTarget] = useState<{ kind: 'interaction' | 'dosage'; alertId: string; title: string } | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(
    state.dialog === 'approve' || state.dialog === 'reject' ||
    state.dialog === 'clarify' || state.dialog === 'dispense' ? state.dialog : null,
  );
  // Quick-action pre-open is only valid once; clear the router state flag.
  useEffect(() => { if (state.dialog) window.history.replaceState({}, ''); }, [state.dialog]);

  const actorFallback = record?.pharmacistName || 'Demo pharmacist (unrecorded)';
  const decision = useCallback((extra: Partial<WorkflowDecision> = {}): WorkflowDecision =>
    ({ actor: actorFallback, ...extra }), [actorFallback]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleApprove = useCallback(() => {
    if (!record) return;
    const result = review.approve(decision());
    if (result.ok) {
      toast(`${record.id} approved — prototype decision recorded locally only.`, 'success');
      closeDialog();
    } else {
      toast(result.error, 'error');
    }
  }, [closeDialog, decision, record, review, toast]);

  const handleReject = useCallback((reason: string, note: string) => {
    if (!record) return;
    const result = review.reject(decision({ reason, note: note || undefined }));
    if (result.ok) {
      toast(`${record.id} rejected — audit event recorded.`, 'warning');
      closeDialog();
    } else {
      toast(result.error, 'error');
    }
  }, [closeDialog, decision, record, review, toast]);

  const handleClarify = useCallback((message: string, recipient: NonNullable<WorkflowDecision['recipient']>) => {
    if (!record) return;
    const result = review.clarify(decision({ note: message, recipient }));
    if (result.ok) {
      toast(`Clarification requested for ${record.id}.`, 'info');
      closeDialog();
    } else {
      toast(result.error, 'error');
    }
  }, [closeDialog, decision, record, review, toast]);

  const handleDispense = useCallback((notes: string) => {
    if (!record) return;
    const result = review.dispense(decision({ note: notes || undefined }));
    if (result.ok) {
      toast(`${record.id} marked as dispensed — inventory deduction is not connected in prototype mode.`, 'success');
      closeDialog();
    } else {
      toast(result.error, 'error');
    }
  }, [closeDialog, decision, record, review, toast]);

  const handleSaveNote = useCallback((note: string) => {
    if (!noteTarget) return;
    review.noteAlert(noteTarget.kind, noteTarget.alertId, note);
    setNoteTarget(null);
    toast('Pharmacist note added (stored locally in this session only).', 'success');
  }, [noteTarget, review, toast]);

  const handleToggleChecklist = useCallback((key: keyof ReviewChecklist) => {
    const current = record?.checklist ?? EMPTY_CHECKLIST;
    review.updateChecklist({ ...current, [key]: !current[key] });
  }, [record, review]);

  const handleResetCorrections = useCallback(() => {
    review.resetCorrections();
    toast('Corrections reset to the original mock extraction.', 'info');
  }, [review, toast]);

  const handleSaveDraft = useCallback((pharmacistName: string) => {
    if (review.saveDraft(pharmacistName)) {
      setDraftDialogOpen(false);
      toast(`Local review draft saved for ${review.analysisRecordId}. Nothing is persisted in any backend.`, 'success');
    }
  }, [review, toast]);

  const historyPath = isHospital ? '/hospital/prescriptions' : '/dealer/prescriptions';
  const scanPath = isHospital ? '/hospital/prescriptions/scan' : '/dealer/prescriptions/scan';

  if (!record || !analysis) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Prescription Review"
          subtitle="Human pharmacist decision panel for a stored analysis."
          crumbs={[{ label: isHospital ? 'Hospital' : 'Dealer / Pharmacy' }, { label: 'Prescription Review' }]}
        />
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          {notice ?? 'Review record unavailable — no prescription was selected, or it is no longer in this session (records are session-local and reset on reload).'}{' '}
          <Link to={historyPath} className="font-semibold underline">Back to history</Link> or{' '}
          <Link to={scanPath} className="font-semibold underline">run a new analysis</Link>.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Review ${record.id}`}
        subtitle="Human pharmacist decision panel — AI results are assistance only."
        crumbs={[{ label: isHospital ? 'Hospital' : 'Dealer / Pharmacy' }, { label: 'Prescription Review' }]}
        actions={<StatusBadgeFor status={record.status} />}
      />

      <div className="space-y-5">

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <AnalysisResults
              analysis={analysis}
              analysisRecordId={review.analysisRecordId}
              savedDraft={review.savedDraft}
              draftPharmacist={review.draftPharmacist}
              correctionsDirty={review.correctionsDirty}
              historyPath={historyPath}
              source={review.analysis?.analysisProvider === 'mock' ? 'local' : 'server'}
              onUpdateMedicine={review.updateMedicine}
              onResetCorrections={handleResetCorrections}
            />
          </div>
          <div className="space-y-5">
            <SafetyAlerts
              analysis={analysis}
              onAcknowledge={review.acknowledgeAlert}
              onRequestNote={(kind, alertId, title) => setNoteTarget({ kind, alertId, title })}
            />
            <PharmacistReviewPanel
              record={record}
              onSaveDraft={() => setDraftDialogOpen(true)}
              onToggleChecklist={handleToggleChecklist}
              onPharmacistChange={review.setPharmacist}
              onApprove={() => setDialog('approve')}
              onReject={() => setDialog('reject')}
              onClarify={() => setDialog('clarify')}
              onDispense={() => setDialog('dispense')}
              draftDisabled={!review.analysisRecordId}
            />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Need a fresh analysis?</h2>
          <p className="mt-1 text-sm text-slate-500">
            This page reviews the stored session result. Re-uploading creates a new prescription record —
            the previous one stays in this session's history.
          </p>
          <Link
            to={scanPath}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <ScanLine size={16} aria-hidden="true" /> Open the scanner
          </Link>
        </section>
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
        record={record}
        onClose={closeDialog}
        onConfirm={handleApprove}
      />
      <RejectDialog
        isOpen={dialog === 'reject'}
        recordId={record.id}
        onClose={closeDialog}
        onConfirm={handleReject}
      />
      <ClarifyDialog
        isOpen={dialog === 'clarify'}
        recordId={record.id}
        onClose={closeDialog}
        onConfirm={handleClarify}
      />
      <DispenseDialog
        isOpen={dialog === 'dispense'}
        record={record}
        onClose={closeDialog}
        onConfirm={handleDispense}
      />
    </div>
  );
}
