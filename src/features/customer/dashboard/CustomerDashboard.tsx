import { Link } from 'react-router-dom';
import { BadgeCheck, Bell, Heart, Megaphone, ScanLine, ShoppingBag, Truck } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import StatCard from '../../../shared/components/ui/StatCard';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import { SkeletonStats, SkeletonCard } from '../../../shared/components/ui/states';
import { useFetch } from '../../../shared/hooks/useFetch';
import { dataService } from '../../../platform/data/dataService';
import { mockVerifications, userName } from '../../../shared/data/mockData';

const MY_ORDERS = [
  { id: 'ORD-50231', medicine: 'Paracetamol 500 mg', qty: 2, status: 'IN_TRANSIT', eta: 'Tomorrow' },
  { id: 'ORD-50198', medicine: 'Cetirizine 10 mg', qty: 1, status: 'DELIVERED', eta: 'Delivered 12 Mar' },
  { id: 'ORD-50154', medicine: 'Omeprazole 20 mg', qty: 3, status: 'ASSIGNED_TO_DEALER', eta: 'In 3 days' },
];

const SAVED = ['Paracetamol 500 mg', 'Vitamin D3 Tablets', 'Cetirizine 10 mg'];

export default function CustomerDashboard() {
  const verificationsQ = useFetch(() => dataService.getVerifications());
  const loading = verificationsQ.loading;
  const verifications = (verificationsQ.data ?? mockVerifications).filter((v) => v.verifiedBy === 'u5');

  const activeOrders = MY_ORDERS.filter((o) => o.status !== 'DELIVERED');
  const recallAlerts = 1;

  const stats = [
    { icon: BadgeCheck, label: 'Medicines Verified', value: 14, tone: 'success' as const },
    { icon: ShoppingBag, label: 'Active Orders', value: activeOrders.length, tone: 'purple' as const, linkTo: '/customer/orders' },
    { icon: Truck, label: 'Delivered Orders', value: 11, tone: 'default' as const },
    { icon: Heart, label: 'Saved Medicines', value: SAVED.length, tone: 'info' as const, linkTo: '/customer/saved' },
    { icon: Bell, label: 'Recall Alerts', value: recallAlerts, tone: 'error' as const, linkTo: '/customer/recalls' },
  ];

  return (
    <>
      <PageHeader title="Customer Dashboard" subtitle="Verify medicines, track orders and stay safe" crumbs={[{ label: 'Customer' }, { label: 'Dashboard' }]} />

      {loading ? <SkeletonStats count={5} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={loading} />)}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* Quick verify */}
        <section aria-label="Quick QR verification" className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Verify a medicine now</h2>
          <p className="mt-1 text-sm text-slate-500">Scan the QR on the pack or type the batch number.</p>
          <span className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md" aria-hidden="true">
            <ScanLine size={40} />
          </span>
          <div className="mt-5 space-y-2">
            <Link to="/customer/scan" className="block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90">
              Scan Medicine QR
            </Link>
            <Link to="/customer/verify" className="block rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50">
              Enter batch number
            </Link>
          </div>
        </section>

        <div className="space-y-5">
          {/* Verification history */}
          <section aria-label="Recent verification history" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Recent verification history</h2>
            {loading ? <SkeletonCard /> : verifications.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No verifications yet — scan your first pack!</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {verifications.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-slate-800">{v.qrCode}</p>
                      <p className="text-xs text-slate-400">{v.location} · {new Date(v.timestamp).toLocaleDateString('en-IN')}</p>
                    </div>
                    <StatusBadge status={v.result} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Orders */}
          <section aria-label="Current orders" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Current orders</h2>
            <ul className="divide-y divide-slate-100">
              {MY_ORDERS.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-slate-800">{o.id}</p>
                    <p className="truncate text-xs text-slate-500">{o.medicine} · {o.qty} pack{Number(o.qty) > 1 ? 's' : ''} · ETA {o.eta}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Saved medicines */}
        <section aria-label="Saved medicines" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Heart size={16} className="text-rose-500" aria-hidden="true" /> Saved medicines
          </h2>
          <ul className="flex flex-wrap gap-2">
            {SAVED.map((m) => (
              <li key={m} className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-700">{m}</li>
            ))}
          </ul>
        </section>

        {/* Safety alert */}
        <section aria-label="Safety alerts" className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-900">
            <Megaphone size={16} aria-hidden="true" /> Safety alerts
          </h2>
          <p className="text-sm text-red-800">
            Ibuprofen 400 mg batch <span className="font-mono">IBU-2412-J</span> has been recalled.
            Check your medicine cabinet and return any packs from this batch to your pharmacy.
          </p>
          <Link to="/customer/recalls" className="mt-3 inline-block text-sm font-semibold text-red-700 hover:underline">
            View all recall alerts →
          </Link>
        </section>
      </div>
    </>
  );
}

// Keep referenced imports used.
void userName;
