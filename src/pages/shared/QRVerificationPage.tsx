import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Search, Package, Building2, Calendar, Thermometer, Boxes, BadgeCheck, ShieldAlert, Clock, XCircle, Link2, HelpCircle } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { EmptyState, Spinner } from '../../components/ui/states';
import CameraScanner from '../../components/scanner/CameraScanner';
import { verifyCode, type VerificationOutcome } from '../../services/verificationService';
import { dataService } from '../../services/dataService';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { userName } from '../../data/mockData';
import type { QRVerification } from '../../types';

/**
 * QR 1 — Medicine authentication. Three result states, exactly as the
 * mission defines them (mapped without losing recall/expiry detail):
 *   ✓ Verified   — backend-confirmed authentic, unexpired, not recalled
 *   ⚠ Verification Required — a real batch whose verification is not
 *                  complete: expired, quarantined/in production, or recalled
 *                  (recall/expiry detail is preserved on the banner + badge)
 *   ✗ Invalid/Unknown — the code matches no batch in the system
 */

const RESULT_BANNERS = {
  authentic: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: BadgeCheck, iconCls: 'text-emerald-600', state: '✓ Verified', label: 'AUTHENTIC' },
  expired: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: Clock, iconCls: 'text-amber-600', state: '⚠ Verification Required', label: 'EXPIRED' },
  recalled: { cls: 'border-red-200 bg-red-50 text-red-900', icon: ShieldAlert, iconCls: 'text-red-600', state: '⚠ Verification Required', label: 'RECALLED' },
  quarantine: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: Clock, iconCls: 'text-amber-600', state: '⚠ Verification Required', label: 'PENDING VERIFICATION' },
  invalid: { cls: 'border-red-200 bg-red-50 text-red-900', icon: XCircle, iconCls: 'text-red-600', state: '✗ Invalid / Unknown', label: 'NOT FOUND' },
} as const;

interface HistoryRow extends Record<string, unknown> {
  id: string; batch: string; verifiedBy: string; result: string; location: string; timestamp: string;
}

const HISTORY_COLUMNS: Column<HistoryRow>[] = [
  { key: 'batch', header: 'Batch', render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.batch}</span> },
  { key: 'verifiedBy', header: 'Verified By' },
  { key: 'result', header: 'Result', render: (r) => <StatusBadge status={r.result} /> },
  { key: 'location', header: 'Location' },
  { key: 'timestamp', header: 'Time', render: (r) => new Date(r.timestamp).toLocaleString('en-IN') },
];

