import { useMemo } from 'react';
import { AlertTriangle, Bell, Package, ShoppingCart, ShieldAlert, TrendingUp } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import StatCard from '../../../shared/components/ui/StatCard';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import { SkeletonStats, SkeletonCard, ErrorState } from '../../../shared/components/ui/states';
import { useFetch } from '../../../shared/hooks/useFetch';
import { dataService } from '../../../platform/data/dataService';
import { useAuth } from '../../../app/providers/AuthContext';
import { MEDICINE_BY_ID } from '../../../shared/data/mockData';
import type { Sale } from '../../../shared/types';

export default function DealerDashboard() {
  const { user } = useAuth();
  const salesQ = useFetch<Sale[]>(() => dataService.getSales());
  const stockQ = useFetch(() => dataService.getStock());
  const recallsQ = useFetch(() => dataService.getRecalls());
  const loading = salesQ.loading || stockQ.loading;
  const sales = salesQ.data ?? [];
  const stock = useMemo(() => stockQ.data ?? [], [stockQ.data]);

  // Server-backed stock is org-scoped (ownerId = organization name); mock
  // stock was scoped to demo user ids — show whichever data source responded.
  const myStock = useMemo(() => {
    if (!stock.length) return [];
    const orgMatch = user?.organization ? stock.filter((s) => s.ownerId === user.organization) : [];
    return orgMatch.length ? orgMatch : stock;
  }, [stock, user?.organization]);

  const todaySales = sales.filter((s) => new Date(s.timestamp).toDateString() === new Date().toDateString());
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const low = myStock.filter((s) => s.availableQuantity < s.reorderLevel);
  const expiring = myStock.filter((s) => {
    if (!s.expiryDate) return false;
    const days = (new Date(s.expiryDate).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days <= 90;
  });
  // REAL recall cases from /api/platform/recalls (recalled batches); the mock
  // list is only shown by dataService when the backend is unreachable.
  const recalls = useMemo(() => (recallsQ.data ?? []).filter((r) => r.status !== 'resolved'), [recallsQ.data]);
  // Match against this org's lots — the server recall's batchNumber is the
  // join key to the stock shape (Stock.batchId carries the batch NUMBER).
  const recalledInStock = useMemo(
    () => recalls.filter((r) => myStock.some((st) => st.batchId === (r.batchNumber ?? r.batchId))),
    [recalls, myStock],
  );

  const stats = [
    { icon: Package, label: 'Medicines in Stock', value: myStock.reduce((s, r) => s + r.availableQuantity, 0), tone: 'default' as const },
    { icon: TrendingUp, label: "Today's Sales", value: `₹${todayRevenue.toLocaleString('en-IN')}`, tone: 'success' as const },
    { icon: ShoppingCart, label: 'Pending Orders', value: 4, tone: 'purple' as const },
    { icon: AlertTriangle, label: 'Low Stock Items', value: low.length, tone: 'warning' as const },
    { icon: Bell, label: 'Expiring Medicines', value: expiring.length, tone: 'warning' as const },
    { icon: ShieldAlert, label: 'Recalled Items', value: recalledInStock.length, tone: 'error' as const },
  ];

  if (salesQ.error && !loading) return <ErrorState message={salesQ.error} onRetry={salesQ.retry} />;

  return (
    <>
      <PageHeader title="Pharmacy Dashboard" subtitle="Stock, sales, expiry and recall status at a glance" crumbs={[{ label: 'Dealer / Pharmacy' }, { label: 'Dashboard' }]} />

      {loading ? <SkeletonStats count={6} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={loading} />)}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Pharmacy stock */}
        <section aria-label="Pharmacy stock" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Pharmacy stock</h2>
          {loading ? <SkeletonCard /> : myStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No stock received yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {myStock.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{MEDICINE_BY_ID.get(s.medicineId)?.name ?? s.medicineId}</p>
                    <p className="truncate font-mono text-xs text-slate-400">{s.batchId} · {s.availableQuantity.toLocaleString('en-IN')} units</p>
                  </div>
                  <StatusBadge status={s.availableQuantity < s.reorderLevel ? 'expired' : 'active'} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent sales */}
        <section aria-label="Recent sales" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Recent sales</h2>
          {loading ? <SkeletonCard /> : sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No sales recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sales.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{MEDICINE_BY_ID.get(s.medicineId)?.name ?? s.medicineId}</p>
                    <p className="truncate text-xs text-slate-400">{s.customerName} · {s.quantity} units · {new Date(s.timestamp).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-600">₹{s.total.toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Warnings */}
        <section aria-label="Warnings" className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle size={17} aria-hidden="true" /> Low stock & expiry warnings
          </h2>
          <ul className="space-y-2 text-sm">
            {low.map((s) => (
              <li key={`low-${s.id}`} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 shadow-sm">
                <span className="text-slate-700">{MEDICINE_BY_ID.get(s.medicineId)?.name ?? s.medicineId}</span>
                <span className="text-xs font-bold text-red-600">{s.availableQuantity} left (reorder at {s.reorderLevel})</span>
              </li>
            ))}
            {expiring.map((s) => (
              <li key={`exp-${s.id}`} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 shadow-sm">
                <span className="text-slate-700">{MEDICINE_BY_ID.get(s.medicineId)?.name ?? s.medicineId}</span>
                <span className="text-xs font-bold text-amber-600">expires {Math.max(0, Math.ceil((new Date(s.expiryDate as string).getTime() - Date.now()) / 86_400_000))}d</span>
              </li>
            ))}
            {low.length === 0 && expiring.length === 0 && <li className="py-3 text-center text-slate-400">All good — nothing needs attention.</li>}
          </ul>
        </section>

        {/* Recall notifications */}
        <section aria-label="Recall notifications" className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
            <ShieldAlert size={17} aria-hidden="true" /> Recall notifications
          </h2>
          {recalls.length === 0 ? (
            <p className="text-sm text-red-700">No active recalls.</p>
          ) : (
            <ul className="space-y-2">
              {recalls.map((r) => (
                <li key={r.id} className="rounded-xl bg-white px-3.5 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">{r.medicineName || 'Batch'} — <span className="font-mono text-xs">{r.batchNumber || r.batchId}</span></p>
                  <p className="mt-0.5 text-xs text-red-700">{r.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
