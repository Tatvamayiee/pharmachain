import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, Heart, MapPin, ShieldAlert, AlertTriangle, XCircle } from 'lucide-react';
import TablePage from '../../../shared/pages/TablePage';
import PageHeader from '../../../shared/components/ui/PageHeader';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import Timeline from '../../../shared/components/ui/Timeline';
import { EmptyState } from '../../../shared/components/ui/states';
import CameraScanner from '../../../shared/components/scanner/CameraScanner';
import { verifyCode, type VerificationOutcome } from '../../verification/services/verificationService';
import { useToast } from '../../../app/providers/ToastContext';
import type { Column } from '../../../shared/components/ui/DataTable';

type Any = Record<string, unknown>;

const BANNERS = {
  authentic: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: BadgeCheck, iconCls: 'text-emerald-600', label: 'AUTHENTIC', msg: 'This medicine appears to be authentic.' },
  expired: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: Clock, iconCls: 'text-amber-600', label: 'EXPIRED — VERIFICATION REQUIRED', msg: 'This medicine has expired.' },
  recalled: { cls: 'border-red-200 bg-red-50 text-red-900', icon: ShieldAlert, iconCls: 'text-red-600', label: 'RECALLED — VERIFICATION REQUIRED', msg: 'This batch has been recalled.' },
  quarantine: { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: Clock, iconCls: 'text-amber-600', label: 'VERIFICATION REQUIRED', msg: 'This batch is recorded but has not completed verification yet.' },
  invalid: { cls: 'border-red-200 bg-red-50 text-red-900', icon: XCircle, iconCls: 'text-red-600', label: 'NOT FOUND', msg: 'This medicine could not be verified.' },
} as const;

