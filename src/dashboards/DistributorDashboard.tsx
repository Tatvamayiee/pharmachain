import { useMemo } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardList, PackageCheck, AlertTriangle, Truck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { AreaChartCard } from '../components/ui/charts';
import Timeline from '../components/ui/Timeline';
import { SkeletonStats, ErrorState, SkeletonCard } from '../components/ui/states';
import { useFetch } from '../hooks/useFetch';
import { dataService } from '../services/dataService';
import { expiringBatches, medicineName, mockAuditLogs, mockStock, userName } from '../data/mockData';
import type { Shipment } from '../types';

function ShipmentList({ rows, loading, title, ariaLabel }: {
  rows: Shipment[]; loading: boolean; title: string; ariaLabel: string;
}) {
  return (
    <section aria-label={ariaLabel} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-slate-900">{title}</h2>
      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No shipments in this direction.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-slate-800">{s.id}</p>
                <p className="truncate text-xs text-slate-500">{medicineName(s.medicineId)} · {userName(s.senderId)} → {s.destination}</p>
              </div>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DistributorDashboard() {
  const shipmentsQ = useFetch<Shipment[]>(() => dataService.getShipments());
  const loading = shipmentsQ.loading;
  const shipments = shipmentsQ.data ?? [];

  const incoming = shipments.filter((s) => s.receiverId === 'u2' && !['DELIVERED', 'CANCELLED'].includes(s.status)).slice(0, 5);
  const outgoing = shipments.filter((s) => s.senderId === 'u2').slice(0, 5);

  const inventory = useMemo(
    () => mockStock.filter((s) => s.ownerId === 'u2' || s.ownerId === 'u1').slice(0, 6)
      .map((s) => ({ label: medicineName(s.medicineId).split(' ')[0], value: s.availableQuantity })),
    [],
  );

  const expiring = expiringBatches(90);

  const stats = [
    { icon: ArrowDownToLine, label: 'Incoming Shipments', value: incoming.length, tone: 'default' as const },
    { icon: Boxes, label: 'Total Inventory', value: mockStock.reduce((sum, s) => sum + s.availableQuantity, 0), tone: 'info' as const },
    { icon: ClipboardList, label: 'Pending Orders', value: 7, tone: 'warning' as const },
    { icon: ArrowUpFromLine, label: 'Outgoing Shipments', value: outgoing.length, tone: 'purple' as const },
    { icon: AlertTriangle, label: 'Low Stock Medicines', value: mockStock.filter((s) => s.availableQuantity < s.reorderLevel).length, tone: 'error' as const },
    { icon: PackageCheck, label: 'Expiring Batches (90d)', value: expiring.length, tone: 'warning' as const },
  ];

  const activity = useMemo(
    () => mockAuditLogs.slice(0, 5).map((a) => ({
      label: a.action.split('.').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: a.description,
      timestamp: new Date(a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      done: true,
    })),
    [],
  );

  if (shipmentsQ.error && !loading) return <ErrorState message={shipmentsQ.error} onRetry={shipmentsQ.retry} />;

  return (
    <>
      <PageHeader title="Distributor Dashboard" subtitle="Warehouse inventory, incoming stock and order fulfilment" crumbs={[{ label: 'Distributor' }, { label: 'Dashboard' }]} />

      {loading ? <SkeletonStats count={6} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={loading} />)}
        </div>
      )}

      <div className="mt-6">
        <AreaChartCard title="Inventory Overview" subtitle="Available units by medicine (top lines)" data={inventory} loading={loading} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ShipmentList rows={incoming} loading={loading} title="Incoming Shipments" ariaLabel="Incoming shipments" />
        <ShipmentList rows={outgoing} loading={loading} title="Outgoing Shipments" ariaLabel="Outgoing shipments" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-label="Expiry alerts" className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle size={17} aria-hidden="true" /> Expiry alerts (next 90 days)
          </h2>
          {expiring.length === 0 ? (
            <p className="text-sm text-amber-700">No batches expiring soon.</p>
          ) : (
            <ul className="space-y-2">
              {expiring.slice(0, 5).map((b) => {
                const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{medicineName(b.medicineId)}</p>
                      <p className="font-mono text-xs text-slate-400">{b.batchNumber}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {days <= 0 ? 'Expired' : `${days}d left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Recent activity" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">Recent activity</h2>
          <Timeline events={activity} />
        </section>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Truck size={13} aria-hidden="true" /> Accept or reject incoming shipments from the Incoming Shipments page.
      </p>
    </>
  );
}
