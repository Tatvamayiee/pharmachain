import { useMemo } from 'react';
import {
  Activity, AlertTriangle, Boxes, Package, PackageX, Syringe, TrendingDown, Truck,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { BarChartCard, DonutChartCard } from '../components/ui/charts';
import Timeline from '../components/ui/Timeline';
import DataTable, { type Column } from '../components/ui/DataTable';
import { ErrorState, SkeletonCard } from '../components/ui/states';
import { useFetch } from '../hooks/useFetch';
import { dataService } from '../services/dataService';
import { medicineName, mockAuditLogs, mockBatches, mockStock } from '../data/mockData';
import type { Batch, Shipment } from '../types';

interface LowStockRow extends Record<string, unknown> {
  id: string; medicine: string; batchNumber: string; available: number; reorderLevel: number;
  status: string; medicineId: string;
}

const LOW_COLUMNS: Column<LowStockRow>[] = [
  { key: 'medicine', header: 'Medicine', render: (r) => <span className="font-medium text-slate-800">{r.medicine}</span> },
  { key: 'batchNumber', header: 'Batch', render: (r) => <span className="font-mono text-xs">{r.batchNumber}</span> },
  { key: 'available', header: 'Current Stock', sortable: true, render: (r) => <span className="font-semibold text-red-600">{r.available.toLocaleString('en-IN')}</span> },
  { key: 'reorderLevel', header: 'Reorder Level', render: (r) => r.reorderLevel.toLocaleString('en-IN') },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.available === 0 ? 'depleted' : 'active'} /> },
  {
    key: 'actions', header: 'Action', hideOnMobile: true,
    render: () => (
      <a href="#reorder" className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100">
        <TrendingDown size={12} aria-hidden="true" /> Reorder
      </a>
    ),
  },
];