export default function QRVerificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const { data: history, loading: historyLoading } = useFetch<QRVerification[]>(() => dataService.getVerifications());
  const [searchParams, setSearchParams] = useSearchParams();

  const runVerify = async (code?: string) => {
    const payload = (code ?? input).trim();
    if (!payload) {
      toast('Enter a batch number or scan a QR code first.', 'warning');
      return;
    }
    setVerifying(true);
    setOutcome(null);
    try {
      const res = await verifyCode(payload);
      setOutcome(res);
      if (res.result === 'authentic') toast(`Batch ${res.batch?.batchNumber} verified successfully.`, 'success');
      else if (res.result === 'invalid') toast('Verification failed — unknown batch.', 'error');
      else toast(`Warning: ${res.message}`, 'warning');
    } finally {
      setVerifying(false);
    }
  };

  // Deep link / Scan-QR handoff: /verify?code=PCM-2411 verifies immediately.
  useEffect(() => {
    const q = searchParams.get('code');
    if (q) {
      setInput(q);
      void runVerify(q);
      searchParams.delete('code');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const historyRows: HistoryRow[] = (history ?? []).map((v) => ({
    id: v.id,
    batch: v.qrCode,
    verifiedBy: userName(v.verifiedBy),
    result: v.result,
    location: v.location,
    timestamp: v.timestamp,
  }));

  return (
    <>
      <PageHeader
        title="QR Verification"
        subtitle="Scan a package or enter a batch number to verify authenticity, expiry and recall status"
        crumbs={[{ label: 'QR Verification' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Scanner panel */}
        <section aria-label="Scan QR code" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <CameraScanner
            className="h-56"
            onDecoded={(text) => { setInput(text); void runVerify(text); }}
            hint="Enable the camera and point it at the QR code on the medicine package"
          />

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-100" /> or enter manually <span className="h-px flex-1 bg-slate-100" />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Batch number or QR payload</span>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runVerify(); }}
                placeholder="e.g. PCM-2411-A"
                aria-label="Batch number or QR payload"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase tracking-wide focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button" onClick={() => runVerify()} disabled={verifying}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {verifying ? <Spinner className="text-white" /> : <Search size={15} aria-hidden="true" />}
                Verify
              </button>
            </div>
          </label>

          <div className="mt-4 rounded-xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-500">Try these demo codes:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['PCM-2411-A', 'IBU-2412-J', 'AMX-2402-D', 'ZZZ-0000-X'].map((code) => (
                <button
                  key={code} type="button" onClick={() => { setInput(code); runVerify(code); }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Result panel */}
        <section aria-label="Verification result" aria-live="polite">
          {verifying && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" role="status">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" aria-hidden="true" />
              <p className="text-sm text-slate-500">Verifying batch…</p>
            </div>
          )}

          {!verifying && !outcome && (
            <EmptyState
              icon={ShieldCheck}
              title="No verification yet"
              message="Scan a QR code or enter a batch number to see the medicine record and its verification status."
            />
          )}

          {!verifying && outcome && (
            <div className="space-y-5">
              {/* Banner — the three mission result states */}
              {(() => {
                const B = RESULT_BANNERS[outcome.result];
                return (
                  <div className={`flex items-start gap-3 rounded-2xl border p-5 ${B.cls}`} role="status">
                    <B.icon size={26} className={`mt-0.5 shrink-0 ${B.iconCls}`} aria-hidden="true" />
                    <div>
                      <p className="text-base font-bold">{B.state}</p>
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80">{B.label}</p>
                      <p className="mt-1 text-sm font-medium">{outcome.message}</p>
                    </div>
                  </div>
                );
              })()}

              {outcome.batch && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{outcome.batch.medicineName}</h2>
                      <p className="text-sm text-slate-500">{outcome.batch.genericName || 'Generic name not provided'}</p>
                    </div>
                    <StatusBadge status={outcome.batch.status} />
                  </div>
                  <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {[
                      { icon: Package, label: 'Package / serial ID', value: outcome.batch.packageId || outcome.batch.batchNumber, mono: true },
                      { icon: Building2, label: 'Manufacturer', value: outcome.batch.manufacturer },
                      { icon: Package, label: 'Batch number', value: outcome.batch.batchNumber, mono: true },
                      { icon: Calendar, label: 'Manufacturing date', value: outcome.batch.manufacturingDate || 'Not provided' },
                      { icon: Calendar, label: 'Expiry date', value: outcome.batch.expiryDate || 'Not provided' },
                      { icon: Thermometer, label: 'Storage', value: outcome.batch.storageCondition || 'Not provided' },
                      { icon: Boxes, label: 'Available quantity', value: `${(outcome.batch.availableQuantity ?? 0).toLocaleString('en-IN')} units` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-3">
                        <row.icon size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                        <div className="min-w-0">
                          <dt className="text-xs text-slate-400">{row.label}</dt>
                          <dd className={`truncate text-sm font-semibold text-slate-800 ${row.mono ? 'font-mono' : ''}`}>{row.value}</dd>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-3">
                      {outcome.batch.integrity === 'onchain'
                        ? <Link2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
                        : <HelpCircle size={16} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />}
                      <div className="min-w-0">
                        <dt className="text-xs text-slate-400">Integrity / blockchain</dt>
                        <dd className={`text-sm font-semibold ${outcome.batch.integrity === 'onchain' ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {outcome.batch.integrity === 'onchain' ? 'On-chain record verified' : 'Not available for this batch'}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Building2 size={16} className="mt-0.5 shrink-0 text-indigo-500" aria-hidden="true" />
                      <div>
                        <dt className="text-xs text-slate-400">Current owner</dt>
                        <dd className="text-sm font-semibold text-slate-800">{outcome.currentOwner}</dd>
                      </div>
                    </div>
                  </dl>
                  {outcome.batch.status === 'recalled' && outcome.batch.recallReason && (
                    <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
                      Recall reason: {outcome.batch.recallReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Verification history — authenticated users only: the scan log is
          an authenticated endpoint, and anonymous visitors must never be
          shown mock rows as if they were real scans. */}
      {user && (
        <section aria-label="Verification history" className="mt-6">
          <h2 className="mb-3 font-semibold text-slate-900">Recent verifications</h2>
          <DataTable
            columns={HISTORY_COLUMNS}
            rows={historyRows}
            rowKey={(r) => r.id}
            loading={historyLoading}
            emptyMessage="No verification history yet"
            skeletonRows={4}
          />
        </section>
      )}
    </>
  );
}
