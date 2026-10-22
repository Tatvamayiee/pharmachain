import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Package, Truck } from 'lucide-react';
import TopNavbar from '../../../shared/components/dashboard/TopNavbar';
import Sidebar from '../../../shared/components/dashboard/Sidebar';
import { StatCard } from '../../../shared/components/dashboard/StatCard';
import RecentShipments from '../../../shared/components/dashboard/RecentShipments';
import StockOverviewChart from '../../../shared/components/dashboard/StockOverviewChart';
import BatchDistributionChart from '../../../shared/components/dashboard/BatchDistributionChart';
import FloatingAssistantButton from '../../../shared/components/dashboard/FloatingAssistantButton';
import QRScannerModal from '../../../shared/components/dashboard/QRScannerModal';
import { getDB, Batch } from '../../../platform/database/db';
import {
  fetchManufacturerDashboardData,
  type ManufacturerDashboardData,
} from '../data/manufacturerData';

// Shared batch-loading hook used by BatchManagement, ProductRecall and
// StockMaintenance (kept exported here for backwards compatibility).
export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => { const db = await getDB(); setBatches(await db.getAll('batches')); })();
  }, [tick]);
  return { batches, refresh: () => setTick(t => t + 1) };
}

export default function ManufacturerDashboard() {
  const [data, setData] = useState<ManufacturerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isQrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchManufacturerDashboardData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard data. Please try again later.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    {
      icon: Package,
      label: 'Total Products',
      value: data?.stats.totalProducts ?? 0,
      trend: data?.stats.totalProductsTrend,
      iconClassName: 'bg-indigo-50',
      iconColorClassName: 'text-indigo-600',
    },
    {
      icon: Activity,
      label: 'Active Batches',
      value: data?.stats.activeBatches ?? 0,
      trend: data?.stats.activeBatchesTrend,
      iconClassName: 'bg-emerald-50',
      iconColorClassName: 'text-emerald-600',
    },
    {
      icon: AlertTriangle,
      label: 'Low Stock Items',
      value: data?.stats.lowStockItems ?? 0,
      trend: data?.stats.lowStockTrend,
      iconClassName: 'bg-orange-50',
      iconColorClassName: 'text-orange-500',
    },
    {
      icon: Truck,
      label: 'Pending Shipments',
      value: data?.stats.pendingShipments ?? 0,
      trend: data?.stats.pendingShipmentsTrend,
      iconClassName: 'bg-violet-50',
      iconColorClassName: 'text-violet-600',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F8FF] font-sans">
      <TopNavbar onMenuClick={() => setMobileMenuOpen(true)} onScanClick={() => setQrOpen(true)} />
      <Sidebar isMobileOpen={isMobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main content: left margin clears the fixed sidebar on desktop */}
      <main id="main" className="pt-16 lg:pl-[360px]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {/* Page header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Welcome back, tatva manufacturer — here's what's happening today.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:mb-8 xl:grid-cols-4">
            {stats.map((s) => (
              <StatCard key={s.label} {...s} loading={loading} />
            ))}
          </div>

          {/* Recent shipments */}
          <div className="mb-6 sm:mb-8">
            <RecentShipments shipments={data?.shipments ?? []} loading={loading} />
          </div>

          {/* Charts: two-column grid on desktop, stacked on tablet/mobile */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <StockOverviewChart data={data?.stock ?? []} loading={loading} />
            <BatchDistributionChart data={data?.batches ?? []} loading={loading} />
          </div>
        </div>
      </main>

      <FloatingAssistantButton />
      <QRScannerModal isOpen={isQrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}
