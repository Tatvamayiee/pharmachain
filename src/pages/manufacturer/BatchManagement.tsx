import { useMemo, useState } from 'react';
import { Eye, ShieldAlert, CircleOff, Plus } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SearchInput, FilterDropdown, ExportButton, Pagination } from '../../components/ui/inputs';
import { ErrorState } from '../../components/ui/states';
import { useFetch } from '../../hooks/useFetch';
import { useTableControls } from '../../hooks/useSearchSort';
import { useToast } from '../../contexts/ToastContext';
import { dataService } from '../../services/dataService';
import { exportCsv } from '../../services/exportService';
import { medicineName, mockShipments } from '../../data/mockData';
import type { Batch } from '../../types';

interface Row extends Record<string, unknown> {
  id: string; batchNumber: string; medicine: string; manufacturingDate: string; expiryDate: string;
  quantityProduced: number; availableQuantity: number; status: string; qr: string; created: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BatchManagement() {
  const { toast } = useToast();
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());
  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<Row | null>(null);
  const [confirmRecall, setConfirmRecall] = useState<Row | null>(null);

  const rows: Row[] = useMemo(() => {
    const bs = batchesQ.data ?? [];
    return bs.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      // Server-backed batches carry the real medicine name; the mock-catalog
      // lookup is the fallback for prototype data.
      medicine: b.medicineName || medicineName(b.medicineId),
      manufacturingDate: fmt(b.manufacturingDate),
      expiryDate: fmt(b.expiryDate),
      quantityProduced: b.quantityProduced,
      availableQuantity: b.availableQuantity,
      status: b.status,
      qr: b.qrCode,
      created: fmt(b.createdAt),
    }));
  }, [batchesQ.data]);

  const filtered = useMemo(() => rows.filter((r) => status === 'all' || r.status === status), [rows, status]);
  const tc = useTableControls<Row>(filtered, ['batchNumber', 'medicine']);

  /** Recall / expire against the server; refetch so every field is truthful. */
  const applyStatus = async (r: Row, next: 'recalled' | 'expired' | 'released', reason?: string) => {
    const res = await dataService.setBatchStatus(r.id, next, reason);
    if (!res.ok) {
      toast(res.error || 'Status update failed.', 'error');
      return;
    }
    toast(next === 'recalled'
      ? `Recall initiated for ${r.batchNumber} — stakeholders notified.`
      : `${r.batchNumber} marked as ${next}.`, 'warning');
    setConfirmRecall(null);
    batchesQ.refetch();
  };

  const columns: Column<Row>[] = [
    { key: 'batchNumber', header: 'Batch No.', sortable: true, render: (r) => (
      <button type="button" onClick={() => setDetail(r)} className="font-mono text-xs font-semibold text-indigo-700 hover:underline">{r.batchNumber}</button>
    )},
    { key: 'medicine', header: 'Medicine', sortable: true },
    { key: 'manufacturingDate', header: 'Mfg Date', sortable: true, hideOnMobile: true },
    { key: 'expiryDate', header: 'Expiry', sortable: true },
    { key: 'availableQuantity', header: 'Available', sortable: true, render: (r) => `${r.availableQuantity.toLocaleString('en-IN')} / ${r.quantityProduced.toLocaleString('en-IN')}` },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions', hideOnMobile: true,
      render: (r) => (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setDetail(r)} aria-label={`View batch ${r.batchNumber}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"><Eye size={15} /></button>
          {r.status !== 'recalled' && r.status !== 'expired' && (
            <>
              <button type="button" onClick={() => setConfirmRecall(r)} aria-label={`Recall batch ${r.batchNumber}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"><ShieldAlert size={15} /></button>
              <button type="button" onClick={() => void applyStatus(r, 'expired')} aria-label={`Mark ${r.batchNumber} expired`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-600"><CircleOff size={15} /></button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (batchesQ.error && !batchesQ.loading) return <ErrorState message={batchesQ.error} onRetry={batchesQ.retry} />;

  const detailShipments = detail ? mockShipments.filter((s) => s.batchId === detail.id) : [];

  return (
    <>
      <PageHeader
        title="Batch Management"
        subtitle="Create, monitor and act on every production batch"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Batch Management' }]}
        actions={
          <>
            <ExportButton onExport={() => exportCsv('batches', ['Batch No', 'Medicine', 'Mfg Date', 'Expiry', 'Available', 'Status'], filtered.map((r) => [r.batchNumber, r.medicine, r.manufacturingDate, r.expiryDate, r.availableQuantity, r.status]))} />
            <button type="button" onClick={() => toast('Use Data Entry to register a new batch.', 'info')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              <Plus size={15} aria-hidden="true" /> Create Batch
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={tc.query} onChange={(v) => { tc.setQuery(v); tc.setPage(1); }} placeholder="Search batch number or medicine…" label="Search batches" />
        <FilterDropdown label="Status" value={status} onChange={(v) => { setStatus(v); tc.setPage(1); }}
          options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'recalled', label: 'Recalled' }, { value: 'depleted', label: 'Depleted' }]} />
      </div>

      <DataTable
        columns={columns}
        rows={tc.paged}
        rowKey={(r) => r.id}
        sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
        loading={batchesQ.loading}
        emptyMessage="No batches found"
        emptyAction={<button type="button" onClick={() => { tc.setQuery(''); setStatus('all'); }} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Clear filters</button>}
      />
      <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} unit="batches" />

      {/* Detail modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Batch ${detail.batchNumber}` : ''} maxWidth="max-w-2xl">
        {detail && (
          <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
            <div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm">
                {[
                  ['Medicine', detail.medicine],
                  ['Manufactured', detail.manufacturingDate],
                  ['Expiry', detail.expiryDate],
                  ['Produced', detail.quantityProduced.toLocaleString('en-IN')],
                  ['Available', detail.availableQuantity.toLocaleString('en-IN')],
                  ['Created', detail.created],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-400">{k}</dt>
                    <dd className="font-semibold text-slate-800">{v}</dd>
                  </div>
                ))}
                <div className="col-span-2 flex items-center gap-2">
                  <dt className="text-xs text-slate-400">Status</dt>
                  <dd><StatusBadge status={detail.status} /></dd>
                </div>
              </dl>
              <h3 className="mt-5 text-sm font-semibold text-slate-800">Shipment history</h3>
              {detailShipments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No shipments dispatched from this batch yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detailShipments.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-slate-700">{s.id}</p>
                        <p className="text-xs text-slate-400">{s.destination}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col items-center gap-3 sm:border-l sm:border-slate-100 sm:pl-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Batch QR</p>
              <QRCodeDisplay payload={detail.qr} pixelSize={140} label={`QR code for batch ${detail.batchNumber}`} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmRecall}
        title="Initiate recall?"
        message={`Recalling batch ${confirmRecall?.batchNumber} will notify all distributors, dealers, hospitals and customers holding this batch. Confirm to proceed.`}
        confirmLabel="Recall batch"
        onCancel={() => setConfirmRecall(null)}
        onConfirm={() => { if (confirmRecall) void applyStatus(confirmRecall, 'recalled', 'Initiated by manufacturer'); }}
      />
    </>
  );
}
