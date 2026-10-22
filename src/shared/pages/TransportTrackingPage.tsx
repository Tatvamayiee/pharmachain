import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Truck, MapPin, Clock, PackageSearch, ScanLine, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Timeline from '../components/ui/Timeline';
import CameraScanner from '../components/scanner/CameraScanner';
import { Spinner } from '../components/ui/states';
import { api } from '../../platform/api/api';
import { TRANSPORT_STATUS_LABELS as STATUS_LABELS, TRANSPORT_CAN_UPDATE as CAN_UPDATE, nextTransportStatus } from '../../features/transport/data/transportStatus';
import { useAuth } from '../../app/providers/AuthContext';
import { useToast } from '../../app/providers/ToastContext';
import type { TimelineEvent } from '../types';

/**
 * Transport-tracking page (QR 2) — served at /transport/:qrId.
 * Mobile-first: this is what opens when a transporter/pharmacy/customer scans
 * the transport QR on a shipping box. Shows WHERE the shipment is now and the
 * full append-only journey. Authorized supply-chain roles can also update the
 * current location right from the scan (server enforces the role matrix).
 */

interface TimelineRow {
  location: string; status: string; timestamp: string; note?: string;
  updatedBy?: string; organization?: string; role?: string;
}

interface TransportData {
  shipment: {
    shipmentId: string; transportQrId: string; medicine: string; batchNumber: string;
    quantity: number; manufacturer: string; destination: string;
    currentLocation: string; currentStatus: string; lastUpdated: string; delivered: boolean;
  };
  timeline: TimelineRow[];
  fullAccess: boolean;
}

const UPDATE_STATUSES = ['PICKED_UP', 'IN_TRANSIT', 'AT_DISTRIBUTION_CENTER', 'OUT_FOR_DELIVERY', 'AT_PHARMACY', 'DELIVERED'];

