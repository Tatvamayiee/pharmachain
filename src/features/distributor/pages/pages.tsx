import { Check, PackageCheck, Truck } from 'lucide-react';
import TablePage from '../../../shared/pages/TablePage';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import { useToast } from '../../../app/providers/ToastContext';
import { dataService } from '../../../platform/data/dataService';
import { BATCH_BY_ID, expiringBatches, medicineName, mockShipments, userName } from '../../../shared/data/mockData';
import type { Column } from '../../../shared/components/ui/DataTable';
import type { Shipment } from '../../../shared/types';
import LiveTracking from '../../manufacturer/pages/LiveTracking';
import ReportsPage from '../../../shared/pages/ReportsPage';

type Any = Record<string, unknown>;

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type ShipRow = {
  id: string; medicine: string; from: string; to: string; quantity: number; status: string; created: string;
} & Record<string, unknown>;

type MovementRow = {
  id: string; reference: string; medicine: string; party: string; quantity: number; date: string; status: string;
} & Record<string, unknown>;

type DealerOrderRow = {
  id: string; dealer: string; items: number; value: number; status: string;
} & Record<string, unknown>;

type HospitalOrderRow = {
  id: string; hospital: string; items: number; priority: string; value: number; status: string;
} & Record<string, unknown>;

type ReturnRow = {
  id: string; reference: string; medicine: string; reason: string; quantity: number; status: string; date: string;
} & Record<string, unknown>;

type ExpiryRow = {
  id: string; medicine: string; batch: string; expiry: string; days: number; available: number; status: string;
} & Record<string, unknown>;

const SHIP_COLS: Column<ShipRow>[] = [
  { key: 'id', header: 'Shipment', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.id}</span> },
  { key: 'medicine', header: 'Medicine', sortable: true },
  { key: 'from', header: 'From', hideOnMobile: true },
  { key: 'to', header: 'To', sortable: true },
  { key: 'quantity', header: 'Qty', sortable: true, render: (r) => r.quantity.toLocaleString('en-IN') },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'created', header: 'Date', hideOnMobile: true },
];

