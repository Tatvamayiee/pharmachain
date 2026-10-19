// ---------------------------------------------------------------------------
// Prescription prototype shared UI — reused by the scanner and history pages
// for both the dealer (pharmacy) and hospital roles.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Server,
  ShieldAlert,
} from 'lucide-react';
import type {
  AlertReviewStatus,
  AlertSeverity,
  DosageAlert,
  DosageStatus,
  InteractionAlert,
  MatchStatus,
  PrescriptionStatus,
} from '../../types/prescription';
import StatusBadge from '../ui/StatusBadge';
import { apiUrl } from '../../lib/api';

// ---------------------- Backend connection status panel ---------------------

type ConnState = 'mock' | 'not_implemented' | 'mock_active_app' | 'connected';

interface ConnRow {
  item: string;
  state: ConnState;
  currentSource: string;
  missing: string;
  future: string;
}

const CONNECTION_ROWS: ConnRow[] = [
  { item: 'Authentication backend', state: 'mock', currentSource: 'localStorage (services/authService.ts)', missing: 'Server-issued session/token accepted by the frontend', future: 'Connect authService to POST /api/auth/login and store the JWT' },
  { item: 'User data', state: 'mock', currentSource: 'data/mockData.ts (in-memory)', missing: 'Shared user store between frontend and backend', future: 'Serve users from the database via /api/auth/me' },
  { item: 'Medicine data', state: 'mock', currentSource: 'data/mockData.ts', missing: 'GET /api/medicines', future: 'Fetch catalogue from the backend' },
  { item: 'Batch data', state: 'mock', currentSource: 'data/mockData.ts', missing: 'GET /api/batches', future: 'Fetch batches from the backend' },
  { item: 'Shipment data', state: 'mock_active_app', currentSource: 'data/mockData.ts in the active app', missing: 'Wiring to the existing in-memory /api/shipments', future: 'Shipments endpoint exists but uses a separate legacy auth system' },
  { item: 'QR verification', state: 'mock', currentSource: 'services/verificationService.ts', missing: 'Wiring to /verify/:code', future: 'Verify batches against the backend' },
  { item: 'Prescription review workflow', state: 'mock', currentSource: 'Local prototype (prescriptionService.ts)', missing: 'Server-side review state', future: 'POST /api/prescriptions/:id/review + persistent storage' },
  { item: 'Pharmacist approvals', state: 'mock', currentSource: 'Local prototype only', missing: 'Authenticated decision recording', future: 'POST /api/prescriptions/:id/approve with JWT identity' },
  { item: 'Dispensing status', state: 'connected', currentSource: 'Server workflow (POST /api/prescriptions/:id/dispense)', missing: 'Real ERP/inventory system integration', future: 'Replace the demo batch stock with the production inventory system' },
  { item: 'Audit history', state: 'connected', currentSource: 'Server-side audit log (GET /api/prescriptions/:id/audit)', missing: 'Long-term retention policy', future: 'Append-only storage with retention + export' },
  { item: 'Inventory deduction', state: 'connected', currentSource: 'FIFO batch deduction on dispense (org-scoped demo stock)', missing: 'Production inventory system', future: 'Point batchRepo at the live stock system' },
  { item: 'Patient record storage', state: 'connected', currentSource: 'Encrypted patient record store (AES-256-GCM, salted-hash references)', missing: 'Formal compliance review (HIPAA/GDPR)', future: 'Compliance audit before holding real patient data' },
  { item: 'Prescription upload', state: 'connected', currentSource: 'POST /api/prescriptions/:id/upload — multipart, encrypted at rest (AES-256-GCM), org-scoped', missing: 'Object storage (S3-style) for scale', future: 'Move file storage behind a managed object store' },
  { item: 'OCR service', state: 'connected', currentSource: 'Hugging Face vision model behind POST /api/prescriptions/:id/analyze', missing: 'Validated medical OCR certification', future: 'Benchmark against a validated medical OCR provider' },
  { item: 'Drug database', state: 'mock', currentSource: 'Server-side reference dataset (server/services/drugDatabaseService.cjs)', missing: 'Licensed clinical dataset (RxNorm / DrugBank / formulary)', future: 'Swap the reference dataset for a licensed API — shape unchanged' },
  { item: 'Interaction checking', state: 'mock', currentSource: 'POST /api/drugs/interactions/check over the reference dataset', missing: 'Validated clinical rules engine', future: 'Back the endpoint with a licensed dataset' },
  { item: 'Dosage validation', state: 'mock', currentSource: 'POST /api/drugs/dosage/validate (age-aware reference rules)', missing: 'Age/weight-aware clinical dosing references', future: 'License clinical dosing references' },
  { item: 'Prescription storage', state: 'connected', currentSource: 'Encrypted server-side files + MongoDB records (org-scoped)', missing: 'Retention policy + backup strategy', future: 'Define retention/backup before production data' },
  { item: 'Audit logs', state: 'mock', currentSource: 'data/mockData.ts', missing: 'Persisted access/decision audit trail', future: 'Append-only server-side audit log' },
  // NOTE: the MongoDB row is rendered dynamically below — it queries /api/health
  // so it always reflects the real connection state instead of stale text.
];