export default function TransportTrackingPage() {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<TransportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!qrId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await api<TransportData>(`/api/transport/history/${encodeURIComponent(qrId)}`);
      setData(res);
      setStatus(res.shipment.delivered ? '' : nextDefault(res.shipment.currentStatus));
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) setNotFound(true);
      else setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [qrId]);

  useEffect(() => { void load(); }, [load]);

  const update = async () => {
    if (!data) return;
    if (!location.trim()) { toast('Enter the current location first.', 'warning'); return; }
    setSaving(true);
    try {
      await api('/api/transport/scan', {
        method: 'POST',
        body: JSON.stringify({ transportQrId: data.shipment.transportQrId, location: location.trim(), status: status || undefined, note: note.trim() || undefined }),
      });
      toast(`Location updated: ${location.trim()}`, 'success');
      setLocation(''); setNote('');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update rejected.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onDecoded = (text: string) => {
    // Accept both the raw token and a full payload URL.
    const m = text.match(/transport\/([A-Za-z0-9_-]+)/);
    const id = m ? m[1] : text.trim();
    if (id && id !== qrId) navigate(`/transport/${encodeURIComponent(id)}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-sky-100 border-t-sky-600" aria-hidden="true" />
        <p className="text-sm text-slate-500">Loading shipment tracking…</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <>
        <PageHeader title="Transport Tracking" subtitle="Scan result" crumbs={[{ label: 'Transport Tracking' }]} />
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle size={40} className="mx-auto text-red-400" aria-hidden="true" />
          <h2 className="mt-3 font-bold text-red-900">Unknown transport QR</h2>
          <p className="mt-1 text-sm text-red-700">
            This code does not match any shipment in PharmaChain. Check the code or scan again — transport QRs look
            like <span className="font-mono">https://…/transport/TRQ-…</span>
          </p>
        </div>
      </>
    );
  }

  const s = data.shipment;
  const events: TimelineEvent[] = data.timeline.map((e) => ({
    label: `${STATUS_LABELS[e.status] ?? e.status} — ${e.location}`,
    description: data.fullAccess && e.updatedBy
      ? `${e.updatedBy}${e.organization ? ` · ${e.organization}` : ''}${e.role ? ` (${e.role})` : ''}${e.note ? ` — ${e.note}` : ''}`
      : e.note || undefined,
    timestamp: new Date(e.timestamp).toLocaleString('en-IN'),
    done: true,
    tone: e.status === 'DELIVERED' ? 'success' : 'info',
  }));

  const canUpdate = !!user && CAN_UPDATE.has(user.role) && !s.delivered;

  return (
    <>
      <PageHeader
        title="Medicine Transport Tracking"
        subtitle="Where is this shipment now, and where has it travelled?"
        crumbs={[{ label: 'Transport Tracking' }]}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Current status card */}
        <section aria-label="Current shipment status" className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600" aria-hidden="true"><Truck size={22} /></span>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900">{s.medicine}</h2>
              <p className="text-xs text-slate-500">Shipment <span className="font-mono font-semibold text-slate-700">{s.shipmentId}</span> · Batch <span className="font-mono">{s.batchNumber}</span></p>
            </div>
          </div>

          <dl className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-400">Current location</dt>
                <dd className="text-base font-bold text-slate-900">{s.currentLocation || 'Not yet picked up'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <PackageSearch size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-400">Transport status</dt>
                <dd className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ${s.delivered ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>
                  {s.delivered && <CheckCircle2 size={14} aria-hidden="true" />}
                  {STATUS_LABELS[s.currentStatus] ?? s.currentStatus}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-400">Last updated</dt>
                <dd className="text-sm font-semibold text-slate-800">{new Date(s.lastUpdated).toLocaleString('en-IN')}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Truck size={18} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
              <div>
                <dt className="text-xs text-slate-400">Route</dt>
                <dd className="text-sm font-semibold text-slate-800">{s.manufacturer} → {s.destination || '—'}</dd>
              </div>
            </div>
          </dl>

          {/* Authorized update form */}
          {canUpdate ? (
            <form
              className="mt-6 rounded-xl border border-sky-200 bg-sky-50/50 p-4"
              onSubmit={(e) => { e.preventDefault(); void update(); }}
            >
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <ScanLine size={15} className="text-sky-600" aria-hidden="true" /> Update location &amp; status
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Your name, organization and role are recorded with every update.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Current location *</span>
                  <input
                    value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Coimbatore Distribution Center"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Status</span>
                  <select
                    value={status} onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    {UPDATE_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
                  <input
                    value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
                    placeholder="e.g. Cold chain intact"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>
              <button
                type="submit" disabled={saving}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Spinner className="text-white" /> : <RefreshCw size={15} aria-hidden="true" />}
                {saving ? 'Updating…' : 'Update shipment location'}
              </button>
            </form>
          ) : s.delivered ? (
            <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800">
              <CheckCircle2 size={16} aria-hidden="true" /> Delivered — the tracking timeline is complete.
            </p>
          ) : (
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              {user
                ? 'Your role can view tracking, but only authorized transport/distribution roles can update locations.'
                : 'Sign in as an authorized transporter or distributor to update the shipment location.'}
            </p>
          )}
        </section>

        {/* Timeline + scanner */}
        <div className="space-y-5">
          <section aria-label="Tracking timeline" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Tracking timeline</h2>
            {events.length === 0
              ? <p className="text-sm text-slate-400">No transport events recorded yet — the shipment is prepared but hasn't been picked up.</p>
              : <Timeline events={events} />}
          </section>

          <section aria-label="Scan another transport QR" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-2 font-semibold text-slate-900">Scan another transport QR</h2>
            <CameraScanner className="h-48" onDecoded={onDecoded} hint="Point the camera at the transport QR on the shipping box" />
          </section>
        </div>
      </div>
    </>
  );
}

function nextDefault(current: string): string {
  return nextTransportStatus(current) ?? 'DELIVERED';
}
