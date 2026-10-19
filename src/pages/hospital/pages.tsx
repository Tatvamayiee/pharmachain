import { useState } from 'react';
import { Plus } from 'lucide-react';
import TablePage from '../shared/TablePage';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import ReportsPage from '../shared/ReportsPage';
import { useToast } from '../../contexts/ToastContext';
import { dataService } from '../../services/dataService';
import { BATCH_BY_ID, MEDICINE_BY_ID, medicineName, mockShipments } from '../../data/mockData';
import type { Column } from '../../components/ui/DataTable';

type Any = Record<string, unknown>;
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function HospitalInventory() {
  return (
    <TablePage
      title="Medicine Inventory" subtitle="Ward-level medicine stock held by the hospital"
      crumbs={[{ label: 'Hospital' }, { label: 'Medicine Inventory' }]}
      load={() => dataService.getStock()}
      // Server-backed stock is already org-scoped; when the mock fallback
      // responds, filter to the hospital demo owner. Medicine names come from
      // the stock row itself (server) or the mock catalog (fallback).
      buildRows={(list) => list
        .filter((s) => s.expiryDate || s.ownerId === 'u4' || list.every((x) => !x.expiryDate))
        .map((s, i) => ({
          id: `${s.id}-${i}`, medicine: MEDICINE_BY_ID.get(s.medicineId)?.name ?? s.medicineId,
          batch: BATCH_BY_ID.get(s.batchId)?.batchNumber ?? s.batchId,
          available: s.availableQuantity, reorderLevel: s.reorderLevel,
          status: s.availableQuantity < s.reorderLevel ? 'expired' : 'active',
        }))}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'available', header: 'Available', sortable: true },
        { key: 'reorderLevel', header: 'Reorder', hideOnMobile: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch']}
      emptyMessage="No inventory"
    />
  );
}

const REQUESTS = [
  { id: 'RQ-101', medicineName: 'Paracetamol 500 mg', quantity: 2000, department: 'Emergency', priority: 'emergency', date: fmt(new Date(Date.now() + 2 * 864e5).toISOString()), status: 'pending' },
  { id: 'RQ-102', medicineName: 'Amoxicillin 500 mg', quantity: 800, department: 'General Ward', priority: 'important', date: fmt(new Date(Date.now() + 5 * 864e5).toISOString()), status: 'pending' },
  { id: 'RQ-103', medicineName: 'Omeprazole 20 mg', quantity: 600, department: 'ICU', priority: 'normal', date: fmt(new Date(Date.now() + 10 * 864e5).toISOString()), status: 'approved' },
];

export function RequestMedicines() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Request Medicines" subtitle="Raise medicine requests to distributors with priority"
        crumbs={[{ label: 'Hospital' }, { label: 'Request Medicines' }]}
        actions={
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
            <Plus size={15} aria-hidden="true" /> New request
          </button>
        }
      />
      <TablePage
        title="Requests" subtitle="Track the status of your medicine requests"
        crumbs={[{ label: 'Hospital' }, { label: 'Requests' }]}
        load={async () => REQUESTS}
        buildRows={(r: Any[]) => r}
        columns={[
          { key: 'id', header: 'Request', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
          { key: 'medicineName', header: 'Medicine', sortable: true },
          { key: 'quantity', header: 'Qty' },
          { key: 'department', header: 'Department' },
          { key: 'priority', header: 'Priority', render: (r: Any) => <StatusBadge status={String(r.priority)} /> },
          { key: 'date', header: 'Required By', hideOnMobile: true },
          { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
        ] as unknown as Column<Any>[]}
        searchFields={['id', 'medicineName', 'department']}
        emptyMessage="No requests raised"
      />

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New medicine request">
        <form
          onSubmit={(e) => { e.preventDefault(); setOpen(false); toast('Request submitted to distributor.', 'success'); }}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Medicine name</span>
            <input required className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Paracetamol 500 mg" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</span>
              <input required type="number" min={1} className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Department</span>
              <select className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none">
                {['Emergency', 'ICU', 'General Ward', 'Oncology', 'Pediatrics'].map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Priority</legend>
            <div className="grid grid-cols-3 gap-2">
              {['normal', 'important', 'emergency'].map((p, i) => (
                <label key={p} className="cursor-pointer">
                  <input type="radio" name="priority" defaultChecked={i === 0} className="peer sr-only" />
                  <span className="block rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold capitalize text-slate-600 peer-checked:border-indigo-400 peer-checked:bg-indigo-50 peer-checked:text-indigo-700">{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Required date</span>
            <input required type="date" className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Notes</span>
            <textarea rows={2} className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Optional context for the distributor" />
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Submit request</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function PurchaseOrders() {
  return (
    <TablePage
      title="Purchase Orders" subtitle="Approved purchase orders to distributors"
      crumbs={[{ label: 'Hospital' }, { label: 'Purchase Orders' }]}
      load={async () => [
        { id: 'PO-771', distributor: 'Kaveri Distributors', items: 6, value: 58400, status: 'approved', date: fmt(new Date(Date.now() - 3 * 864e5).toISOString()) },
        { id: 'PO-770', distributor: 'Kaveri Distributors', items: 2, value: 12300, status: 'fulfilled', date: fmt(new Date(Date.now() - 12 * 864e5).toISOString()) },
        { id: 'PO-769', distributor: 'MediDist Logistics', items: 4, value: 28900, status: 'pending', date: fmt(new Date(Date.now() - 1 * 864e5).toISOString()) },
      ]}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'id', header: 'PO', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'distributor', header: 'Distributor', sortable: true },
        { key: 'items', header: 'Items', hideOnMobile: true },
        { key: 'value', header: 'Value (₹)', sortable: true, render: (r: Any) => Number(r.value).toLocaleString('en-IN') },
        { key: 'date', header: 'Date', hideOnMobile: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'distributor']}
      emptyMessage="No purchase orders"
    />
  );
}

export function ReceivedShipments() {
  return (
    <TablePage
      title="Received Shipments" subtitle="Deliveries received and verified at goods-inward"
      crumbs={[{ label: 'Hospital' }, { label: 'Received Shipments' }]}
      load={async () => mockShipments.filter((s) => s.receiverId === 'u4').map((s) => ({
        id: s.id, medicine: medicineName(s.medicineId), from: 'Kaveri Distributors',
        quantity: s.quantity, delivered: s.deliveredAt ? fmt(s.deliveredAt) : '—', status: s.status,
      }))}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'id', header: 'Shipment', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'quantity', header: 'Qty' },
        { key: 'delivered', header: 'Delivered' },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'medicine']}
      emptyMessage="No received shipments"
    />
  );
}

const USAGE = [
  { id: 'U-901', medicine: 'Paracetamol 500 mg', department: 'Emergency', quantity: 240, usedFor: 'Fever management', date: fmt(new Date(Date.now() - 864e5).toISOString()) },
  { id: 'U-902', medicine: 'Omeprazole 20 mg', department: 'ICU', quantity: 90, usedFor: 'Stress ulcer prophylaxis', date: fmt(new Date(Date.now() - 2 * 864e5).toISOString()) },
  { id: 'U-903', medicine: 'Amoxicillin 500 mg', department: 'General Ward', quantity: 160, usedFor: 'Bacterial infection', date: fmt(new Date(Date.now() - 3 * 864e5).toISOString()) },
  { id: 'U-904', medicine: 'Cetirizine 10 mg', department: 'Pediatrics', quantity: 45, usedFor: 'Allergic reactions', date: fmt(new Date(Date.now() - 4 * 864e5).toISOString()) },
];

export function UsageRecords() {
  return (
    <TablePage
      title="Usage Records" subtitle="Medicine consumption logged by department"
      crumbs={[{ label: 'Hospital' }, { label: 'Usage Records' }]}
      load={async () => USAGE}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'department', header: 'Department', sortable: true },
        { key: 'quantity', header: 'Qty Used' },
        { key: 'usedFor', header: 'Purpose' },
        { key: 'date', header: 'Date', sortable: true },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'department', 'usedFor']}
      emptyMessage="No usage recorded"
    />
  );
}

