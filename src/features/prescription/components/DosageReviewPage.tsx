// ---------------------------------------------------------------------------
// DosageReviewPage — hospital-specific list of prescriptions carrying dosage
// alerts (overdose/underdose, frequency/duration concerns, patient-specific
// review, missing information). Alerts are read from the service-owned
// records; acknowledging routes through the service mutation.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Gauge } from 'lucide-react';
import type { AlertReviewStatus, DosageStatus, PrescriptionRecord } from '../types/prescription';
import {
  getPrescriptionsByStatus, type WorkflowResult,
  acknowledgeRecordAlert,
} from '../services/prescriptionService';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { useToast } from '../../../app/providers/ToastContext';
import { EmptyState, SkeletonCard } from '../../../shared/components/ui/states';
import { StatusBadgeFor } from './shared';

const DOSAGE_STATUSES: DosageStatus[] = [
  'possible_overdose', 'possible_underdose', 'frequency_concern', 'duration_concern',
  'patient_specific_review_required', 'unable_to_validate',
];

const DOSAGE_LABEL: Record<DosageStatus, string> = {
  within_expected_range: 'Within expected range',
  possible_overdose: 'Possible overdose',
  possible_underdose: 'Possible underdose',
  frequency_concern: 'Frequency concern',
  duration_concern: 'Duration concern',
  patient_specific_review_required: 'Patient-specific review required',
  unable_to_validate: 'Unable to validate',
};

interface Row {
  record: PrescriptionRecord;
  alertId: string;
  medicine: string;
  status: DosageStatus;
  flaggedField: string;
  reason: string;
  severity: string;
  missing: string[];
  reviewStatus: AlertReviewStatus;
  note?: string;
}

export default function DosageReviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const records = getPrescriptionsByStatus('hospital', [
      'analyzed', 'needs_correction', 'safety_review_required',
      'clarification_requested', 'approved', 'rejected',
    ]);
    if (!alive) return;
    const out: Row[] = [];
    for (const r of records) {
      if (!r.analysis) continue;
      for (const a of r.analysis.dosageAlerts) {
        if (!DOSAGE_STATUSES.includes(a.status)) continue;
        out.push({
          record: r, alertId: a.id, medicine: a.medicine, status: a.status,
          flaggedField: a.flaggedField, reason: a.reason, severity: a.severity,
          missing: a.missingInformation, reviewStatus: a.reviewStatus, note: a.note,
        });
      }
    }
    setRows(out);
    setLoading(false);
    return () => { alive = false; };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const row of rows) {
      const list = m.get(row.record.id) ?? [];
      list.push(row);
      m.set(row.record.id, list);
    }
    return [...m.entries()];
  }, [rows]);

  const handleAcknowledge = (row: Row) => {
    const result: WorkflowResult = acknowledgeRecordAlert(
      row.record.id, 'dosage', row.alertId, 'Hospital pharmacist (unrecorded)');
    if (result.ok) {
      setRows((prev) => prev.map((r) => (r.alertId === row.alertId ? { ...r, reviewStatus: 'acknowledged' } : r)));
      toast(`Dosage alert acknowledged for ${row.record.id}.`, 'success');
    } else {
      toast(result.error, 'error');
    }
  };

  const reviewPath = '/hospital/prescriptions/review';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dosage Review"
        subtitle="Prescriptions with dosage, frequency or duration concerns in this hospital session"
        crumbs={[{ label: 'Hospital' }, { label: 'Dosage Review' }]}
      />

      <div className="space-y-5">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2"><SkeletonCard lines={3} /><SkeletonCard lines={3} /></div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Gauge}
            title="No dosage alerts"
            message="Prescriptions with dosage, frequency or duration concerns appear here after analysis. No dosage data is validated by a clinical rules engine in prototype mode."
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
          <ul className="space-y-4" aria-label="Dosage review list">
            {grouped.map(([recordId, alertRows]) => (
              <li key={recordId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={reviewPath}
                    state={{ prescriptionId: recordId }}
                    className="font-mono text-xs font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
                  >
                    {recordId}
                  </Link>
                  <StatusBadgeFor status={alertRows[0].record.status} />
                  <span className="text-xs text-slate-500">
                    Age {alertRows[0].record.analysis ? String((alertRows[0].record as { patientAge?: number }).patientAge ?? '—') : '—'} · patient ref {alertRows[0].record.patientReference}
                  </span>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {alertRows.map((row) => (
                    <li key={row.alertId} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-800">{row.medicine}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.severity === 'critical' ? 'bg-red-50 text-red-700'
                            : row.severity === 'high' ? 'bg-orange-50 text-orange-700'
                              : row.severity === 'moderate' ? 'bg-amber-50 text-amber-700'
                                : 'bg-sky-50 text-sky-700'}`}>
                          {DOSAGE_LABEL[row.status]}
                        </span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">flagged: {row.flaggedField}</span>
                        <span className="ml-auto text-[11px] font-semibold text-slate-500">{row.reviewStatus.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600">{row.reason}</p>
                      {row.missing.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">Missing information: {row.missing.join(', ')}</p>
                      )}
                      {row.note && <p className="mt-1 text-xs italic text-slate-500">Note: “{row.note}”</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {row.reviewStatus === 'unreviewed' && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(row)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                          >
                            Acknowledge
                          </button>
                        )}
                        <Link
                          to={reviewPath}
                          state={{ prescriptionId: row.record.id }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                        >
                          <Eye size={13} aria-hidden="true" /> Review prescription
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-slate-400">
          Demo dosage rules only — a validated clinical rules engine is required before production use. Audit trail is on each prescription's review page.
        </p>
      </div>
    </div>
  );
}
