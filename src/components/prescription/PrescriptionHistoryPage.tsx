// ---------------------------------------------------------------------------
// Prescription History — PROTOTYPE (Phase 1). Mock, session-local data only.
// Same page component is used by the dealer (pharmacy) and hospital roles.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Eye, FileText, History, PlayCircle, Search, ShieldCheck, Stamp } from 'lucide-react';
import type {
  AlertSeverity, PrescriptionRecord, PrescriptionRoleAccess,
} from '../../types/prescription';
import {
  getPrescriptionHistory, rejectPrescription, worstSeverityOf,
} from '../../services/prescriptionService';
import PageHeader from '../ui/PageHeader';
import StatusBadge from '../ui/StatusBadge';
import { EmptyState, SkeletonCard } from '../ui/states';
import { useToast } from '../../contexts/ToastContext';
import { STATUS_LABEL } from './shared';
import { RejectDialog } from './ReviewDialogs';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  uploaded: 'default',
  processing: 'info',
  needs_correction: 'warning',
  analyzed: 'info',
  safety_review_required: 'warning',
  approved: 'success',
  rejected: 'error',
};

const SEVERITIES: (AlertSeverity | 'all')[] = ['all', 'critical', 'high', 'moderate', 'informational'];

export default function PrescriptionHistoryPage({ role }: { role: PrescriptionRoleAccess }) {
  const isHospital = role === 'hospital';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PrescriptionRecord[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');

  // Backend-backed prescription history.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPrescriptionHistory(role)
      .then((serverRecords) => {
        if (!alive) return;
        setRecords(serverRecords);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setRecords([]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [role]);

  const filtered = useMemo(() => records.filter((r) => {
    if (query && !`${r.id} ${r.patientReference}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (severityFilter !== 'all') {
      if (worstSeverityOf(r) !== severityFilter) return false;
    }
    return true;
  }), [records, query, statusFilter, severityFilter]);

  const statuses = useMemo(
    () => ['all', ...[...new Set(records.map((r) => r.status))]],
    [records],
  );

  const [rejectTarget, setRejectTarget] = useState<PrescriptionRecord | null>(null);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isHospital ? 'Prescription Records' : 'Prescription History'}
        subtitle={isHospital
          ? 'Prescriptions analyzed in this hospital session'
          : 'Prescriptions analyzed in this pharmacy session'}
        crumbs={[{ label: isHospital ? 'Hospital' : 'Dealer / Pharmacy' }, { label: isHospital ? 'Prescription Records' : 'Prescription History' }]}
        actions={(
          <Link
            to={isHospital ? '/hospital/prescriptions/scan' : '/dealer/prescriptions/scan'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlayCircle size={16} aria-hidden="true" /> New scan
          </Link>
        )}
      />

      <div className="space-y-5">
        {/* Filters */}
        <section className="flex flex-wrap items-center gap-3" aria-label="History filters">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by prescription ID or patient reference"
              aria-label="Search prescriptions"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.split('_').join(' ')}</option>)}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | AlertSeverity)}
            aria-label="Filter by severity"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : `${s[0].toUpperCase()}${s.slice(1)}`}</option>)}
          </select>
        </section>

        {/* List */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={records.length === 0 ? History : FileText}
            title={records.length === 0 ? 'No prescriptions analyzed yet' : 'No prescriptions match your filters'}
message={records.length === 0
               ? 'Prescriptions you analyze will appear here.'
               : 'Try a different search term or clear the filters.'}
            action={records.length === 0 ? (
              <Link
                to={isHospital ? '/hospital/prescriptions/scan' : '/dealer/prescriptions/scan'}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <PlayCircle size={16} aria-hidden="true" /> Scan a prescription
              </Link>
            ) : undefined}
          />
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Prescription list">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-semibold">Prescription ID</th>
                    <th className="px-4 py-3 font-semibold">Patient reference</th>
                    <th className="px-4 py-3 font-semibold">Rx date</th>
                    <th className="px-4 py-3 font-semibold">Medicines</th>
                    <th className="px-4 py-3 font-semibold">Critical alerts</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    {isHospital && <th className="px-4 py-3 font-semibold">Department</th>}
                    {isHospital && <th className="px-4 py-3 font-semibold">Prescriber</th>}
                    <th className="px-4 py-3 font-semibold">Pharmacist</th>
                    <th className="px-4 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{r.id}</td>
                      <td className="px-4 py-3 text-slate-600">{r.patientReference}</td>
                      <td className="px-4 py-3 text-slate-600">{new Date(r.prescriptionDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-600">{r.medicineCount}</td>
                      <td className="px-4 py-3">
                        {r.criticalAlerts > 0
                          ? <span className="font-semibold text-red-600">{r.criticalAlerts}</span>
                          : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={STATUS_LABEL[r.status] ?? r.status} tone={STATUS_TONE[r.status] ?? 'default'} /></td>
                      {isHospital && <td className="px-4 py-3 text-slate-600">{r.department ?? <span className="text-slate-300">—</span>}</td>}
                      {isHospital && <td className="px-4 py-3 text-slate-600">{r.prescriberName ?? <span className="text-slate-300">—</span>}</td>}
                      <td className="px-4 py-3 text-slate-600">{r.pharmacistName ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.analysisProvider} tone="warning" /></td>
                      <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">
                        <HistoryActions record={r} isHospital={isHospital} onReject={setRejectTarget} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-indigo-700">{r.id}</span>
                    <StatusBadge status={r.status} tone={STATUS_TONE[r.status] ?? 'default'} />
                    {r.criticalAlerts > 0 && <StatusBadge status={`${r.criticalAlerts} critical`} tone="error" />}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                    <div><dt className="inline text-slate-400">Patient ref: </dt><dd className="inline">{r.patientReference}</dd></div>
                    <div><dt className="inline text-slate-400">Rx date: </dt><dd className="inline">{new Date(r.prescriptionDate).toLocaleDateString()}</dd></div>
                    <div><dt className="inline text-slate-400">Medicines: </dt><dd className="inline">{r.medicineCount}</dd></div>
                    <div><dt className="inline text-slate-400">Provider: </dt><dd className="inline">{r.analysisProvider}</dd></div>
                  </dl>
                  <div className="mt-3"><HistoryActions record={r} isHospital={isHospital} onReject={setRejectTarget} /></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-slate-400">
          Session records are prototype data; records synced from the server (when the API is running) are persistent. Patient names are intentionally not shown in this list.
        </p>
      </div>

      <RejectDialog
        isOpen={!!rejectTarget}
        recordId={rejectTarget?.id ?? null}
        onClose={() => setRejectTarget(null)}
onConfirm={async (reason, note) => {
          if (!rejectTarget) return;
          const result = rejectPrescription(rejectTarget.id, {
            actor: rejectTarget.pharmacistName || 'Pharmacist (unrecorded)',
            reason,
            note: note || undefined,
          });
          if (result.ok) {
            toast(`${rejectTarget.id} rejected — audit event recorded.`, 'warning');
            setRecords(await getPrescriptionHistory(role));
          } else {
            toast(result.error, 'error');
          }
          setRejectTarget(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryActions — per-record quick actions. Review always works; Approve /
// Dispense pre-open the corresponding dialog on the review page (the service
// still validates every rule when the dialog confirms).
// ---------------------------------------------------------------------------

function HistoryActions({ record: r, isHospital, onReject }: {
  record: PrescriptionRecord;
  isHospital: boolean;
  onReject: (r: PrescriptionRecord) => void;
}) {
  const reviewBase = isHospital ? '/hospital/prescriptions/review' : '/dealer/prescriptions/review';
  const scannerPath = isHospital ? '/hospital/prescriptions/scan' : '/dealer/prescriptions/scan';
  const decisionable = r.status === 'safety_review_required' || r.status === 'clarification_requested';
  const showAudit = r.auditTrail.length > 0;

  const chip = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600';

  return (
    <div className="flex flex-wrap gap-1.5">
      <Link to={scannerPath} state={{ prescriptionId: r.id }} className={chip} title="View stored analysis in the scanner">
        <Eye size={13} aria-hidden="true" /> View
      </Link>
      <Link to={reviewBase} state={{ prescriptionId: r.id }} className={chip} title="Open the pharmacist review panel">
        <FileText size={13} aria-hidden="true" /> Review
      </Link>
      {decisionable && (
        <Link to={reviewBase} state={{ prescriptionId: r.id, dialog: 'approve' }} className={chip} title="Open approval dialog">
          <ShieldCheck size={13} aria-hidden="true" /> Approve
        </Link>
      )}
      {decisionable && (
        <button
          type="button"
          onClick={() => onReject(r)}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
          title="Open rejection dialog"
        >
          <Ban size={13} aria-hidden="true" /> Reject
        </button>
      )}
      {r.status === 'approved' && (
        <Link to={reviewBase} state={{ prescriptionId: r.id, dialog: 'dispense' }} className={chip} title="Open dispensing dialog">
          <Stamp size={13} aria-hidden="true" /> Dispense
        </Link>
      )}
      {showAudit && (
        <Link to={reviewBase} state={{ prescriptionId: r.id }} className={chip} title="View audit history on the review page">
          <History size={13} aria-hidden="true" /> Audit
        </Link>
      )}
    </div>
  );
}
