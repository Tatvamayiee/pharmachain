import { useMemo, useState } from 'react';
import { FileBarChart, Printer } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { FilterDropdown, ExportButton } from '../../components/ui/inputs';
import { useToast } from '../../contexts/ToastContext';
import { exportCsv, printSection } from '../../services/exportService';
import { medicineName, mockBatches, mockShipments, mockStock } from '../../data/mockData';

export interface ReportDef {
  key: string;
  label: string;
  description: string;
  headers: string[];
  rows: () => (string | number)[][];
  columns: Column<Record<string, unknown>>[];
  records: Record<string, unknown>[];
}

function buildReports(): ReportDef[] {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const production: ReportDef = {
    key: 'production', label: 'Production', description: 'Units produced per batch with batch status',
    headers: ['Batch', 'Medicine', 'Manufactured', 'Expiry', 'Produced', 'Available', 'Status'],
    rows: () => mockBatches.map((b) => [b.batchNumber, medicineName(b.medicineId), fmt(b.manufacturingDate), fmt(b.expiryDate), b.quantityProduced, b.availableQuantity, b.status]),
    records: mockBatches.map((b) => ({ batch: b.batchNumber, medicine: medicineName(b.medicineId), manufactured: fmt(b.manufacturingDate), expiry: fmt(b.expiryDate), produced: b.quantityProduced, available: b.availableQuantity, status: b.status })),
    columns: [
      { key: 'batch', header: 'Batch' }, { key: 'medicine', header: 'Medicine' },
      { key: 'manufactured', header: 'Manufactured' }, { key: 'expiry', header: 'Expiry' },
      { key: 'produced', header: 'Produced' }, { key: 'available', header: 'Available' },
      { key: 'status', header: 'Status' },
    ],
  };

  const stock: ReportDef = {
    key: 'stock', label: 'Stock', description: 'Current stock across owners and batches',
    headers: ['Medicine', 'Batch', 'Owner type', 'Available', 'Reorder level'],
    rows: () => mockStock.map((s) => [medicineName(s.medicineId), s.batchId, s.ownerId, s.availableQuantity, s.reorderLevel]),
    records: mockStock.map((s) => ({ medicine: medicineName(s.medicineId), batch: s.batchId, owner: s.ownerId, available: s.availableQuantity, reorder: s.reorderLevel })),
    columns: [
      { key: 'medicine', header: 'Medicine' }, { key: 'batch', header: 'Batch' },
      { key: 'owner', header: 'Owner' }, { key: 'available', header: 'Available' }, { key: 'reorder', header: 'Reorder Level' },
    ],
  };

  const shipment: ReportDef = {
    key: 'shipment', label: 'Shipments', description: 'All shipments with routes and status',
    headers: ['Shipment', 'Medicine', 'Destination', 'Route', 'Quantity', 'Status'],
    rows: () => mockShipments.map((s) => [s.id, medicineName(s.medicineId), s.destination, s.route, s.quantity, s.status]),
    records: mockShipments.map((s) => ({ shipment: s.id, medicine: medicineName(s.medicineId), destination: s.destination, route: s.route, quantity: s.quantity, status: s.status })),
    columns: [
      { key: 'shipment', header: 'Shipment' }, { key: 'medicine', header: 'Medicine' },
      { key: 'destination', header: 'Destination' }, { key: 'route', header: 'Route' },
      { key: 'quantity', header: 'Quantity' }, { key: 'status', header: 'Status' },
    ],
  };

  const batch: ReportDef = {
    key: 'batch', label: 'Batch Status', description: 'Status summary of every batch',
    headers: ['Batch', 'Medicine', 'Status', 'Available'],
    rows: () => mockBatches.map((b) => [b.batchNumber, medicineName(b.medicineId), b.status, b.availableQuantity]),
    records: mockBatches.map((b) => ({ batch: b.batchNumber, medicine: medicineName(b.medicineId), status: b.status, available: b.availableQuantity })),
    columns: [
      { key: 'batch', header: 'Batch' }, { key: 'medicine', header: 'Medicine' },
      { key: 'status', header: 'Status' }, { key: 'available', header: 'Available' },
    ],
  };

  const expiry: ReportDef = {
    key: 'expiry', label: 'Expiry', description: 'Batches ordered by remaining shelf life',
    headers: ['Batch', 'Medicine', 'Expiry', 'Available'],
    rows: () => mockBatches.map((b) => [b.batchNumber, medicineName(b.medicineId), fmt(b.expiryDate), b.availableQuantity]),
    records: [...mockBatches].sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)).map((b) => ({ batch: b.batchNumber, medicine: medicineName(b.medicineId), expiry: fmt(b.expiryDate), available: b.availableQuantity })),
    columns: [
      { key: 'batch', header: 'Batch' }, { key: 'medicine', header: 'Medicine' },
      { key: 'expiry', header: 'Expiry' }, { key: 'available', header: 'Available' },
    ],
  };

  return [production, stock, batch, shipment, expiry];
}

export default function ReportsPage({ crumbs, subtitle = 'Generate, filter and export operational reports' }: {
  crumbs: { label: string; to?: string }[]; subtitle?: string;
}) {
  const { toast } = useToast();
  const reports = useMemo(buildReports, []);
  const [activeKey, setActiveKey] = useState(reports[0]?.key ?? 'production');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const active = reports.find((r) => r.key === activeKey) ?? reports[0];

  const rowsFiltered = useMemo(() => active.records, [active]);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={subtitle}
        crumbs={crumbs}
        actions={
          <>
            <ExportButton onExport={() => { exportCsv(`${active.key}-report`, active.headers, active.rows()); toast(`${active.label} report exported as CSV.`, 'success'); }} />
            <ExportButton label="Export PDF" onExport={() => { toast('Opening print dialog — choose "Save as PDF".', 'info'); printSection(); }} />
            <button type="button" onClick={() => { toast('Preparing printable view…', 'info'); printSection(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
              <Printer size={15} aria-hidden="true" /> Print
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Report types">
        {reports.map((r) => (
          <button
            key={r.key} type="button" role="tab" aria-selected={activeKey === r.key}
            onClick={() => setActiveKey(r.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              activeKey === r.key ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileBarChart size={14} className="mr-1.5 inline" aria-hidden="true" /> {r.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </label>
        <FilterDropdown label="" value={activeKey} onChange={setActiveKey} options={reports.map((r) => ({ value: r.key, label: r.description }))} />
      </div>

      <DataTable columns={active.columns} rows={rowsFiltered} rowKey={(r) => String(r.batch ?? r.shipment ?? r.medicine)} emptyMessage="No records for this report" skeletonRows={6} />
    </>
  );
}
