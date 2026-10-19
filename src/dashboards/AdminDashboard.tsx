import { useMemo } from 'react';
import { Building2, Factory, History, PackageSearch, Pill, ShieldAlert, Truck, UserCheck, Users } from 'lucide-react';
import { userName } from '../data/mockData';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { AreaChartCard, DonutChartCard } from '../components/ui/charts';
import Timeline from '../components/ui/Timeline';
import { SkeletonStats, ErrorState } from '../components/ui/states';
import { useFetch } from '../hooks/useFetch';
import { dataService } from '../services/dataService';
import { medicineName, mockAuditLogs, mockBatches, mockRecalls, mockUsers, mockVerifications } from '../data/mockData';
import type { QRVerification } from '../types';

export default function AdminDashboard() {
  const verificationsQ = useFetch<QRVerification[]>(() => dataService.getVerifications());
  const loading = verificationsQ.loading;

  const users = mockUsers;
  const stats = [
    { icon: Users, label: 'Total Users', value: users.length, trend: 9.1, tone: 'default' as const, linkTo: '/admin/users' },
    { icon: Factory, label: 'Manufacturers', value: users.filter((u) => u.role === 'manufacturer').length, tone: 'info' as const },
    { icon: Truck, label: 'Active Distributors', value: users.filter((u) => u.role === 'distributor' && u.status === 'active').length, tone: 'purple' as const },
    { icon: Building2, label: 'Registered Dealers', value: users.filter((u) => u.role === 'dealer').length, tone: 'default' as const },
    { icon: UserCheck, label: 'Registered Hospitals', value: users.filter((u) => u.role === 'hospital').length, tone: 'success' as const },
    { icon: Pill, label: 'Total Medicines', value: 8, tone: 'info' as const, linkTo: '/admin/medicines' },
    { icon: PackageSearch, label: 'Active Batches', value: mockBatches.filter((b) => b.status === 'active').length, tone: 'success' as const, linkTo: '/admin/batches' },
    { icon: ShieldAlert, label: 'Open Recall Cases', value: mockRecalls.filter((r) => r.status !== 'resolved').length, tone: 'error' as const, linkTo: '/admin/recalls' },
  ];

  const activity = useMemo(() => [
    { label: 'Mon', value: 34 }, { label: 'Tue', value: 52 }, { label: 'Wed', value: 41 },
    { label: 'Thu', value: 66 }, { label: 'Fri', value: 58 }, { label: 'Sat', value: 30 }, { label: 'Sun', value: 22 },
  ], []);

  const userDist = useMemo(() => {
    const roles = ['manufacturer', 'distributor', 'dealer', 'hospital', 'customer', 'admin'] as const;
    return roles.map((r) => ({ label: r.charAt(0).toUpperCase() + r.slice(1), value: users.filter((u) => u.role === r).length }));
  }, [users]);

  const batchStatus = useMemo(() => [
    { label: 'Active', value: mockBatches.filter((b) => b.status === 'active').length },
    { label: 'Expired', value: mockBatches.filter((b) => b.status === 'expired').length },
    { label: 'Recalled', value: mockBatches.filter((b) => b.status === 'recalled').length },
    { label: 'Depleted', value: mockBatches.filter((b) => b.status === 'depleted').length },
  ], []);

  const audit = useMemo(
    () => mockAuditLogs.slice(0, 5).map((a) => ({
      label: a.action,
      description: `${a.description} · ${userName(a.userId)}`,
      timestamp: new Date(a.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      done: true,
      tone: a.action.includes('suspend') || a.action.includes('recall') ? ('error' as const) : ('success' as const),
    })),
    [],
  );

  if (verificationsQ.error && !loading) return <ErrorState message={verificationsQ.error} onRetry={verificationsQ.retry} />;

  const recentVerifications = (verificationsQ.data ?? mockVerifications).slice(0, 5);

  return (
    <>
      <PageHeader title="Administrator Dashboard" subtitle="Ecosystem oversight — users, batches, recalls and compliance" crumbs={[{ label: 'Administrator' }, { label: 'Dashboard' }]} />

      {loading ? <SkeletonStats count={8} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => <StatCard key={s.label} {...s} loading={loading} />)}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <AreaChartCard title="Supply-chain Activity" subtitle="Verifications & shipments this week" data={activity} loading={loading} />
        <DonutChartCard
          title="User Distribution" subtitle="Users by role"
          data={userDist} loading={loading}
          colors={{ Manufacturer: '#4f46e5', Distributor: '#7c3aed', Dealer: '#0891b2', Hospital: '#16a34a', Customer: '#f59e0b', Admin: '#64748b' }}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <DonutChartCard
          title="Batch Status" subtitle="Registry health"
          data={batchStatus} loading={loading}
          colors={{ Active: '#4f46e5', Expired: '#f59e0b', Recalled: '#dc2626', Depleted: '#94a3b8' }}
        />

        <section aria-label="Recent QR verification activity" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-900">Recent QR verifications</h2>
          <ul className="divide-y divide-slate-100">
            {recentVerifications.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-slate-800">{v.qrCode}</p>
                  <p className="truncate text-xs text-slate-400">{v.location} · {new Date(v.timestamp).toLocaleDateString('en-IN')}</p>
                </div>
                <StatusBadge status={v.result} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-label="Recall cases" className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
            <ShieldAlert size={17} aria-hidden="true" /> Recall cases
          </h2>
          <ul className="space-y-2">
            {mockRecalls.map((r) => {
              const b = mockBatches.find((x) => x.id === r.batchId);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{b ? medicineName(b.medicineId) : '—'} <span className="font-mono text-xs text-slate-400">{b?.batchNumber}</span></p>
                    <p className="truncate text-xs text-red-700">{r.reason}</p>
                  </div>
                  <StatusBadge status={r.severity === 'critical' ? 'recalled' : 'expired'} pretty={false} />
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Audit activity" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <History size={17} aria-hidden="true" /> Audit activity
          </h2>
          <Timeline events={audit} />
        </section>
      </div>
    </>
  );
}
