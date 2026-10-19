// ---------------------------------------------------------------------------
// PrescriptionReportsPage — session-wide prescription statistics for hospital
// (works for any role). Pure read-side aggregation over the service records +
// CSV export through the existing export service. Local prototype data only.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { PrescriptionRoleAccess } from '../../types/prescription';
import {
  getPrescriptionsByStatus, hasUnresolvedCriticalAlerts, worstSeverityOf,
} from '../../services/prescriptionService';
import { exportCsv } from '../../services/exportService';
import PageHeader from '../ui/PageHeader';
import { EmptyState, SkeletonCard } from '../ui/states';
import { STATUS_LABEL } from './shared';
import type { PrescriptionStatus } from '../../types/prescription';

const ALL_STATUSES: PrescriptionStatus[] = [
  'uploaded', 'processing', 'needs_correction', 'analyzed', 'safety_review_required',
  'clarification_requested', 'approved', 'rejected', 'dispensed', 'cancelled',
];

export default function PrescriptionReportsPage({ role }: { role: PrescriptionRoleAccess }) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ReturnType<typeof getPrescriptionsByStatus>>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setRecords(getPrescriptionsByStatus(role, ALL_STATUSES));
      setLoading(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, [role]);

  const stats = useMemo(() => {
    const byStatus = ALL_STATUSES.map((s) => ({ status: s, count: records.filter((r) => r.status === s).length }))
      .filter((x) => x.count > 0);
    const severity = { critical: 0, high: 0, moderate: 0, informational: 0 } as Record<string, number>;
    let unresolvedCritical = 0;
    let approved = 0;
    let rejected = 0;
    let dispensed = 0;
    let medicinesTotal = 0;
    for (const r of records) {
      medicinesTotal += r.medicineCount;
      const sev = worstSeverityOf(r);
      if (sev) severity[sev] += 1;
      if (hasUnresolvedCriticalAlerts(r)) unresolvedCritical += 1;
      if (r.status === 'approved') approved += 1;
      if (r.status === 'rejected') rejected += 1;
      if (r.status === 'dispensed') dispensed += 1;
    }
    return { byStatus, severity, unresolvedCritical, approved, rejected, dispensed, medicinesTotal };
  }, [records]);

  const handleExport = () => {
    exportCsv(
      'prescription-report',
      ['Prescription ID', 'Patient reference', 'Status', 'Medicines', 'Critical alerts', 'Worst severity', 'Provider', 'Created'],
      records.map((r) => [
        r.id, r.patientReference, STATUS_LABEL[r.status], r.medicineCount,
        r.criticalAlerts, worstSeverityOf(r) ?? 'none', r.analysisProvider,
        new Date(r.createdAt).toLocaleString(),
      ]),
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Prescription Reports"
        subtitle="Session-wide prescription workflow statistics (local prototype data)"
        crumbs={[{ label: 'Hospital' }, { label: 'Prescription Reports' }]}
        actions={records.length > 0 && !loading ? (
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Download size={15} aria-hidden="true" /> Export CSV
          </button>
        ) : undefined}
      />

      <div className="space-y-5">

        {loading ? (
          <SkeletonCard lines={6} />
        ) : records.length === 0 ? (
          <EmptyState
            title="No prescription data yet"
            message="Analyze prescriptions in this session to populate the report. Nothing is stored in a backend."
          />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary counts">
              {([
                ['Prescriptions', records.length, 'text-indigo-600'],
                ['Medicines', stats.medicinesTotal, 'text-indigo-600'],
                ['Unresolved critical', stats.unresolvedCritical, stats.unresolvedCritical > 0 ? 'text-red-600' : 'text-slate-500'],
                ['Approved', stats.approved, 'text-emerald-600'],
                ['Rejected', stats.rejected, 'text-red-600'],
                ['Dispensed', stats.dispensed, 'text-emerald-600'],
              ] as const).map(([label, value, cls]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">By workflow status</h2>
                <ul className="mt-3 space-y-2" aria-label="Counts by status">
                  {stats.byStatus.map(({ status, count }) => (
                    <li key={status} className="flex items-center gap-3 text-sm">
                      <span className="w-44 shrink-0 text-slate-600">{STATUS_LABEL[status]}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{ width: `${Math.round((count / records.length) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-semibold text-slate-700">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">By worst alert severity</h2>
                <ul className="mt-3 space-y-2" aria-label="Counts by severity">
                  {(['critical', 'high', 'moderate', 'informational'] as const).map((sev) => (
                    <li key={sev} className="flex items-center gap-3 text-sm">
                      <span className="w-44 shrink-0 capitalize text-slate-600">{sev}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-500' : sev === 'moderate' ? 'bg-amber-500' : 'bg-sky-500'}`}
                          style={{ width: `${Math.round((stats.severity[sev] / records.length) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right font-semibold text-slate-700">{stats.severity[sev]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
