// ---------------------------------------------------------------------------
// DispensingReviewPage — dealer/pharmacy pipeline view. Status tabs over all
// session records with review + dispense actions; decisions route through the
// service so safety rules (approval blockers, transition validation) apply.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Eye, Stamp } from 'lucide-react';
import type { PrescriptionRecord, PrescriptionStatus } from '../types/prescription';
import {
  getApprovalBlockers, getPrescriptionsByStatus, markPrescriptionDispensed,
  rejectPrescription, worstSeverityOf,
} from '../services/prescriptionService';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { useToast } from '../../../app/providers/ToastContext';
import { EmptyState, SkeletonCard } from '../../../shared/components/ui/states';
import { StatusBadgeFor } from './shared';
import { DispenseDialog, RejectDialog } from './ReviewDialogs';

const TABS: { key: 'pipeline' | PrescriptionStatus; label: string; statuses: PrescriptionStatus[] }[] = [
  { key: 'pipeline', label: 'All pipeline', statuses: ['needs_correction', 'safety_review_required', 'clarification_requested', 'approved', 'rejected', 'dispensed'] },
  { key: 'safety_review_required', label: 'Safety review', statuses: ['safety_review_required'] },
  { key: 'clarification_requested', label: 'Awaiting clarification', statuses: ['clarification_requested'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'rejected', label: 'Rejected', statuses: ['rejected'] },
  { key: 'dispensed', label: 'Dispensed', statuses: ['dispensed'] },
];

export default function DispensingReviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pipeline' | PrescriptionStatus>('pipeline');
  const [records, setRecords] = useState<PrescriptionRecord[]>([]);
  const [dispenseTarget, setDispenseTarget] = useState<PrescriptionRecord | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PrescriptionRecord | null>(null);

  const load = () => setRecords(getPrescriptionsByStatus('dealer', TABS.flatMap((t) => t.statuses)));
  useEffect(() => {
    const t = window.setTimeout(() => { load(); setLoading(false); }, 350);
    return () => window.clearTimeout(t);
  }, []);

  const visible = useMemo(
    () => records.filter((r) => TABS.find((t) => t.key === tab)?.statuses.includes(r.status) ?? false),
    [records, tab],
  );

  const handleDispense = (notes: string) => {
    if (!dispenseTarget) return;
    const result = markPrescriptionDispensed(dispenseTarget.id, {
      actor: dispenseTarget.pharmacistName || 'Pharmacy staff (unrecorded)',
      note: notes || undefined,
    });
    if (result.ok) {
      toast(`${dispenseTarget.id} marked as dispensed — inventory deduction is not connected in prototype mode.`, 'success');
    } else {
      toast(result.error, 'error');
    }
    setDispenseTarget(null);
    load();
  };

  const handleReject = (reason: string, note: string) => {
    if (!rejectTarget) return;
    const result = rejectPrescription(rejectTarget.id, {
      actor: rejectTarget.pharmacistName || 'Pharmacist (unrecorded)',
      reason,
      note: note || undefined,
    });
    if (result.ok) {
      toast(`${rejectTarget.id} rejected — audit event recorded.`, 'warning');
    } else {
      toast(result.error, 'error');
    }
    setRejectTarget(null);
    load();
  };

  const scanPath = '/dealer/prescriptions/scan';
  const reviewPath = '/dealer/prescriptions/review';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dispensing Review"
        subtitle="Safety review, approval and dispensing pipeline for this pharmacy session"
        crumbs={[{ label: 'Dealer / Pharmacy' }, { label: 'Dispensing Review' }]}
      />

      <div className="space-y-5">

        {/* Tabs */}
        <section className="flex flex-wrap gap-2" role="tablist" aria-label="Pipeline status tabs">
          {TABS.map((t) => {
            const count = t.key === 'pipeline'
              ? records.length
              : records.filter((r) => t.statuses.includes(r.status)).length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                  active
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {t.label} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Stamp}
            title="Nothing in this stage"
            message="Records appear here as they move through safety review, approval and dispensing. History is temporary mock data and is not stored in the backend."
            action={records.length === 0 ? (
              <Link to={scanPath} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Scan a prescription
              </Link>
            ) : undefined}
          />
        ) : (
          <ul className="space-y-3" aria-label="Dispensing pipeline records">
            {visible.map((r) => {
              const blockers = getApprovalBlockers(r);
              const canDispense = r.status === 'approved';
              const sev = worstSeverityOf(r);
              return (
                <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={reviewPath}
                      state={{ prescriptionId: r.id }}
                      className="font-mono text-xs font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
                    >
                      {r.id}
                    </Link>
                    <StatusBadgeFor status={r.status} />
                    <span className="text-xs text-slate-500">
                      {r.medicineCount} medicine{r.medicineCount === 1 ? '' : 's'} · patient ref {r.patientReference}
                    </span>
                    {sev && (
                      <span className={`ml-auto text-[11px] font-semibold uppercase tracking-wide ${
                        sev === 'critical' ? 'text-red-600' : sev === 'high' ? 'text-orange-600' : sev === 'moderate' ? 'text-amber-600' : 'text-sky-600'}`}>
                        worst: {sev}
                      </span>
                    )}
                  </div>
                  {blockers.length > 0 && r.status !== 'approved' && r.status !== 'rejected' && r.status !== 'dispensed' && (
                    <p className="mt-2 text-xs text-amber-700">
                      Approval blocked: {blockers[0]}{blockers.length > 1 ? ` (+${blockers.length - 1} more)` : ''}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Link
                      to={reviewPath}
                      state={{ prescriptionId: r.id }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <Eye size={13} aria-hidden="true" /> Review
                    </Link>
                    {canDispense && (
                      <button
                        type="button"
                        onClick={() => setDispenseTarget(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                      >
                        <Stamp size={13} aria-hidden="true" /> Mark Dispensed
                      </button>
                    )}
                    {(r.status === 'safety_review_required' || r.status === 'clarification_requested') && (
                      <button
                        type="button"
                        onClick={() => setRejectTarget(r)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                      >
                        <Ban size={13} aria-hidden="true" /> Reject
                      </button>
                    )}
                    <span className="ml-auto text-[11px] text-slate-400">Updated {new Date(r.createdAt).toLocaleTimeString()} · local prototype data</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DispenseDialog
        isOpen={!!dispenseTarget}
        record={dispenseTarget}
        onClose={() => setDispenseTarget(null)}
        onConfirm={handleDispense}
      />
      <RejectDialog
        isOpen={!!rejectTarget}
        recordId={rejectTarget?.id ?? null}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  );
}