export default function ManufacturerDashboard() {
  const shipmentsQ = useFetch<Shipment[]>(() => dataService.getShipments());
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());
  const loading = shipmentsQ.loading || batchesQ.loading;
  const error = shipmentsQ.error ?? batchesQ.error;
  const retry = () => { shipmentsQ.retry(); batchesQ.retry(); };

  const batches = batchesQ.data ?? mockBatches;
  const shipments = (shipmentsQ.data ?? []).slice(0, 6);

  const stockOverview = useMemo(() => {
    const low = mockStock.filter((s) => s.availableQuantity < s.reorderLevel).length;
    const out = mockStock.filter((s) => s.availableQuantity === 0).length;
    const total = mockStock.reduce((sum, s) => sum + s.availableQuantity, 0);
    return [
      { label: 'Total Stock', value: total },
      { label: 'Low Stock', value: low },
      { label: 'Out of Stock', value: out },
    ];
  }, []);

  const batchDist = useMemo(() => {
    const count = (s: Batch['status']) => batches.filter((b) => b.status === s).length;
    return [
      { label: 'Active', value: count('active') },
      { label: 'Expired', value: count('expired') },
      { label: 'Recalled', value: count('recalled') },
      { label: 'Depleted', value: count('depleted') },
    ];
  }, [batches]);

  const stats = useMemo(() => {
    const medicines = new Set(batches.map((b) => b.medicineId)).size;
    const lowStock = mockStock.filter((s) => s.availableQuantity < s.reorderLevel).length;
    const pending = (shipmentsQ.data ?? []).filter((s) =>
      ['CREATED', 'PACKED', 'DISPATCHED'].includes(s.status)).length;
    const recalled = batches.filter((b) => b.status === 'recalled').length;
    const totalUnits = mockStock.reduce((sum, s) => sum + s.availableQuantity, 0);
    return [
      { icon: Package, label: 'Total Medicines', value: medicines, trend: 6.8, tone: 'default' as const, linkTo: '/manufacturer/medicines' },
      { icon: Activity, label: 'Active Batches', value: batches.filter((b) => b.status === 'active').length, trend: 4.2, tone: 'success' as const, linkTo: '/manufacturer/batches' },
      { icon: Boxes, label: 'Total Stock', value: totalUnits, tone: 'info' as const },
      { icon: AlertTriangle, label: 'Low Stock Items', value: lowStock, trend: 12.5, tone: 'warning' as const, linkTo: '/manufacturer/stock' },
      { icon: Truck, label: 'Pending Shipments', value: pending, tone: 'purple' as const, linkTo: '/manufacturer/dispatch' },
      { icon: PackageX, label: 'Recalled Batches', value: recalled, tone: 'error' as const, linkTo: '/manufacturer/recalls' },
    ];
  }, [batches, shipmentsQ.data]);

  const activity = useMemo(
    () => mockAuditLogs.slice(0, 5).map((a) => ({
      label: a.action.split('.').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: a.description,
      timestamp: new Date(a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      done: true,
      tone: a.action.includes('recall') ? ('error' as const) : a.action.includes('verify') ? ('info' as const) : ('success' as const),
    })),
    [],
  );

  const lowRows: LowStockRow[] = useMemo(
    () => mockStock
      .filter((s) => s.availableQuantity < s.reorderLevel)
      .map((s) => ({
        id: s.id, medicine: medicineName(s.medicineId),
        batchNumber: mockBatches.find((b) => b.id === s.batchId)?.batchNumber ?? '—',
        available: s.availableQuantity, reorderLevel: s.reorderLevel,
        status: s.availableQuantity === 0 ? 'depleted' : 'active',
        medicineId: s.medicineId,
      })),
    [],
  );

  if (error && !loading) return <ErrorState message={error} onRetry={retry} />;

  return (
    <>
      <PageHeader
        title="Manufacturer Dashboard"
        subtitle="Monitor production, stock, batches, and shipments"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Dashboard' }]}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} loading={loading} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <BarChartCard
          title="Stock Overview"
          subtitle="Total stock, low stock and out-of-stock items"
          data={stockOverview}
          loading={loading}
          emptyMessage="No stock records available yet."
        />
        <DonutChartCard
          title="Batch Distribution"
          subtitle="Active vs Expired vs Recalled vs Depleted"
          data={batchDist}
          loading={loading}
          colors={{ Active: '#4f46e5', Expired: '#f59e0b', Recalled: '#dc2626', Depleted: '#94a3b8' }}
          emptyMessage="No batches created yet. Batches will appear here after production."
        />
      </div>

      {/* Recent shipments */}
      <section aria-label="Recent Shipments" className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Shipments</h2>
          <a href="/manufacturer/dispatch" className="text-sm font-semibold text-indigo-600 hover:underline">View all →</a>
        </div>
        {loading ? (
          <SkeletonCard />
        ) : shipments.length === 0 ? (
          <SkeletonCard />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
            {shipments.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-4 transition-colors hover:bg-indigo-50/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600" aria-hidden="true">
                    <Truck size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-slate-800">{s.id}</p>
                    <p className="truncate text-xs text-slate-500">{s.destination} · {s.route}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-700">{medicineName(s.medicineId)}</p>
                    <p className="text-[11px] text-slate-400">{s.quantity.toLocaleString('en-IN')} units · {new Date(s.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Recent batch activity */}
        <section aria-label="Recent Batch Activity" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Recent Batch Activity</h2>
          {loading ? (
            <div className="space-y-4" role="status" aria-label="Loading activity">
              {[0, 1, 2].map((i) => <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-100" />)}
            </div>
          ) : (
            <Timeline events={activity} />
          )}
        </section>

        {/* Low stock */}
        <section aria-label="Low Stock Medicines">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Low Stock Medicines</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <Syringe size={12} aria-hidden="true" /> {lowRows.length} below reorder
            </span>
          </div>
          <DataTable
            columns={LOW_COLUMNS}
            rows={lowRows}
            rowKey={(r) => r.id}
            loading={loading}
            emptyMessage="No low-stock items — all medicines are above reorder level."
            skeletonRows={3}
          />
        </section>
      </div>
    </>
  );
}
