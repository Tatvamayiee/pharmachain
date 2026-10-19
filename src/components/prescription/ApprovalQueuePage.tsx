// ---------------------------------------------------------------------------
// ApprovalQueuePage — hospital pharmacist approval queue. Records are sorted
// by priority: unresolved-critical first, then worst severity, clarification
// requests, safety review, then plain analyzed. Includes the spec'd count
// cards and direct Approve (via review page dialog pre-open).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ShieldAlert } from 'lucide-react';
import type { PrescriptionRecord, PrescriptionRoleAccess } from '../../types/prescription';
import {
  getApprovalBlockers, getPrescriptionsByStatus, hasUnresolvedCriticalAlerts,
  worstSeverityOf,
} from '../../services/prescriptionService';
import PageHeader from '../ui/PageHeader';
import { EmptyState, SkeletonCard } from '../ui/states';
import { StatusBadgeFor } from './shared';

function priorityOf(r: PrescriptionRecord): number {
  if (hasUnresolvedCriticalAlerts(r)) return 0;
  const sev = worstSeverityOf(r);
  if (sev === 'critical') return 0;
  if (sev === 'high') return 1;
  if (r.status === 'clarification_requested') return 2;
  if (r.status === 'safety_review_required') return 3;
  return 4; // analyzed / needs_correction
}

export default function ApprovalQueuePage({ role }: { role: PrescriptionRoleAccess }) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PrescriptionRecord[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const records = getPrescriptionsByStatus(role, [
      'analyzed', 'safety_review_required', 'clarification_requested', 'needs_correction',
    ]);
    if (!alive) return;
    setRecords(records);
    setLoading(false);
    return () => { alive = false; };
  }, [role]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => priorityOf(a) - priorityOf(b)),
    [records],
  );

  const counts = useMemo(() => ({
    critical: sorted.filter((r) => hasUnresolvedCriticalAlerts(r) || worstSeverityOf(r) === 'critical').length,
    high: sorted.filter((r) => !hasUnresolvedCriticalAlerts(r) && worstSeverityOf(r) === 'high').length,
    clarification: sorted.filter((r) => r.status === 'clarification_requested').length,
    ready: sorted.filter((r) => r.status === 'safety_review_required' && getApprovalBlockers(r).length === 0).length,
    approvedToday: sorted.filter((r) =>
      r.decision?.reason === undefined &&
      r.status === 'approved').length, // queue only holds pre-approval statuses
  }), [sorted]);

  const queuePath = '/hospital/prescriptions/review';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Pharmacist Approval Queue"
        subtitle="Prescriptions awaiting a human decision, highest risk first"
        crumbs={[{ label: 'Hospital' }, { label: 'Approval Queue' }]}
      />

      <div className="space-y-5">
        {/* Count cards */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Queue counts">
          {([
            ['Critical review', counts.critical, 'text-red-600 bg-red-50 border-red-100'],
            ['High priority', counts.high, 'text-orange-600 bg-orange-50 border-orange-100'],
            ['Awaiting clarification', counts.clarification, 'text-amber-600 bg-amber-50 border-amber-100'],
            ['Ready for review', counts.ready, 'text-emerald-600 bg-emerald-50 border-emerald-100'],
            ['Approved today', counts.approvedToday, 'text-indigo-600 bg-indigo-50 border-indigo-100'],
          ] as const).map(([label, value, cls]) => (
            <div key={label} className={`rounded-2xl border p-3.5 ${cls.split(' ').slice(1).join(' ')}`}>
              <p className={`text-2xl font-bold ${cls.split(' ')[0]}`}>{value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
            </div>
          ))}
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Approval queue is empty"
            message="Prescriptions that complete analysis appear here for a pharmacist decision."
            action={(
              <Link
                to="/hospital/prescriptions/scan"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Scan a prescription
              </Link>
            )}
          />
        ) : (
          <ol className="space-y-3" aria-label="Approval queue, priority order">
            {sorted.map((r) => {
              const blockers = getApprovalBlockers(r);
              const critical = hasUnresolvedCriticalAlerts(r);
              return (
                <li key={r.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${critical ? 'border-red-200' : 'border-slate-200'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {critical && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                        <ShieldAlert size={12} aria-hidden="true" /> Critical
                      </span>
                    )}
                    <Link
                      to={queuePath}
                      state={{ prescriptionId: r.id }}
                      className="font-mono text-xs font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
                    >
                      {r.id}
                    </Link>
                    <StatusBadgeFor status={r.status} />
                    <span className="text-xs text-slate-500">
                      {r.medicineCount} medicine{r.medicineCount === 1 ? '' : 's'} · ref {r.patientReference}
                      {r.department ? ` · ${r.department}` : ''}
                      {r.prescriberName ? ` · ${r.prescriberName}` : ''}
                    </span>
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      priority {priorityOf(r) + 1}
                    </span>
                  </div>
                  {blockers.length > 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Approval blocked: {blockers[0]}{blockers.length > 1 ? ` (+${blockers.length - 1} more)` : ''}
                    </p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Link
                      to={queuePath}
                      state={{ prescriptionId: r.id, dialog: 'approve' }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      Approve…
                    </Link>
                    <Link
                      to={queuePath}
                      state={{ prescriptionId: r.id }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      Open review
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
