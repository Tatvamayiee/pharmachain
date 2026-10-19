import { useMemo } from 'react';
import { AlertTriangle, Hourglass } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { ExportButton } from '../../components/ui/inputs';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../contexts/ToastContext';
import { dataService } from '../../services/dataService';
import { exportCsv } from '../../services/exportService';
import { medicineName } from '../../data/mockData';
import type { Batch } from '../../types';

interface Row extends Record<string, unknown> {
  id: string; batchNumber: string; medicine: string; expiryDate: string;
  daysLeft: number; available: number; status: string;
}

export default function ExpiryMonitoring() {
  const { toast } = useToast();
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());

  const rows: Row[] = useMemo(() => {
    const bs = batchesQ.data ?? [];
    return bs.map((b) => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000);
      return {
        id: b.id, batchNumber: b.batchNumber, medicine: medicineName(b.medicineId),
        expiryDate: new Date(b.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        daysLeft: days, available: b.availableQuantity, status: b.status,
      };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
  }, [batchesQ.data]);

  const expiringSoon = rows.filter((r) => r.daysLeft > 0 && r.daysLeft <= 90);
  const expired = rows.filter((r) => r.daysLeft <= 0);

  const columns: Column<Row>[] = [
    { key: 'batchNumber', header: 'Batch', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.batchNumber}</span> },
    { key: 'medicine', header: 'Medicine', sortable: true },
    { key: 'expiryDate', header: 'Expiry Date', sortable: true },
    { key: 'daysLeft', header: 'Time Remaining', sortable: true, render: (r) => {
      if (r.daysLeft <= 0) return <span className="font-semibold text-red-600">Expired {Math.abs(r.daysLeft)}d ago</span>;
      if (r.daysLeft <= 30) return <span className="font-semibold text-amber-600">{r.daysLeft} days left</span>;
      if (r.daysLeft <= 90) return <span className="font-medium text-amber-500">{r.daysLeft} days left</span>;
      return <span className="text-slate-500">{r.daysLeft} days left</span>;
    }},
    { key: 'available', header: 'Units Left', render: (r) => r.available.toLocaleString('en-IN') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Expiry Monitoring"
        subtitle="Watch approaching expiries and quarantine expired stock"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Expiry Monitoring' }]}
        actions={<ExportButton onExport={() => exportCsv('expiry-report', ['Batch', 'Medicine', 'Expiry', 'Days Left', 'Units Left', 'Status'], rows.map((r) => [r.batchNumber, r.medicine, r.expiryDate, r.daysLeft, r.available, r.status]))} />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
          <Hourglass size={22} className="shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-amber-800">{expiringSoon.length}</p>
            <p className="text-xs text-amber-700">batches expiring within 90 days</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-4">
          <AlertTriangle size={22} className="shrink-0 text-red-500" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-red-700">{expired.length}</p>
            <p className="text-xs text-red-600">batches already expired — quarantine & recall</p>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sortKey="daysLeft" sortDir="asc" onSort={() => {}}
        loading={batchesQ.loading}
        emptyMessage="No batches to monitor"
        skeletonRows={6}
      />

      <button
        type="button" onClick={() => toast('Expiry alert thresholds configured (prototype).', 'info')}
        className="mt-4 text-sm font-semibold text-indigo-600 hover:underline"
      >
        Configure alert thresholds →
      </button>
    </>
  );
}