export function ScanMedicineQR() {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);

  const onDecoded = async (text: string) => {
    setOutcome(null);
    const res = await verifyCode(text);
    setOutcome(res);
    if (res.result === 'authentic') toast(`Batch ${res.batch?.batchNumber} verified successfully.`, 'success');
    else if (res.result === 'invalid') toast('Verification failed — unknown batch.', 'error');
    else toast(`Warning: ${res.message}`, 'warning');
  };

  const banner = outcome ? BANNERS[outcome.result] : null;
  const BannerIcon = banner?.icon;

  return (
    <>
      <PageHeader title="Scan Medicine QR" subtitle="Point your camera at the QR code printed on the pack" crumbs={[{ label: 'Customer' }, { label: 'Scan Medicine QR' }]} />
      <section aria-label="QR scanner" className="mx-auto max-w-lg rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <CameraScanner
          className="h-72"
          onDecoded={(text) => void onDecoded(text)}
          hint="Enable the camera and point it at the QR code on the pack"
        />

        {banner && BannerIcon && (
          <div role="status" className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-left ${banner.cls}`}>
            <BannerIcon size={22} className={`mt-0.5 shrink-0 ${banner.iconCls}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide">{banner.label}</p>
              <p className="mt-0.5 text-sm">{outcome?.message || banner.msg}</p>
              {outcome?.batch && (
                <p className="mt-1 text-xs opacity-80">
                  {outcome.batch.medicineName} · batch <span className="font-mono">{outcome.batch.batchNumber}</span> · expires {new Date(outcome.batch.expiryDate).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="mt-4 text-sm text-slate-400">
          No camera? <Link to="/customer/verify" className="font-semibold text-indigo-600 hover:underline">Enter the batch number manually →</Link>
        </p>
      </section>
    </>
  );
}

export function VerifyMedicine() {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const run = async () => {
    if (!code.trim()) return;
    setBusy(true); setOutcome(null);
    const res = await verifyCode(code);
    setOutcome(res);
    setHistory((h) => [code.trim().toUpperCase(), ...h].slice(0, 6));
    setBusy(false);
  };

  return (
    <>
      <PageHeader title="Verify Medicine" subtitle="Enter the batch number printed on your pack" crumbs={[{ label: 'Customer' }, { label: 'Verify Medicine' }]} />
      <div className="mx-auto max-w-2xl">
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
            placeholder="e.g. PCM-2411-A"
            aria-label="Batch number"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm uppercase tracking-wide focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button type="button" onClick={run} disabled={busy} className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50">
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </div>
        {history.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {history.map((h) => (
              <button key={h} type="button" onClick={() => setCode(h)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-700">{h}</button>
            ))}
          </div>
        )}

        <div className="mt-6" aria-live="polite">
          {busy && (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" role="status">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" aria-hidden="true" />
              <span className="text-sm text-slate-500">Verifying…</span>
            </div>
          )}
          {!busy && !outcome && (
            <EmptyState icon={BadgeCheck} title="Enter a batch number" message="Try PCM-2411-A (authentic), IBU-2412-J (recalled), AMX-2402-D (expired) or ZZZ-0000-X (invalid)." />
          )}
          {!busy && outcome && (
            <div className={`rounded-2xl border p-6 ${BANNERS[outcome.result].cls}`}>
              <div className="flex items-start gap-3">
                {(() => { const B = BANNERS[outcome.result]; return <B.icon size={28} className={`shrink-0 ${B.iconCls}`} aria-hidden="true" />; })()}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">{BANNERS[outcome.result].label}</p>
                  <p className="mt-0.5 font-medium">{BANNERS[outcome.result].msg}</p>
                </div>
              </div>
              {outcome.batch && (
                <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {[
                    ['Medicine', outcome.batch.medicineName],
                    ['Batch', outcome.batch.batchNumber],
                    ['Manufacturer', outcome.batch.manufacturer],
                    ['Expiry', outcome.batch.expiryDate],
                  ].map(([k, v]) => (
                    <div key={k}><dt className="text-xs opacity-70">{k}</dt><dd className="font-semibold">{v}</dd></div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const ORDERS = [
  { id: 'ORD-50231', medicine: 'Paracetamol 500 mg', pharmacy: 'sahana Medicals', qty: 2, total: '₹540', status: 'IN_TRANSIT', date: '15 Mar 2026' },
  { id: 'ORD-50198', medicine: 'Cetirizine 10 mg', pharmacy: 'sahana Medicals', qty: 1, total: '₹160', status: 'DELIVERED', date: '10 Mar 2026' },
  { id: 'ORD-50154', medicine: 'Omeprazole 20 mg', pharmacy: 'sahana Medicals', qty: 3, total: '₹770', status: 'ASSIGNED_TO_DEALER', date: '12 Mar 2026' },
  { id: 'ORD-50120', medicine: 'Vitamin D3 Tablets', pharmacy: 'GreenLeaf Pharmacy', qty: 1, total: '₹360', status: 'DELIVERED', date: '02 Mar 2026' },
];

export function MyOrders() {
  return (
    <TablePage
      title="My Orders" subtitle="Your medicine orders from pharmacies"
      crumbs={[{ label: 'Customer' }, { label: 'My Orders' }]}
      load={async () => ORDERS}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'id', header: 'Order', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'pharmacy', header: 'Pharmacy', hideOnMobile: true },
        { key: 'qty', header: 'Qty' },
        { key: 'total', header: 'Total' },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
        { key: 'date', header: 'Date', hideOnMobile: true },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'medicine', 'pharmacy']}
      filters={[{ label: 'Status', field: 'status', options: [{ value: 'all', label: 'All' }, { value: 'IN_TRANSIT', label: 'In transit' }, { value: 'DELIVERED', label: 'Delivered' }, { value: 'ASSIGNED_TO_DEALER', label: 'Processing' }] }]}
      emptyMessage="No orders yet"
    />
  );
}

const JOURNEY = ['Order placed', 'Packed by pharmacy', 'Handed to courier', 'Out for delivery', 'Delivered'];

export function OrderTracking() {
  return (
    <>
      <PageHeader title="Order Tracking" subtitle="Follow your orders step by step" crumbs={[{ label: 'Customer' }, { label: 'Order Tracking' }]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Active order tracking" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <p className="font-mono text-sm font-semibold text-slate-900">ORD-50231</p>
          <p className="text-sm text-slate-500">Paracetamol 500 mg × 2 · sahana Medicals</p>
          <div className="mt-4"><Timeline events={JOURNEY.map((label, i) => ({ label, done: i < 3, tone: i === 2 ? 'info' as const : 'success' as const }))} /></div>
        </section>
        <section aria-label="Delivery location" className="rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50 to-sky-50 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><MapPin size={16} className="text-indigo-600" aria-hidden="true" /> Delivery location</h2>
          <p className="mt-3 text-sm text-slate-600">12/A Anna Nagar,<br />Madurai, Tamil Nadu 625001</p>
          <p className="mt-4 rounded-xl bg-white/80 px-3.5 py-2.5 text-xs text-slate-500">
            Map preview is a placeholder — production connects live courier tracking.
          </p>
        </section>
      </div>
    </>
  );
}

export function SavedMedicines() {
  return (
    <>
      <PageHeader title="Saved Medicines" subtitle="Your frequently purchased medicines" crumbs={[{ label: 'Customer' }, { label: 'Saved Medicines' }]} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { name: 'Paracetamol 500 mg', use: 'Pain & fever', note: 'Verified 4 times' },
          { name: 'Vitamin D3 Tablets', use: 'Weekly supplement', note: 'Verified 2 times' },
          { name: 'Cetirizine 10 mg', use: 'Allergy relief', note: 'Verified 1 time' },
        ].map((m) => (
          <li key={m.name} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Heart size={16} className="text-rose-500" aria-hidden="true" />
            <p className="mt-2 font-semibold text-slate-900">{m.name}</p>
            <p className="text-sm text-slate-500">{m.use}</p>
            <p className="mt-2 text-xs text-emerald-600">✓ {m.note}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CustomerRecalls() {
  return (
    <>
      <PageHeader title="Recall Alerts" subtitle="Safety actions affecting medicines you may have purchased" crumbs={[{ label: 'Customer' }, { label: 'Recall Alerts' }]} />
      <div className="space-y-4">
        <article className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-5">
          <AlertTriangle size={24} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-red-900">Ibuprofen 400 mg — batch IBU-2412-J recalled</p>
            <p className="mt-1 text-sm text-red-800">Dissolution test failure. Stop using packs from this batch and return them to your pharmacy for a refund.</p>
            <p className="mt-2 text-xs text-red-500">Severity: High · Issued by Tatva Pharmaceuticals · 5 days ago</p>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-semibold text-slate-800">Amoxicillin 500 mg — batch AMX-2402-D past expiry</p>
          <p className="mt-1 text-sm text-slate-500">Not a recall — this batch has expired. Pharmacies have been asked to quarantine remaining stock.</p>
          <p className="mt-2 text-xs text-slate-400">Severity: Medium · 20 days ago</p>
        </article>
      </div>
    </>
  );
}

export function ReportMedicine() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHeader title="Report Medicine" subtitle="Report a suspicious, damaged or mislabelled medicine" crumbs={[{ label: 'Customer' }, { label: 'Report Medicine' }]} />
      <form
        onSubmit={(e) => { e.preventDefault(); setSent(true); toast('Report submitted — regulators have been notified. Thank you.', 'success'); }}
        className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
      >
        {sent && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Report received. Reference: RPT-{Date.now().toString().slice(-6)}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Batch number on pack</span>
          <input required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. PCM-2411-A" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Pharmacy purchased from</span>
          <input required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Pharmacy name and location" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">What is wrong?</span>
          <select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
            <option>Suspected counterfeit</option>
            <option>Damaged packaging</option>
            <option>Wrong label or strength</option>
            <option>Adverse reaction</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Describe the issue</span>
          <textarea required rows={4} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input required type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          I confirm the details above are accurate to the best of my knowledge.
        </label>
        <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          Submit report
        </button>
      </form>
    </>
  );
}

export function CustomerHelp() {
  return (
    <>
      <PageHeader title="Help & Support" subtitle="Guidance for verifying and reporting medicines" crumbs={[{ label: 'Customer' }, { label: 'Help & Support' }]} />
      <div className="mx-auto max-w-2xl space-y-4">
        {[
          { q: 'Where do I find the batch number?', a: 'It is printed near the expiry date on the strip or carton, and is also encoded in the QR code on the pack.' },
          { q: 'The scan says "Not found" — what now?', a: 'Do not consume the medicine. Report it using the Report Medicine page; regulators will investigate the seller.' },
          { q: 'A medicine I bought was recalled. What should I do?', a: 'Check the recall alerts page for instructions. Usually you return the pack to the pharmacy for a refund or replacement.' },
          { q: 'Can I verify without the internet?', a: 'Verification requires connectivity in this prototype; production deployments include offline verification via the mobile app.' },
        ].map((f) => (
          <details key={f.q} className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-slate-800 marker:hidden group-open:text-indigo-700">
              {f.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.a}</p>
          </details>
        ))}
        <p className="text-center text-sm text-slate-400">Still need help? <Link to="/contact" className="font-semibold text-indigo-600 hover:underline">Contact support</Link></p>
      </div>
    </>
  );
}