const STATE_BADGE: Record<ConnState, { label: string; tone: 'warning' | 'error' | 'info' | 'success' }> = {
  mock: { label: 'Mock', tone: 'warning' },
  mock_active_app: { label: 'Mock in active app', tone: 'warning' },
  not_implemented: { label: 'Not implemented', tone: 'error' },
  connected: { label: 'Implemented', tone: 'success' },
};

type ServerHealth = 'checking' | 'up' | 'down';

/** Live backend status: queries /api/health through the Vite proxy. */
function useServerHealth(): { health: ServerHealth; dbMode: string | null } {
  const [health, setHealth] = useState<ServerHealth>('checking');
  const [dbMode, setDbMode] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(apiUrl('/api/health'), { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { dbMode?: string } | null) => {
        if (data && typeof data.dbMode === 'string') {
          setHealth('up');
          setDbMode(data.dbMode);
        } else {
          setHealth('down');
        }
      })
      .catch(() => setHealth('down'))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return { health, dbMode };
}

export function BackendConnectionStatus() {
  const [open, setOpen] = useState(false);
  const { health, dbMode } = useServerHealth();

  // The MongoDB row is live: connected / in-memory fallback / not connected.
  const mongoRow: ConnRow =
    health === 'up' && dbMode === 'mongodb'
      ? { item: 'MongoDB', state: 'connected', currentSource: 'Connected — server reports dbMode: mongodb (persistent)', missing: 'Production cluster hardening (replica set, backups)', future: 'Managed MongoDB deployment for production' }
      : health === 'up'
        ? { item: 'MongoDB', state: 'mock', currentSource: 'Server up — in-memory fallback (no URI configured)', missing: 'PHARMACHAIN_MONGODB_URI in .env for persistence', future: 'Set the URI; data survives restarts once connected' }
        : { item: 'MongoDB', state: 'not_implemented', currentSource: 'Not connected — backend server not reachable', missing: 'Running Express server (npm run dev:server)', future: 'Start the server; it reports the real db mode via /api/health' };

  const rows = [...CONNECTION_ROWS, mongoRow];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Backend connection status">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="rx-conn-panel"
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
          <Server size={17} className="text-indigo-600" aria-hidden="true" />
          Backend Connection Status
          <StatusBadge
            status={health === 'up' ? `Server up — ${dbMode === 'mongodb' ? 'MongoDB' : 'in-memory'}` : health === 'checking' ? 'Checking…' : 'Server not running'}
            tone={health === 'up' ? (dbMode === 'mongodb' ? 'success' : 'warning') : health === 'checking' ? 'default' : 'error'}
 />
        </span>
        <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="rx-conn-panel" className="border-t border-slate-100 px-4 py-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Item</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Current source</th>
                  <th className="py-2 pr-3 font-semibold">What is missing</th>
                  <th className="py-2 font-semibold">Future integration requirement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item} className="border-b border-slate-50 align-top last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-slate-700">{r.item}</td>
                    <td className="py-2.5 pr-3"><StatusBadge status={STATE_BADGE[r.state].label} tone={STATE_BADGE[r.state].tone} /></td>
                    <td className="py-2.5 pr-3 text-slate-500">{r.currentSource}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{r.missing}</td>
                    <td className="py-2.5 text-slate-500">{r.future}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {health === 'up' ? (
              <>
                The Express API is <strong>running</strong> (auth, prescription workflow, audit, and{' '}
                {dbMode === 'mongodb' ? 'persistent MongoDB storage' : 'in-memory storage'}) and reports its real state here.
              </>
            ) : (
              <>The Express API is not reachable right now. Start it with <code>npm run dev:server</code>; the panel queries <code>/api/health</code> for the live state.</>
            )}{" "}
            The active frontend pages still use local mock services for the prescription workflow — that wiring is the remaining integration step.
          </p>
        </div>
      )}
    </section>
  );
}

// ------------------------------ Status helpers ------------------------------

/** Human-friendly workflow status labels (single owner for all pages). */
export const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  needs_correction: 'Needs Correction',
  analyzed: 'Analyzed',
  safety_review_required: 'Safety Review Required',
  clarification_requested: 'Clarification Requested',
  approved: 'Approved by Pharmacist',
  rejected: 'Rejected',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
};

export const STATUS_TONE: Record<PrescriptionStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple' | 'muted'> = {
  uploaded: 'default',
  processing: 'info',
  needs_correction: 'warning',
  analyzed: 'info',
  safety_review_required: 'warning',
  clarification_requested: 'purple',
  approved: 'success',
  rejected: 'error',
  dispensed: 'success',
  cancelled: 'muted',
};

