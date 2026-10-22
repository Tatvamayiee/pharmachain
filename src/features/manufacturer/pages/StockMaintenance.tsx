import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, PackageOpen, RotateCcw, AlertTriangle } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import DataTable, { type Column } from '../../../shared/components/ui/DataTable';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import { SearchInput, FilterDropdown, ExportButton, Pagination } from '../../../shared/components/ui/inputs';
import { ErrorState } from '../../../shared/components/ui/states';
import { useFetch } from '../../../shared/hooks/useFetch';
import { useTableControls } from '../../../shared/hooks/useSearchSort';
import { dataService } from '../../../platform/data/dataService';
import { exportCsv } from '../../../shared/services/exportService';
import { BATCH_BY_ID, medicineName, userName } from '../../../shared/data/mockData';
import type { Stock } from '../../../shared/types';

interface Row extends Record<string, unknown> {
  id: string; owner: string; medicine: string; batch: string; opening: number; received: number;
  dispatched: number; damaged: number; available: number; reorderLevel: number; status: string;
}

export default function StockMaintenance() {
  const stockQ = useFetch<Stock[]>(() => dataService.getStock());
  const [state, setState] = useState('all');

  const rows: Row[] = useMemo(() => {
    const list = stockQ.data ?? [];
    return list.map((s) => ({
      id: s.id,
      owner: userName(s.ownerId),
      medicine: medicineName(s.medicineId),
      batch: BATCH_BY_ID.get(s.batchId)?.batchNumber ?? '—',
      opening: s.openingQuantity, received: s.receivedQuantity, dispatched: s.dispatchedQuantity,
      damaged: s.damagedQuantity, available: s.availableQuantity, reorderLevel: s.reorderLevel,
      status: s.availableQuantity === 0 ? 'depleted' : s.availableQuantity < s.reorderLevel ? 'recalled' : 'active',
    }));
  }, [stockQ.data]);

  const filtered = useMemo(() => {
    if (state === 'low') return rows.filter((r) => r.available > 0 && r.available < r.reorderLevel);
    if (state === 'out') return rows.filter((r) => r.available === 0);
    if (state === 'healthy') return rows.filter((r) => r.available >= r.reorderLevel);
    return rows;
  }, [rows, state]);

  const tc = useTableControls<Row>(filtered, ['medicine', 'batch', 'owner']);

  const totals = useMemo(() => ({
    inward: rows.reduce((s, r) => s + r.received, 0),
    outward: rows.reduce((s, r) => s + r.dispatched, 0),
    damaged: rows.reduce((s, r) => s + r.damaged, 0),
    returned: 340,
  }), [rows]);

  const chips = [
    { icon: ArrowDownToLine, label: 'Inward', value: totals.inward, cls: 'bg-emerald-50 text-emerald-700' },
    { icon: ArrowUpFromLine, label: 'Outward', value: totals.outward, cls: 'bg-indigo-50 text-indigo-700' },
    { icon: PackageOpen, label: 'Damaged', value: totals.damaged, cls: 'bg-red-50 text-red-700' },
    { icon: RotateCcw, label: 'Returned', value: totals.returned, cls: 'bg-amber-50 text-amber-700' },
  ];

  const columns: Column<Row>[] = [
    { key: 'medicine', header: 'Medicine', sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-slate-800">{r.medicine}</p>
        <p className="text-xs text-slate-400">{r.owner}</p>
      </div>
    )},
    { key: 'batch', header: 'Batch', sortable: true, render: (r) => <span className="font-mono text-xs">{r.batch}</span> },
    { key: 'opening', header: 'Opening', sortable: true, hideOnMobile: true },
    { key: 'received', header: 'Received', sortable: true, hideOnMobile: true, render: (r) => r.received.toLocaleString('en-IN') },
    { key: 'dispatched', header: 'Dispatched', sortable: true, hideOnMobile: true, render: (r) => r.dispatched.toLocaleString('en-IN') },
    { key: 'damaged', header: 'Damaged', hideOnMobile: true, render: (r) => (r.damaged > 0 ? <span className="text-red-600">{r.damaged}</span> : r.damaged) },
    { key: 'available', header: 'Available', sortable: true, render: (r) => (
      <span className={`font-semibold ${r.available === 0 ? 'text-slate-400' : r.available < r.reorderLevel ? 'text-red-600' : 'text-slate-800'}`}>
        {r.available.toLocaleString('en-IN')}
      </span>
    )},
    { key: 'reorderLevel', header: 'Reorder', hideOnMobile: true },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (stockQ.error && !stockQ.loading) return <ErrorState message={stockQ.error} onRetry={stockQ.retry} />;

  return (
    <>
      <PageHeader
        title="Stock Maintenance"
        subtitle="Track inward, outward, damaged and returned stock with reorder-level alerts"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Stock Maintenance' }]}
        actions={<ExportButton onExport={() => exportCsv('stock', ['Medicine', 'Batch', 'Owner', 'Opening', 'Received', 'Dispatched', 'Damaged', 'Available', 'Reorder'], filtered.map((r) => [r.medicine, r.batch, r.owner, r.opening, r.received, r.dispatched, r.damaged, r.available, r.reorderLevel]))} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chips.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.cls}`} aria-hidden="true"><c.icon size={18} /></span>
            <div>
              <p className="text-lg font-bold text-slate-900">{c.value.toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-500">{c.label} units</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={tc.query} onChange={(v) => { tc.setQuery(v); tc.setPage(1); }} placeholder="Search medicine or batch…" label="Search stock" />
        <FilterDropdown label="View" value={state} onChange={(v) => { setState(v); tc.setPage(1); }}
          options={[
            { value: 'all', label: 'All stock' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
            { value: 'healthy', label: 'Healthy' },
          ]} />
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
          <AlertTriangle size={13} aria-hidden="true" /> {rows.filter((r) => r.available < r.reorderLevel).length} below reorder level
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={tc.paged}
        rowKey={(r) => r.id}
        sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
        loading={stockQ.loading}
        emptyMessage="No stock records match your filters"
        emptyAction={<button type="button" onClick={() => { tc.setQuery(''); setState('all'); }} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Clear filters</button>}
      />
      <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} unit="stock records" />
    </>
  );
}
