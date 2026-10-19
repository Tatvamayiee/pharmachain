import { useMemo, useState } from 'react';
import { Clock, MapPin, Navigation, Route, Truck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Timeline from '../../components/ui/Timeline';
import { SkeletonCard } from '../../components/ui/states';
import { useFetch } from '../../hooks/useFetch';
import { dataService } from '../../services/dataService';
import { medicineName, mockShipments } from '../../data/mockData';
import type { Shipment } from '../../types';

const STAGE_LABELS = ['Created', 'Packed', 'Dispatched', 'In Transit', 'At Distributor', 'Line-haul', 'At Dealer / Hospital', 'Delivered', 'Verified'];

const stageIndex = (status: Shipment['status']) =>
  ({ CREATED: 0, PACKED: 1, DISPATCHED: 2, IN_TRANSIT: 3, ASSIGNED_TO_DISTRIBUTOR: 4, ASSIGNED_TO_DEALER: 6, DELIVERED: 7, CANCELLED: -1 }[status] ?? 0);

export default function LiveTracking() {
  const { data, loading } = useFetch<Shipment[]>(() => dataService.getShipments());
  const active = useMemo(() => (data ?? []).filter((s) => !['DELIVERED', 'CANCELLED'].includes(s.status)), [data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = active.find((s) => s.id === (selectedId ?? active[0]?.id));

  const timeline = useMemo(() => {
    if (!selected) return [];
    const idx = stageIndex(selected.status);
    return STAGE_LABELS.map((label, i) => ({
      label,
      done: i <= idx,
      tone: i === idx ? ('info' as const) : ('success' as const),
    }));
  }, [selected]);

  return (
    <>
      <PageHeader
        title="Live Tracking"
        subtitle="Follow active shipments on their route in real time"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Live Tracking' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Shipment picker */}
        <section aria-label="Active shipments" className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="px-1 pb-2 pt-1 text-sm font-semibold text-slate-900">Active shipments ({active.length})</h2>
          {loading ? (
            <div className="space-y-2 p-1" role="status">{[0, 1, 2].map((i) => <SkeletonCard key={i} lines={1} />)}</div>
          ) : active.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No active shipments right now.</p>
          ) : (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto p-1">
              {active.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-pressed={selected?.id === s.id}
                    className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      selected?.id === s.id ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-xs font-semibold text-slate-800">{s.id}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{medicineName(s.medicineId)} → {s.destination}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Map + details */}
        <div className="space-y-5">
          <section aria-label="Shipment map" className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 shadow-sm">
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center sm:h-72">
              <MapPin size={36} className="text-indigo-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-500">Live route map</p>
              <p className="max-w-xs text-xs text-slate-400">
                {selected ? `${selected.route} — currently ${selected.status.split('_').join(' ').toLowerCase()}` : 'Select a shipment to preview its route'}
              </p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                <Navigation size={12} aria-hidden="true" /> Map integration ready
              </span>
            </div>
          </section>

          {selected && (
            <section aria-label="Shipment details" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900">{selected.id}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{medicineName(selected.medicineId)} · {selected.quantity.toLocaleString('en-IN')} units</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-2.5">
                  <Route size={16} className="mt-0.5 text-indigo-500" aria-hidden="true" />
                  <div><dt className="text-xs text-slate-400">Route</dt><dd className="text-sm font-medium text-slate-800">{selected.route}</dd></div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock size={16} className="mt-0.5 text-indigo-500" aria-hidden="true" />
                  <div><dt className="text-xs text-slate-400">Estimated delivery</dt><dd className="text-sm font-medium text-slate-800">{new Date(selected.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</dd></div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Truck size={16} className="mt-0.5 text-indigo-500" aria-hidden="true" />
                  <div><dt className="text-xs text-slate-400">Vehicle</dt><dd className="font-mono text-sm font-medium text-slate-800">{selected.trackingNumber}</dd></div>
                </div>
              </dl>

              <h3 className="mb-4 mt-6 font-semibold text-slate-900">Shipment progress</h3>
              <Timeline events={timeline} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

// Suppress unused import warning for mockShipments (kept for future checkpoint data).
void mockShipments;
