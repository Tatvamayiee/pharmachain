import { useCallback, useEffect, useState } from 'react';
import { Truck, QrCode, MapPin, Copy, Check, ExternalLink } from 'lucide-react';
import QRCodeDisplay from './QRCodeDisplay';
import { api } from '../../../platform/api/api';
import { useToast } from '../../../app/providers/ToastContext';
import { TRANSPORT_STATUS_LABELS as STATUS_LABELS } from '../../../features/transport/data/transportStatus';

/**
 * SECTION B of the two-QR system: MEDICINE TRANSPORT TRACKING QR (QR 2).
 *
 * Strictly separate from the authentication QR (Section A / QR 1):
 *   - QR 1 payload: https://pharmachain.app/verify/<batchNumber> → "is this medicine valid?"
 *   - QR 2 payload: https://pharmachain.app/transport/<transportQrId> → "where is it now?"
 *
 * The transport QR carries ONLY an opaque random token (transportQrId) — never
 * batch numbers, patient data or secrets. Verification/location updates happen
 * exclusively on the backend with JWT + role checks.
 */

interface TransportShipment {
  shipmentId: string;
  transportQrId: string;
  medicine: string;
  batchNumber: string;
  quantity: number;
  manufacturer: string;
  destination: string;
  currentLocation: string;
  currentStatus: string;
  lastUpdated: string;
  delivered: boolean;
  hasTransportQr: boolean;
}

/** Backwards-compatible re-exports — the vocabulary lives in lib/transportStatus. */
export { TRANSPORT_STATUS_LABELS as STATUS_LABELS, normTransportStatus as normStatus } from '../../../features/transport/data/transportStatus';

export default function TransportQRPanel() {
  const { toast } = useToast();
  const [shipments, setShipments] = useState<TransportShipment[] | null>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ shipments: TransportShipment[] }>('/api/transport/shipments');
      setShipments(res.shipments);
      setSelectedCode((prev) => prev || res.shipments[0]?.shipmentId || '');
    } catch {
      setShipments([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = shipments?.find((s) => s.shipmentId === selectedCode) ?? null;
  const payload = current?.transportQrId ? `https://pharmachain.app/transport/${current.transportQrId}` : '';

  const generate = async () => {
    if (!current) return;
    setGenerating(true);
    setCopied(false);
    try {
      await api('/api/transport/qr', { method: 'POST', body: JSON.stringify({ shipmentCode: current.shipmentId }) });
      toast(`Transport QR generated for shipment ${current.shipmentId}.`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not generate the transport QR.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — the QR itself still works */ }
  };

  return (
    <section aria-label="Transport tracking QR (Section B)" className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600" aria-hidden="true">
          <Truck size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">Section B — Medicine Transport Tracking (QR 2)</h2>
          <p className="text-sm text-slate-500">
            Answers <em>"where is this shipment now, and where has it travelled?"</em> — an independent QR per shipment,
            separate from the package authentication QR.
          </p>
        </div>
      </div>

      {!shipments ? (
        <p className="mt-6 text-sm text-slate-400">Loading shipments…</p>
      ) : shipments.length === 0 ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No shipments yet — create one on the <strong>Dispatch</strong> page first, then generate its transport QR here.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          <div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Shipment</span>
              <select
                value={selectedCode}
                onChange={(e) => { setSelectedCode(e.target.value); setCopied(false); }}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {shipments.map((s) => (
                  <option key={s.shipmentId} value={s.shipmentId}>
                    {s.shipmentId} — {s.medicine} → {s.destination || 'destination N/A'}
                  </option>
                ))}
              </select>
            </label>

            {current && (
              <dl className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Shipment ID</dt>
                  <dd className="font-mono font-semibold text-slate-700">{current.shipmentId}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Medicine</dt>
                  <dd className="text-right font-medium text-slate-700">{current.medicine}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Batch</dt>
                  <dd className="font-mono text-slate-700">{current.batchNumber}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Current status</dt>
                  <dd className="font-semibold text-sky-700">{STATUS_LABELS[current.currentStatus] ?? current.currentStatus}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Current location</dt>
                  <dd className="text-right font-medium text-slate-700">{current.currentLocation || 'Not yet picked up'}</dd>
                </div>
              </dl>
            )}

            {current && !current.hasTransportQr && (
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                <QrCode size={15} aria-hidden="true" />
                {generating ? 'Generating…' : 'Generate Transport QR'}
              </button>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-5">
            {current?.hasTransportQr && payload ? (
              <>
                <QRCodeDisplay payload={payload} pixelSize={160} label={`Transport QR for shipment ${current.shipmentId}`} />
                <p className="max-w-xs text-center text-xs text-slate-500">
                  Print and stick this on the shipping box. Transporters scan it to update location; pharmacies and
                  customers scan it to see where the medicine has travelled.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button" onClick={() => void copyLink()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy tracking link'}
                  </button>
                  <a
                    href={`/transport/${current.transportQrId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <ExternalLink size={13} aria-hidden="true" /> Open tracking page
                  </a>
                </div>
              </>
            ) : current ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <MapPin size={32} className="text-sky-300" aria-hidden="true" />
                <p className="text-sm text-slate-500">This shipment has no transport QR yet.</p>
                <p className="text-xs text-slate-400">Generate one, then print it on the shipping box.</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