const DEPTS = [
  { id: 'd1', name: 'Emergency', head: 'Dr. S. Priya', staff: 42 },
  { id: 'd2', name: 'ICU', head: 'Dr. R. Anand', staff: 28 },
  { id: 'd3', name: 'General Ward', head: 'Dr. M. Kavitha', staff: 56 },
  { id: 'd4', name: 'Oncology', head: 'Dr. J. Bala', staff: 19 },
  { id: 'd5', name: 'Pediatrics', head: 'Dr. N. Shanthi', staff: 24 },
];

export function Departments() {
  return (
    <TablePage
      title="Departments" subtitle="Departments with medicine allocation responsibility"
      crumbs={[{ label: 'Hospital' }, { label: 'Departments' }]}
      load={async () => DEPTS}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'name', header: 'Department', sortable: true },
        { key: 'head', header: 'Department Head' },
        { key: 'staff', header: 'Staff', sortable: true },
      ] as unknown as Column<Any>[]}
      searchFields={['name', 'head']}
      emptyMessage="No departments"
    />
  );
}

export function HospitalExpiry() {
  return (
    <TablePage
      title="Expiry Alerts" subtitle="Medicines approaching expiry in hospital stock"
      crumbs={[{ label: 'Hospital' }, { label: 'Expiry Alerts' }]}
      load={async () => {
        const { expiringBatches } = await import('../../data/mockData');
        return expiringBatches(180).map((b) => ({
          id: b.id, medicine: medicineName(b.medicineId), batch: b.batchNumber,
          expiry: fmt(b.expiryDate), days: Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000),
          status: b.status,
        }));
      }}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'expiry', header: 'Expiry' },
        { key: 'days', header: 'Days Left', sortable: true, render: (r: Any) => (
          <span className={Number(r.days) <= 30 ? 'font-semibold text-red-600' : 'font-semibold text-amber-600'}>{String(r.days)}</span>
        ) },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch']}
      emptyMessage="Nothing expiring soon"
    />
  );
}

export function HospitalRecalls() {
  return (
    <TablePage
      title="Recall Alerts" subtitle="Recalled batches affecting hospital stock"
      crumbs={[{ label: 'Hospital' }, { label: 'Recall Alerts' }]}
      load={async () => {
        const recalls = await dataService.getRecalls();
        return recalls.map((r) => ({
          id: r.id, batch: r.batchNumber ?? r.batchId,
          medicine: r.medicineName ?? '—',
          reason: r.reason, severity: r.severity, status: r.status,
        }));
      }}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'reason', header: 'Reason' },
        { key: 'severity', header: 'Severity', render: (r: Any) => <StatusBadge status={String(r.severity) === 'critical' || String(r.severity) === 'high' ? 'recalled' : 'expired'} pretty={false} /> },
        { key: 'status', header: 'Case', render: (r: Any) => <StatusBadge status={String(r.status) === 'open' ? 'Pending' : 'IN_TRANSIT'} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch', 'reason']}
      emptyMessage="No recall cases"
    />
  );
}

export function HospitalReports() {
  return <ReportsPage crumbs={[{ label: 'Hospital' }, { label: 'Reports' }]} subtitle="Inventory, usage and expiry reports" />;
}