export function IncomingShipments() {
  const { toast } = useToast();
  return (
    <TablePage<ShipRow, Shipment>
      title="Incoming Shipments" subtitle="Accept or reject shipments arriving at your warehouse"
      crumbs={[{ label: 'Distributor' }, { label: 'Incoming Shipments' }]}
      load={() => dataService.getShipments()}
      buildRows={(list) => list.map((s) => ({
        ...s,
        id: s.id,
        medicine: medicineName(s.medicineId),
        from: userName(s.senderId),
        to: s.destination,
        quantity: s.quantity,
        status: s.status,
        created: fmt(s.createdAt),
      }))}
      columns={SHIP_COLS}
      searchFields={['id', 'medicine', 'from', 'to']}
      filters={[{ label: 'Status', field: 'status', options: [{ value: 'all', label: 'All statuses' }, ...['DISPATCHED', 'IN_TRANSIT', 'ASSIGNED_TO_DISTRIBUTOR', 'DELIVERED', 'CANCELLED'].map((s) => ({ value: s, label: s.split('_').join(' ') }))] }]}
      emptyMessage="No incoming shipments"
      headerActions={
        <button type="button" onClick={() => toast('All pending shipments accepted — stock updated.', 'success')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <Check size={15} aria-hidden="true" /> Accept all pending
        </button>
      }
    />
  );
}

type InventoryRow = {
  id: string; medicine: string; batch: string; owner: string; available: number; reorderLevel: number; status: string;
} & Record<string, unknown>;

export function Inventory() {
  return (
    <TablePage
      title="Inventory" subtitle="Current warehouse stock across batches"
      crumbs={[{ label: 'Distributor' }, { label: 'Inventory' }]}
      load={() => dataService.getStock()}
      buildRows={(list): InventoryRow[] => list.map((s) => ({
        id: s.id, medicine: medicineName(s.medicineId), batch: BATCH_BY_ID.get(s.batchId)?.batchNumber ?? '—',
        owner: userName(s.ownerId), available: s.availableQuantity, reorderLevel: s.reorderLevel,
        status: s.availableQuantity < s.reorderLevel ? 'expired' : 'active',
      }))}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', sortable: true, render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'owner', header: 'Owner', hideOnMobile: true },
        { key: 'available', header: 'Available', sortable: true },
        { key: 'reorderLevel', header: 'Reorder Level', hideOnMobile: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch']}
      emptyMessage="No inventory yet"
    />
  );
}

const stockDirection = (kind: 'in' | 'out') => function StockDirection() {
  const rows: MovementRow[] = mockShipments.map((s, i) => ({
    id: `${kind === 'in' ? 'IN' : 'OUT'}-${String(i + 1).padStart(3, '0')}`,
    reference: s.id, medicine: medicineName(s.medicineId), party: kind === 'in' ? userName(s.senderId) : userName(s.receiverId),
    quantity: s.quantity, date: fmt(s.createdAt), status: s.status,
  }));
  return (
    <TablePage
      title={kind === 'in' ? 'Stock Inward' : 'Stock Outward'}
      subtitle={kind === 'in' ? 'Stock received into the warehouse' : 'Stock dispatched from the warehouse'}
      crumbs={[{ label: 'Distributor' }, { label: kind === 'in' ? 'Stock Inward' : 'Stock Outward' }]}
      load={async () => rows}
      buildRows={(r: Any[]) => r}
      columns={[
        { key: 'reference', header: 'Reference', render: (r: Any) => <span className="font-mono text-xs">{String(r.reference)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'party', header: kind === 'in' ? 'From' : 'To' },
        { key: 'quantity', header: 'Qty', sortable: true },
        { key: 'date', header: 'Date', hideOnMobile: true },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['reference', 'medicine', 'party']}
      emptyMessage="No movements recorded"
    />
  );
};

export const StockInward = stockDirection('in');
export const StockOutward = stockDirection('out');

export function DealerOrders() {
  return (
    <TablePage
      title="Dealer Orders" subtitle="Orders placed by dealers on your warehouse"
      crumbs={[{ label: 'Distributor' }, { label: 'Dealer Orders' }]}
      load={async (): Promise<DealerOrderRow[]> => [
        { id: 'DO-201', dealer: 'sahana Pharmacy', items: 4, value: 24500, status: 'pending' },
        { id: 'DO-202', dealer: 'GreenLeaf Pharmacy', items: 2, value: 9800, status: 'approved' },
        { id: 'DO-203', dealer: 'sahana Pharmacy', items: 6, value: 41200, status: 'fulfilled' },
        { id: 'DO-204', dealer: 'CityCare Pharma', items: 1, value: 5300, status: 'pending' },
      ]}
      buildRows={(r: DealerOrderRow[]) => r}
      columns={[
        { key: 'id', header: 'Order', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'dealer', header: 'Dealer', sortable: true },
        { key: 'items', header: 'Line Items' },
        { key: 'value', header: 'Value (₹)', sortable: true, render: (r: Any) => Number(r.value).toLocaleString('en-IN') },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'dealer']}
      filters={[{ label: 'Status', field: 'status', options: [{ value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'fulfilled', label: 'Fulfilled' }] }]}
      emptyMessage="No dealer orders"
    />
  );
}

export function HospitalOrders() {
  return (
    <TablePage
      title="Hospital Orders" subtitle="Medicine orders requested by hospitals"
      crumbs={[{ label: 'Distributor' }, { label: 'Hospital Orders' }]}
      load={async (): Promise<HospitalOrderRow[]> => [
        { id: 'HO-441', hospital: 'KMCH Hospitals', items: 8, priority: 'emergency', value: 68000, status: 'pending' },
        { id: 'HO-442', hospital: 'CarePlus Multi-Speciality', items: 3, priority: 'important', value: 21500, status: 'approved' },
        { id: 'HO-443', hospital: 'KMCH Hospitals', items: 5, priority: 'normal', value: 14200, status: 'fulfilled' },
      ]}
      buildRows={(r: HospitalOrderRow[]) => r}
      columns={[
        { key: 'id', header: 'Order', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'hospital', header: 'Hospital', sortable: true },
        { key: 'items', header: 'Line Items', hideOnMobile: true },
        { key: 'priority', header: 'Priority', render: (r: Any) => <StatusBadge status={String(r.priority)} /> },
        { key: 'value', header: 'Value (₹)', sortable: true, render: (r: Any) => Number(r.value).toLocaleString('en-IN') },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'hospital']}
      emptyMessage="No hospital orders"
    />
  );
}

export function DistributorDispatch() {
  const { toast } = useToast();
  return (
    <TablePage<ShipRow, Shipment>
      title="Dispatch" subtitle="Create and manage outgoing dispatches to dealers and hospitals"
      crumbs={[{ label: 'Distributor' }, { label: 'Dispatch' }]}
      load={() => dataService.getShipments()}
      buildRows={(list) => list.map((s) => ({
        ...s,
        id: s.id,
        medicine: medicineName(s.medicineId),
        from: userName(s.senderId),
        to: s.destination,
        quantity: s.quantity,
        status: s.status,
        created: fmt(s.createdAt),
      }))}
      columns={[
        ...SHIP_COLS.slice(0, 6),
        { key: 'actions', header: '', hideOnMobile: true, render: () => (
          <button type="button" onClick={() => toast('Dispatch updated (prototype).', 'info')} className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label="Update dispatch"><Truck size={15} /></button>
        ) },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'medicine', 'to']}
      emptyMessage="Nothing to dispatch"
      headerActions={
        <button type="button" onClick={() => toast('New dispatch created (prototype).', 'success')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <PackageCheck size={15} aria-hidden="true" /> New dispatch
        </button>
      }
    />
  );
}

export function DistributorTracking() {
  return <LiveTracking />;
}

const RETURNS_ROWS: ReturnRow[] = [
  { id: 'RET-31', reference: 'SHIP-MTB7VD5NXJWQ6C', medicine: 'Paracetamol 500 mg', reason: 'Damaged in transit', quantity: 30, status: 'approved', date: '12 Mar 2026' },
  { id: 'RET-32', reference: 'SHIP-MTR4TG8HZKQ21B', medicine: 'Cetirizine 10 mg', reason: 'Near-expiry return', quantity: 120, status: 'pending', date: '14 Mar 2026' },
  { id: 'RET-33', reference: 'SHIP-MTK9QW2PLORD7X', medicine: 'Amoxicillin 500 mg', reason: 'Packaging defect', quantity: 40, status: 'approved', date: '15 Mar 2026' },
];

export function DistributorReturns() {
  return (
    <TablePage
      title="Returns" subtitle="Damaged and returned stock records"
      crumbs={[{ label: 'Distributor' }, { label: 'Returns' }]}
      load={async (): Promise<ReturnRow[]> => RETURNS_ROWS}
      buildRows={(r: ReturnRow[]) => r}
      columns={[
        { key: 'id', header: 'Return', render: (r: Any) => <span className="font-mono text-xs font-semibold">{String(r.id)}</span> },
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'reason', header: 'Reason' },
        { key: 'quantity', header: 'Qty' },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
        { key: 'date', header: 'Date', hideOnMobile: true },
      ] as unknown as Column<Any>[]}
      searchFields={['id', 'medicine', 'reason']}
      emptyMessage="No returns recorded"
    />
  );
}

export function ExpiryAlerts() {
  return (
    <TablePage
      title="Expiry Alerts" subtitle="Batches approaching expiry in your warehouse"
      crumbs={[{ label: 'Distributor' }, { label: 'Expiry Alerts' }]}
      load={async (): Promise<ExpiryRow[]> => {
        return expiringBatches(180).map((b) => ({
          id: b.id, medicine: medicineName(b.medicineId), batch: b.batchNumber,
          expiry: fmt(b.expiryDate), days: Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000),
          available: b.availableQuantity, status: b.status,
        }));
      }}
      buildRows={(r: ExpiryRow[]) => r}
      columns={[
        { key: 'medicine', header: 'Medicine', sortable: true },
        { key: 'batch', header: 'Batch', render: (r: Any) => <span className="font-mono text-xs">{String(r.batch)}</span> },
        { key: 'expiry', header: 'Expiry', sortable: true },
        { key: 'days', header: 'Days Left', sortable: true, render: (r: Any) => (
          <span className={Number(r.days) <= 30 ? 'font-semibold text-red-600' : Number(r.days) <= 90 ? 'font-semibold text-amber-600' : ''}>{String(r.days)}</span>
        ) },
        { key: 'available', header: 'Units' },
        { key: 'status', header: 'Status', render: (r: Any) => <StatusBadge status={String(r.status)} /> },
      ] as unknown as Column<Any>[]}
      searchFields={['medicine', 'batch']}
      emptyMessage="No batches expiring in the next 180 days"
    />
  );
}

export function DistributorReports() {
  return <ReportsPage crumbs={[{ label: 'Distributor' }, { label: 'Reports' }]} subtitle="Inventory, shipment and expiry reports for your warehouse" />;
}
