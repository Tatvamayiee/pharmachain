import { useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import QRCodeDisplay from '../../../shared/components/ui/QRCodeDisplay';
import DataTable, { type Column } from '../../../shared/components/ui/DataTable';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import { FilterDropdown, Pagination } from '../../../shared/components/ui/inputs';
import { EmptyState } from '../../../shared/components/ui/states';
import { useTableControls } from '../../../shared/hooks/useSearchSort';
import { useToast } from '../../../app/providers/ToastContext';
import TransportQRPanel from '../../../shared/components/ui/TransportQRPanel';
import { useFetch } from '../../../shared/hooks/useFetch';
import { dataService } from '../../../platform/data/dataService';
import { mockBatches, MEDICINE_BY_ID } from '../../../shared/data/mockData';
import type { Batch } from '../../../shared/types';

interface Row extends Record<string, unknown> {
  id: string; batchNumber: string; medicine: string; generated: string; payload: string; status: string;
}

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function QRGeneration() {
  const { toast } = useToast();
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());
  const batches = batchesQ.data ?? mockBatches;
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('all');

  const rows: Row[] = useMemo(
    () => batches.map((b: Batch) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      medicine: b.medicineName ?? MEDICINE_BY_ID.get(b.medicineId)?.name ?? '—',
      generated: fmt(b.createdAt),
      payload: b.qrCode || `https://pharmachain.app/verify/${encodeURIComponent(b.batchNumber)}`,
      status: b.status,
    })),
    [batches],
  );

  const filtered = useMemo(() => rows.filter((r) => status === 'all' || r.status === status), [rows, status]);
  const tc = useTableControls<Row>(filtered, ['batchNumber', 'medicine']);

  const selected = batches.find((b) => b.id === batchId) ?? batches[0];
  const selectedPayload = selected
    ? (selected.qrCode || `https://pharmachain.app/verify/${encodeURIComponent(selected.batchNumber)}`)
    : '';
  const selectedMedicine = selected ? (selected.medicineName ?? MEDICINE_BY_ID.get(selected.medicineId)?.name) : undefined;

  const columns: Column<Row>[] = [
    { key: 'batchNumber', header: 'Batch', sortable: true, render: (r) => (
      <button type="button" onClick={() => { setBatchId(r.id); toast(`Previewing QR for ${r.batchNumber}`, 'info'); }} className="font-mono text-xs font-semibold text-indigo-700 hover:underline">
        {r.batchNumber}
      </button>
    )},
    { key: 'medicine', header: 'Medicine', sortable: true },
    { key: 'generated', header: 'Generated', sortable: true, hideOnMobile: true },
    { key: 'payload', header: 'Verification URL', hideOnMobile: true, render: (r) => <span className="block max-w-56 truncate font-mono text-[11px] text-slate-400">{r.payload}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="QR Generation"
        subtitle="Generate, preview and distribute verification QR codes for batches"
        crumbs={[{ label: 'Manufacturer' }, { label: 'QR Generation' }]}
      />

      <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
        {/* Generator panel */}
        <section aria-label="Generate QR code" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-slate-900">Generate QR code</h2>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Select batch</span>
            <select
              value={selected?.id ?? ''} onChange={(e) => setBatchId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batchNumber} — {b.medicineName ?? MEDICINE_BY_ID.get(b.medicineId)?.name ?? 'Unknown medicine'}
                </option>
              ))}
            </select>
          </label>

          {selected ? (
            <div className="mt-5 flex flex-col items-center gap-2">
              <QRCodeDisplay
                payload={selectedPayload}
                pixelSize={170}
                label={`Verification QR for batch ${selected.batchNumber}`}
              />
              <button
                type="button"
                onClick={() => toast(`Scannable QR ready for ${selected.batchNumber} — print and stick it on the packs.`, 'success')}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <QrCode size={15} aria-hidden="true" /> Generate for new packages
              </button>
            </div>
          ) : (
            <EmptyState icon={QrCode} title="No batches yet" message="Create a batch first to generate QR codes." />
          )}

          {selectedMedicine && (
            <dl className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">QR payload contains:</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                <li>Medicine: {selectedMedicine}</li>
                <li>Batch: {selected?.batchNumber}</li>
                <li>Manufacturer: {selected?.medicineName ? 'your organization' : 'Acme Pharma (demo)'}</li>
                <li>Verification URL (tap Copy link above)</li>
              </ul>
            </dl>
          )}
        </section>

        {/* History */}
        <section aria-label="QR generation history">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Generation history</h2>
            <FilterDropdown label="Status" value={status} onChange={(v) => { setStatus(v); tc.setPage(1); }}
              options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'recalled', label: 'Recalled' }, { value: 'expired', label: 'Expired' }]} />
          </div>
          <DataTable
            columns={columns}
            rows={tc.paged}
            rowKey={(r) => r.id}
            sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
            loading={batchesQ.loading}
            emptyMessage="No QR codes generated yet"
          />
          <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} unit="codes" />
        </section>
      </div>

      {/* SECTION B — Medicine Transport Tracking QR (QR 2). Kept as a clearly
          separate section: different payload domain, different IDs, different
          purpose from the authentication QR above. */}
      <div className="mt-6">
        <TransportQRPanel />
      </div>
    </>
  );
}
