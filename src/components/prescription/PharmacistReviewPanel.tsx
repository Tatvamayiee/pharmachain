// ---------------------------------------------------------------------------
// PharmacistReviewPanel — human decision controls for the workflow.
// Reads checklist/pharmacist/blockers from the service-owned record; every
// decision is delegated upward (dialogs + service mutations live in the page).
// Safety rules: unresolved critical alerts, blocking matches, incomplete
// checklist or missing pharmacist identity all disable approval.
// ---------------------------------------------------------------------------

import { AlertTriangle, Ban, HelpCircle, Lock, RefreshCw, ShieldCheck, Stamp } from 'lucide-react';
import type { PrescriptionRecord, ReviewChecklist } from '../../types/prescription';
import { CHECKLIST_LABELS, EMPTY_CHECKLIST } from '../../types/prescription';
import { getApprovalBlockers } from '../../services/prescriptionService';
import { StatusBadgeFor } from './shared';
import PrescriptionAuditTimeline from './PrescriptionAuditTimeline';

export const AI_JUDGMENT_NOTICE =
  'AI assistance does not replace pharmacist or clinician judgment.';

interface PharmacistReviewPanelProps {
  record: PrescriptionRecord;
  onSaveDraft: () => void;
  onToggleChecklist: (key: keyof ReviewChecklist) => void;
  onPharmacistChange: (name: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onClarify: () => void;
  onDispense: () => void;
  draftDisabled: boolean;
}

export default function PharmacistReviewPanel({
  record, onSaveDraft, onToggleChecklist, onPharmacistChange,
  onApprove, onReject, onClarify, onDispense, draftDisabled,
}: PharmacistReviewPanelProps) {
  const checklist = record.checklist ?? EMPTY_CHECKLIST;
  const doneCount = Object.values(checklist).filter(Boolean).length;
  const blockers = getApprovalBlockers(record);
  const canApprove = blockers.length === 0;
  const decisionLocked =
    record.status === 'approved' || record.status === 'rejected' ||
    record.status === 'dispensed' || record.status === 'cancelled';

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5" aria-labelledby="rx-review-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="rx-review-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <ShieldCheck size={17} className="text-emerald-600" aria-hidden="true" /> Human pharmacist review required
        </h2>
        <span className="ml-auto"><StatusBadgeFor status={record.status} /></span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        AI output is assistance only. {AI_JUDGMENT_NOTICE}
      </p>

      {/* Checklist */}
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-slate-700">
          Review checklist ({doneCount}/{Object.keys(CHECKLIST_LABELS).length})
        </legend>
        <ul className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
          {(Object.keys(CHECKLIST_LABELS) as (keyof ReviewChecklist)[]).map((key) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-emerald-50/60">
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={() => onToggleChecklist(key)}
                  disabled={decisionLocked}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                  aria-label={`Checklist item: ${CHECKLIST_LABELS[key]}`}
                />
                {CHECKLIST_LABELS[key]}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* Pharmacist identity */}
      <label className="mt-4 block max-w-sm">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Pharmacist name <span className="text-red-500" aria-hidden="true">*</span>
        </span>
        <input
          value={record.pharmacistName ?? ''}
          onChange={(e) => onPharmacistChange(e.target.value)}
          disabled={decisionLocked}
          aria-label="Pharmacist name (required for approval)"
          placeholder="e.g. S. Meena, B.Pharm"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      </label>

      {/* Approval blockers */}
      {!canApprove && !decisionLocked && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3" role="status">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <Lock size={14} aria-hidden="true" /> Approval blocked
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-amber-800">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Decision buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={!canApprove}
          title={canApprove ? 'Approve this prescription' : 'Complete the checklist, verify medicines and enter your name to enable approval'}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <ShieldCheck size={15} aria-hidden="true" /> Approve Prescription
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={decisionLocked}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
        >
          <Ban size={15} aria-hidden="true" /> Reject Prescription
        </button>
        <button
          type="button"
          onClick={onClarify}
          disabled={decisionLocked}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <HelpCircle size={15} aria-hidden="true" /> Request Clarification
        </button>
        <button
          type="button"
          onClick={onDispense}
          disabled={record.status !== 'approved'}
          title={record.status !== 'approved' ? 'Only approved prescriptions can be dispensed' : 'Mark this prescription as dispensed'}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <Stamp size={15} aria-hidden="true" /> Mark as Dispensed
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={draftDisabled || decisionLocked}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <RefreshCw size={14} aria-hidden="true" /> Save local review draft
        </button>
      </div>

      {record.status === 'dispensed' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <AlertTriangle size={13} aria-hidden="true" /> Dispensed — inventory deduction is not connected in prototype mode.
        </p>
      )}

      <p className="mt-3 text-[11px] text-slate-400">Local prototype data — not stored in any backend.</p>

      {/* Audit trail */}
      <div className="mt-4">
        <PrescriptionAuditTimeline events={record.auditTrail} />
      </div>
    </section>
  );
}
