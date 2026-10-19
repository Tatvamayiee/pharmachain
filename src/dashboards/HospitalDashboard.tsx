import { useMemo } from 'react';
import { Activity, AlertTriangle, Building2, FileText, PackageCheck, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { BarChartCard } from '../components/ui/charts';
import { SkeletonStats, SkeletonCard } from '../components/ui/states';
import { useFetch } from '../hooks/useFetch';
import { dataService } from '../services/dataService';
import { MEDICINE_BY_ID, medicineName, mockBatches, mockRecalls, mockShipments } from '../data/mockData';

const REQUESTS = [
  { id: 'rq1', medicine: 'Paracetamol 500 mg', quantity: 2000, department: 'Emergency', priority: 'emergency' as const, date: 'in 2 days', status: 'pending' as const },
  { id: 'rq2', medicine: 'Amoxicillin 500 mg', quantity: 800, department: 'General Ward', priority: 'important' as const, date: 'in 5 days', status: 'pending' as const },
  { id: 'rq3', medicine: 'Omeprazole 20 mg', quantity: 600, department: 'ICU', priority: 'normal' as const, date: 'in 10 days', status: 'approved' as const },
  { id: 'rq4', medicine: 'Insulin Glargine', quantity: 150, department: 'Oncology', priority: 'emergency' as const, date: 'tomorrow', status: 'pending' as const },
];

const DEPARTMENTS = [
  { name: 'Emergency', usage: 4200 }, { name: 'ICU', usage: 3600 }, { name: 'General Ward', usage: 2800 },
  { name: 'Oncology', usage: 1900 }, { name: 'Pediatrics', usage: 1500 },
];

export default function HospitalDashboard() {
  const stockQ = useFetch(() => dataService.getStock());
  const loading = stockQ.loading;
  const stock = stockQ.data ?? [];

  // Server-backed inventory lots (real, org-scoped) when available; otherwise
  // the prototype demo rows.
  const hospitalStock = useMemo(() => (stock.length ? stock : mockBatches.slice(0, 5)), [stock]);
  const received = mockShipments.filter((s) => s.status === 'DELIVERED').slice(0, 4);
  const expiring = stock.filter((s) => {
    if (!s.expiryDate) return false;
    const days = (new Date(s.expiryDate).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days <= 90;
  });
  const recalls = mockRecalls.filter((r) => r.status !== 'resolved');

  const stats = [
    { icon: Activity, label: 'Total Medicines', value: hospitalStock.length, tone: 'default' as const },
    { icon: Building2, label: 'Available Stock (units)', value: stock.reduce((s, r) => s + r.availableQuantity, 0), tone: 'info' as const },
    { icon: FileText, label: 'Pending Requests', value: REQUESTS.filter((r) => r.status === 'pending').length, tone: 'purple' as const, linkTo: '/hospital/request' },
    { icon: AlertTriangle, label: 'Critical Low Stock', value: stock.filter((s) => s.availableQuantity < s.reorderLevel).length, tone: 'warning' as const },
    { icon: AlertTriangle, label: 'Expiring (90d)', value: expiring.length, tone: 'warning' as const },
    { icon: PackageCheck, label: 'Received Shipments', value: received.length, tone: 'success' as const },
  ];

  return (
    <>
      <PageHeader title="Hospital Dashboard" subtitle="Inventory, requests, department usage and safety alerts" crumbs={[{ label: 'Hospital' }, { label: 'Dashboard' }]} />

      {loading ? <SkeletonStats count={6} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={loading} />)}
        </div>
      )}

      <div className="mt-6">
        <BarChartCard
          title="Department Usage"
          subtitle="Units consumed by department this month"
          data={DEPARTMENTS.map((d) => ({ label: d.name, value: d.usage }))}
          loading={loading}
          color="#7c3aed"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-label="Pending medicine requests" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Pending medicine requests</h2>
          {loading ? <SkeletonCard /> : (
            <ul className="divide-y divide-slate-100">
              {REQUESTS.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{r.medicine}</p>
                    <p className="text-xs text-slate-400">{r.department} · {r.quantity.toLocaleString('en-IN')} units · needed {r.date}</p>
                  </div>
                  <StatusBadge status={r.priority} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Received shipments" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Recent received shipments</h2>
          {loading ? <SkeletonCard /> : (
            <ul className="divide-y divide-slate-100">
              {received.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-slate-800">{s.id}</p>
                    <p className="truncate text-xs text-slate-400">{medicineName(s.medicineId)} · {s.quantity.toLocaleString('en-IN')} units</p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Expiry alerts" className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle size={17} aria-hidden="true" /> Expiry alerts
          </h2>
          <ul className="space-y-2 text-sm">
            {expiring.slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 shadow-sm">
                <span className="truncate text-slate-700">{MEDICINE_BY_ID.get(b.medicineId)?.name ?? b.medicineId}</span>
                <span className="shrink-0 text-xs font-bold text-amber-600">{Math.max(0, Math.ceil((new Date(b.expiryDate as string).getTime() - Date.now()) / 86_400_000))}d left</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Recall alerts" className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
            <ShieldAlert size={17} aria-hidden="true" /> Recalled medicine alerts
          </h2>
          {recalls.length === 0 ? <p className="text-sm text-red-700">No active recalls.</p> : (
            <ul className="space-y-2">
              {recalls.map((r) => (
                <li key={r.id} className="rounded-xl bg-white px-3.5 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">{r.reason}</p>
                  <p className="mt-0.5 text-xs text-red-700">Severity: {r.severity} · {r.affectedQuantity.toLocaleString('en-IN')} units affected</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
