// ---------------------------------------------------------------------------
// InteractionAlertsPage — cross-prescription alert management for dealer and
// hospital. Lists every alert in the session's records (optionally unresolved
// only), with severity/status/date/ID filters and acknowledge action.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, ShieldAlert, Stethoscope } from 'lucide-react';
import type { AlertReviewStatus, AlertSeverity } from '../types/prescription';
import {
  acknowledgeRecordAlert, getAllRecordAlerts, getPrescriptionsWithAlerts,
} from '../services/prescriptionService';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { useToast } from '../../../app/providers/ToastContext';
import { EmptyState, SkeletonCard } from '../../../shared/components/ui/states';
import { SEVERITY_STYLES, SeverityIcon } from './shared';

interface AlertRow {
  key: string;
  recordId: string;
  kind: 'interaction' | 'dosage';
  alertId: string;
  medicines: string;
  severity: AlertSeverity;
  reason: string;
  status: AlertReviewStatus;
  note?: string;
  recordCreatedAt: string;
}

const SEVERITIES: (AlertSeverity | 'all')[] = ['all', 'critical', 'high', 'moderate', 'informational'];
const STATUSES: (AlertReviewStatus | 'all')[] = ['all', 'unreviewed', 'acknowledged', 'requires_clarification', 'resolved'];

const label = (s: AlertReviewStatus) =>
  s === 'unreviewed' ? 'Unreviewed'
    : s === 'acknowledged' ? 'Acknowledged'
      : s === 'requires_clarification' ? 'Requires clarification'
        : 'Resolved';

export default function InteractionAlertsPage({ role, unresolvedOnly = false }: {
  role: 'dealer' | 'hospital';
  unresolvedOnly?: boolean;
}) {
  const isHospital = role === 'hospital';
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [severity, setSeverity] = useState<'all' | AlertSeverity>('all');
  const [status, setStatus] = useState<'all' | AlertReviewStatus>('all');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      if (!alive) return;
      const records = getPrescriptionsWithAlerts(role, unresolvedOnly);
      const out: AlertRow[] = [];
      for (const r of records) {
        for (const { kind, alert } of getAllRecordAlerts(r)) {
          out.push({
            key: `${r.id}:${kind}:${alert.id}`,
            recordId: r.id,
            kind,
            alertId: alert.id,
            medicines: kind === 'interaction'
              ? (alert as { medicines: string[] }).medicines.join(' + ')
              : (alert as { medicine: string }).medicine,
            severity: alert.severity,
            reason: alert.reason ?? '',
            status: alert.reviewStatus,
            note: alert.note,
            recordCreatedAt: r.createdAt,
          });
        }
      }
      setRows(out);
      setLoading(false);
    }, 350);
    return () => { alive = false; window.clearTimeout(t); };
  }, [role, unresolvedOnly]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (severity !== 'all' && row.severity !== severity) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (query && !`${row.recordId} ${row.medicines}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (date && row.recordCreatedAt.slice(0, 10) !== date) return false;
    return true;
  }), [rows, severity, status, query, date]);

  const handleAcknowledge = (row: AlertRow) => {
    const result = acknowledgeRecordAlert(row.recordId, row.kind, row.alertId, 'Demo pharmacist (unrecorded)');
    if (result.ok) {
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: 'acknowledged' } : r)));
      toast(`Alert acknowledged for ${row.recordId}.`, 'success');
    } else {
      toast(result.error, 'error');
    }
  };

  const scanPath = isHospital ? '/hospital/prescriptions/scan' : '/dealer/prescriptions/scan';
  const severityChip = (s: AlertSeverity) => {
    const st = SEVERITY_STYLES[s];
    const tones = { red: 'bg-red-50 text-red-700 border-red-200', orange: 'bg-orange-50 text-orange-700 border-orange-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', blue: 'bg-sky-50 text-sky-700 border-sky-200' } as const;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${tones[st.icon]}`}>
        <SeverityIcon severity={s} /> {st.label}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Interaction Alerts"
        subtitle={unresolvedOnly ? 'Unresolved drug and dosage alerts across this session' : 'All drug and dosage alerts across this session'}
        crumbs={[{ label: isHospital ? 'Hospital' : 'Dealer / Pharmacy' }, { label: 'Interaction Alerts' }]}
      />

      <div className="space-y-5">

        <section className="flex flex-wrap items-center gap-3" aria-label="Alert filters">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prescription ID or medicine"
            aria-label="Search alerts"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <select value={severity} onChange={(e) => setSeverity(e.target.value as 'all' | AlertSeverity)} aria-label="Filter by severity"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : `${s[0].toUpperCase()}${s.slice(1)}`}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | AlertReviewStatus)} aria-label="Filter by review status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : label(s)}</option>)}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Filter by prescription date"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={rows.length === 0 ? 'No interaction alerts' : 'No alerts match your filters'}
            message={rows.length === 0
              ? 'Alerts appear here after prescriptions with interactions or dosage concerns are analyzed in this session.'
              : 'Try clearing the severity, status or date filters.'}
            action={rows.length === 0 ? (
              <Link to={scanPath} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <Stethoscope size={16} aria-hidden="true" /> Scan a prescription
              </Link>
            ) : undefined}
          />
        ) : (
          <ul className="space-y-3" aria-label="Interaction alerts list">
            {filtered.map((row) => (
              <li key={row.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {severityChip(row.severity)}
                  <Link
                    to={isHospital ? '/hospital/prescriptions/review' : '/dealer/prescriptions/review'}
                    state={{ prescriptionId: row.recordId }}
                    className="font-mono text-xs font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
                  >
                    {row.recordId}
                  </Link>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">{row.kind}</span>
                  <span className="ml-auto inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {label(row.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-800">{row.medicines}</p>
                <p className="mt-1 text-sm text-slate-600">{row.reason}</p>
                {row.note && <p className="mt-1.5 text-xs italic text-slate-500">Pharmacist note: “{row.note}”</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {row.status === 'unreviewed' && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <Check size={13} aria-hidden="true" /> Acknowledge
                    </button>
                  )}
                  <Link
                    to={isHospital ? '/hospital/prescriptions/review' : '/dealer/prescriptions/review'}
                    state={{ prescriptionId: row.recordId }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    <Eye size={13} aria-hidden="true" /> Review prescription
                  </Link>
                  <span className="ml-auto text-[11px] text-slate-400">Demo alert — not a validated clinical database result.</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
