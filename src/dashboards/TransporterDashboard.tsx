import { Truck, MapPin, PackageSearch, CheckCircle2, ScanLine, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { SkeletonStats, SkeletonCard, ErrorState } from '../components/ui/states';
import { useFetch } from '../hooks/useFetch';
import { api } from '../lib/api';
import { TRANSPORT_STATUS_LABELS, nextTransportStatus } from '../lib/transportStatus';

/**
 * Transporter dashboard (role: transport) — QR 2 focus: where are my
 * shipments now, and which one needs the next scan/update. All data comes
 * from the real /api/transport/shipments endpoint; no placeholder rows.
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

export default function TransporterDashboard() {
  const q = useFetch<TransportShipment[]>(async () => {
    const res = await api<{ shipments: TransportShipment[] }>('/api/transport/shipments');
    return res.shipments;
  });
  const shipments = q.data ?? [];

  const active = shipments.filter((s) => !s.delivered);
  const inTransit = active.filter((s) => ['PICKED_UP', 'IN_TRANSIT', 'AT_DISTRIBUTION_CENTER', 'OUT_FOR_DELIVERY'].includes(s.currentStatus));
  const needsUpdate = active.filter((s) => !s.currentLocation);
  const delivered = shipments.filter((s) => s.delivered);

  const stats = [
    { icon: Truck, label: 'Active Shipments', value: active.length, tone: 'default' as const },
    { icon: MapPin, label: 'In Transit', value: inTransit.length, tone: 'info' as const },
    { icon: PackageSearch, label: 'Awaiting Location Update', value: needsUpdate.length, tone: 'warning' as const },
    { icon: CheckCircle2, label: 'Delivered', value: delivered.length, tone: 'success' as const },
  ];

  if (q.error && !q.loading) return <ErrorState message={q.error} onRetry={q.retry} />;

  return (
    <>
      <PageHeader
        title="Transporter Dashboard"
        subtitle="Scan a transport QR on a shipment box to update its location and status"
        crumbs={[{ label: 'Transporter' }, { label: 'Dashboard' }]}
      />

      {q.loading ? <SkeletonStats count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={q.loading} />)}
        </div>
      )}

      {/* Primary action */}
      <div className="mt-6">
        <Link
          to="/transporter/scan"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 sm:w-auto"
        >
          <ScanLine size={18} aria-hidden="true" /> Scan Transport QR
        </Link>
        <p className="mt-2 text-xs text-slate-400">
          Opens the camera scanner — point it at the transport QR printed on the shipping box. You can also open a
          shipment directly from the list below.
        </p>
      </div>

      {/* Shipment list */}
      <section aria-label="Authorized shipments" className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Shipments</h2>
        {q.loading ? <SkeletonCard /> : shipments.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No authorized shipments available.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Shipment</th>
                  <th className="py-2 pr-3 font-semibold">Medicine</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Current location</th>
                  <th className="py-2 pr-3 font-semibold">Last update</th>
                  <th className="py-2 font-semibold">Next action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shipments.map((s) => {
                  const next = nextTransportStatus(s.currentStatus);
                  return (
                    <tr key={s.shipmentId} className="align-top">
                      <td className="py-3 pr-3">
                        <Link
                          to={`/transport/${encodeURIComponent(s.transportQrId)}`}
                          className="font-mono text-xs font-semibold text-sky-700 hover:underline"
                        >
                          {s.shipmentId}
                        </Link>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="max-w-[220px] truncate font-medium text-slate-800">{s.medicine}</p>
                        <p className="font-mono text-[11px] text-slate-400">{s.batchNumber}</p>
                      </td>
                      <td className="py-3 pr-3"><StatusBadge status={s.currentStatus} /></td>
                      <td className="py-3 pr-3 text-slate-600">{s.currentLocation || <span className="text-slate-400">Not yet picked up</span>}</td>
                      <td className="py-3 pr-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden="true" />{new Date(s.lastUpdated).toLocaleString('en-IN')}</span>
                      </td>
                      <td className="py-3 text-xs font-medium text-slate-600">
                        {s.delivered ? 'None — delivered' : next ? TRANSPORT_STATUS_LABELS[next] : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