export function StatusBadgeFor({ status }: { status: PrescriptionStatus }) {
  return <StatusBadge status={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

// ------------------------------ Severity helpers ----------------------------

export const SEVERITY_STYLES: Record<AlertSeverity, { chip: string; icon: 'red' | 'orange' | 'amber' | 'blue'; label: string }> = {
  critical: { chip: 'border-red-200 bg-red-50', icon: 'red', label: 'Critical' },
  high: { chip: 'border-orange-200 bg-orange-50', icon: 'orange', label: 'High' },
  moderate: { chip: 'border-amber-200 bg-amber-50', icon: 'amber', label: 'Moderate' },
  informational: { chip: 'border-cyan-200 bg-cyan-50', icon: 'blue', label: 'Informational' },
};

export function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  const cls =
    severity === 'critical' ? 'text-red-600' :
    severity === 'high' ? 'text-orange-600' :
    severity === 'moderate' ? 'text-amber-600' : 'text-cyan-600';
  return <ShieldAlert size={18} className={cls} aria-hidden="true" />;
}

// ------------------------------ Alert cards ---------------------------------

const REVIEW_LABEL: Record<AlertReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  acknowledged: 'Acknowledged',
  requires_clarification: 'Requires clarification',
  resolved: 'Resolved',
};

interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  reason: string;
  concern: string;
  action: string;
  source: string;
  reviewStatus: AlertReviewStatus;
  note?: string;
  onAcknowledge: () => void;
  onNote: () => void;
}

export function SafetyAlertCard({
  severity, title, reason, concern, action, source, reviewStatus, note, onAcknowledge, onNote,
}: AlertCardProps) {
  const style = SEVERITY_STYLES[severity];
  return (
    <article className={`rounded-2xl border px-4 py-3.5 ${style.chip}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityIcon severity={severity} />
        <StatusBadge status={style.label} tone={severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : severity === 'moderate' ? 'warning' : 'info'} />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="ml-auto"><StatusBadge status={REVIEW_LABEL[reviewStatus]} tone={reviewStatus === 'resolved' ? 'success' : reviewStatus === 'unreviewed' ? 'default' : 'purple'} /></span>
      </div>
      <dl className="mt-2.5 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
        <div><dt className="inline font-medium text-slate-700">Reason: </dt><dd className="inline">{reason}</dd></div>
        <div><dt className="inline font-medium text-slate-700">Potential concern: </dt><dd className="inline">{concern}</dd></div>
        <div className="sm:col-span-2"><dt className="inline font-medium text-slate-700">Recommended action: </dt><dd className="inline">{action}</dd></div>
        {note && <div className="sm:col-span-2"><dt className="inline font-medium text-slate-700">Pharmacist note: </dt><dd className="inline italic">{note}</dd></div>}
        <div className="sm:col-span-2 text-xs text-slate-400">Source: {source}</div>
      </dl>
      {severity === 'critical' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertTriangle size={14} aria-hidden="true" />
          Pharmacist review required before dispensing.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={reviewStatus !== 'unreviewed'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <CheckCircle2 size={14} aria-hidden="true" /> Acknowledge
        </button>
        <button
          type="button"
          onClick={onNote}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          Add note
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        Demo alert only — connect a validated drug database and clinical rules engine before production use.
      </p>
    </article>
  );
}

export function InteractionAlertCard({
  alert, onAcknowledge, onNote,
}: {
  alert: InteractionAlert;
  onAcknowledge: () => void;
  onNote: () => void;
}) {
  return (
    <SafetyAlertCard
      severity={alert.severity}
      title={alert.medicines.join(' + ')}
      reason={alert.reason}
      concern={alert.potentialConcern}
      action={alert.recommendedAction}
      source={alert.source}
      reviewStatus={alert.reviewStatus}
      note={alert.note}
      onAcknowledge={onAcknowledge}
      onNote={onNote}
    />
  );
}

const DOSAGE_LABEL: Record<DosageStatus, string> = {
  within_expected_range: 'Within expected range',
  possible_overdose: 'Possible overdose',
  possible_underdose: 'Possible underdose',
  frequency_concern: 'Frequency concern',
  duration_concern: 'Duration concern',
  patient_specific_review_required: 'Patient-specific review required',
  unable_to_validate: 'Unable to validate',
};

export function DosageAlertCard({
  alert, onAcknowledge, onNote,
}: {
  alert: DosageAlert;
  onAcknowledge: () => void;
  onNote: () => void;
}) {
  return (
    <SafetyAlertCard
      severity={alert.severity}
      title={`${alert.medicine} — ${DOSAGE_LABEL[alert.status]}`}
      reason={`${alert.reason} (flagged field: ${alert.flaggedField})`}
      concern={alert.missingInformation.length > 0 ? `Missing information: ${alert.missingInformation.join(', ')}` : 'No additional information gaps identified.'}
      action={alert.suggestedAction}
      source="Demo dosage rules (synthetic)"
      reviewStatus={alert.reviewStatus}
      note={alert.note}
      onAcknowledge={onAcknowledge}
      onNote={onNote}
    />
  );
}

// ------------------------------ Match helpers -------------------------------

export const MATCH_LABEL: Record<MatchStatus, string> = {
  matched: 'Matched',
  possible_match: 'Possible match',
  not_found: 'Not found',
  needs_review: 'Needs review',
};
