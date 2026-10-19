import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Truck } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SearchInput, FilterDropdown, ExportButton, Pagination } from '../../components/ui/inputs';
import { ErrorState } from '../../components/ui/states';
import { useFetch } from '../../hooks/useFetch';
import { useTableControls } from '../../hooks/useSearchSort';
import { useToast } from '../../contexts/ToastContext';
import { dataService } from '../../services/dataService';
import { exportCsv } from '../../services/exportService';
import { mockBatches, mockUsers } from '../../data/mockData';
import type { Batch, Shipment } from '../../types';

const schema = z.object({
  medicineId: z.string().min(1, 'Select a medicine'),
  batchId: z.string().min(1, 'Select a batch'),
  quantity: z.coerce.number().int().positive('Quantity must be positive'),
  receiverId: z.string().min(1, 'Select a receiver'),
  destination: z.string().min(2, 'Destination is required'),
  route: z.string().min(2, 'Route is required'),
  trackingNumber: z.string().min(3, 'Vehicle / tracking number is required'),
});
type Values = z.infer<typeof schema>;

interface Row extends Record<string, unknown> {
  id: string; medicine: string; destination: string; route: string; receiver: string;
  quantity: number; trackingNumber: string; status: string; created: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export default function Dispatch() {
  const { toast } = useToast();
  const shipmentsQ = useFetch<Shipment[]>(() => dataService.getShipments());
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());
  const receiversQ = useFetch<Array<{ organization: string; role: string; name: string }>>(() => dataService.getReceivers());
  const [status, setStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<Row | null>(null);

  const {
    register, handleSubmit, reset, watch, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const batches = batchesQ.data ?? mockBatches;
  const receivers = receiversQ.data ?? mockUsers
    .filter((u) => ['distributor', 'dealer', 'hospital'].includes(u.role) && u.organization)
    .map((u) => ({ organization: u.organization, role: u.role, name: u.name }));

  const watchedMedicine = watch('medicineId');
  const batchOptions = batches.filter((b) => !watchedMedicine || b.medicineName === watchedMedicine || b.medicineId === watchedMedicine);

  const rows: Row[] = useMemo(() => {
    const list = shipmentsQ.data ?? [];
    return list.map((s) => ({
      id: s.id, medicine: s.medicineId || '—', destination: s.destination, route: s.route,
      receiver: s.receiverId || '—', quantity: s.quantity, trackingNumber: s.trackingNumber,
      status: s.status, created: fmt(s.createdAt),
    }));
  }, [shipmentsQ.data]);

  const filtered = useMemo(() => rows.filter((r) => status === 'all' || r.status === status), [rows, status]);
  const tc = useTableControls<Row>(filtered, ['id', 'medicine', 'destination']);

  const onCreate = async (values: Values) => {
    // Real persist: creates a server shipment; receiver is resolved by org.
    const med = batches.find((b) => b.id === values.batchId);
    const res = await dataService.createDispatch({
      medicineName: med?.medicineName ?? values.medicineId,
      batchNumber: med?.batchNumber ?? values.batchId,
      quantity: values.quantity,
      receiverOrg: values.receiverId,
      destination: values.destination,
      route: values.route,
      trackingNumber: values.trackingNumber,
    });
    if (!res.ok) {
      toast(res.error, 'error');
      return;
    }
    setModalOpen(false);
    reset();
    toast(`Shipment ${res.id} created — tracking live on the server.`, 'success');
    shipmentsQ.refetch();
  };

  const columns: Column<Row>[] = [
    { key: 'id', header: 'Shipment ID', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.id}</span> },
    { key: 'medicine', header: 'Medicine', sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-slate-800">{r.medicine}</p>
        <p className="text-xs text-slate-400">{r.quantity.toLocaleString('en-IN')} units · {r.trackingNumber}</p>
      </div>
    )},
    { key: 'destination', header: 'Destination', sortable: true, render: (r) => (
      <div>
        <p className="text-slate-800">{r.destination}</p>
        <p className="text-xs text-slate-400">{r.route}</p>
      </div>
    )},
    { key: 'receiver', header: 'Receiver', hideOnMobile: true },
    { key: 'created', header: 'Date', sortable: true, hideOnMobile: true },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions', hideOnMobile: true,
      render: (r) => (
        r.status === 'CREATED' || r.status === 'PACKED' ? (
          <button type="button" onClick={() => setConfirmCancel(r)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50">
            Cancel
          </button>
        ) : <span className="text-xs text-slate-300">—</span>
      ),
    },
  ];

  if (shipmentsQ.error && !shipmentsQ.loading) return <ErrorState message={shipmentsQ.error} onRetry={shipmentsQ.retry} />;

  return (
    <>
      <PageHeader
        title="Dispatch"
        subtitle="Create shipments, assign receivers and update dispatch status"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Dispatch' }]}
        actions={
          <>
            <ExportButton onExport={() => exportCsv('shipments', ['ID', 'Medicine', 'Destination', 'Route', 'Qty', 'Status'], filtered.map((r) => [r.id, r.medicine, r.destination, r.route, r.quantity, r.status]))} />
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              <Plus size={15} aria-hidden="true" /> Create Shipment
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={tc.query} onChange={(v) => { tc.setQuery(v); tc.setPage(1); }} placeholder="Search shipment ID, medicine…" label="Search shipments" />
        <FilterDropdown label="Status" value={status} onChange={(v) => { setStatus(v); tc.setPage(1); }}
          options={[{ value: 'all', label: 'All statuses' }, ...['CREATED', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'ASSIGNED_TO_DISTRIBUTOR', 'ASSIGNED_TO_DEALER', 'DELIVERED', 'CANCELLED'].map((s) => ({ value: s, label: s.split('_').join(' ') }))]} />
      </div>

      <DataTable
        columns={columns}
        rows={tc.paged}
        rowKey={(r) => r.id}
        sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
        loading={shipmentsQ.loading}
        emptyMessage="No shipments found"
        emptyAction={<button type="button" onClick={() => setModalOpen(true)} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Create your first shipment</button>}
      />
      <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} unit="shipments" />

      {/* Create shipment modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create shipment" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit(onCreate)} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Medicine</span>
              <select {...register('medicineId')} className={inputCls} defaultValue="">
                <option value="" disabled>Select medicine</option>
                {[...new Set(batches.map((b) => b.medicineName ?? b.medicineId))].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {errors.medicineId && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.medicineId.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Batch</span>
              <select {...register('batchId')} className={inputCls} defaultValue="">
                <option value="" disabled>Select batch</option>
                {batchOptions.map((b) => <option key={b.id} value={b.id}>{b.batchNumber} ({(b.availableQuantity ?? 0).toLocaleString('en-IN')} avail.)</option>)}
              </select>
              {errors.batchId && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.batchId.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity (units)</span>
              <input type="number" min={1} {...register('quantity')} className={inputCls} placeholder="e.g. 5000" />
              {errors.quantity && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.quantity.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Receiver</span>
              <select {...register('receiverId')} className={inputCls} defaultValue="">
                <option value="" disabled>Select distributor / dealer / hospital</option>
                {receivers.map((r) => (
                  <option key={r.organization} value={r.organization}>{r.organization} ({r.role})</option>
                ))}
              </select>
              {errors.receiverId && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.receiverId.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Destination</span>
              <input {...register('destination')} className={inputCls} placeholder="e.g. Chennai" />
              {errors.destination && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.destination.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Route</span>
              <input {...register('route')} className={inputCls} placeholder="e.g. Tiruppur → Chennai" />
              {errors.route && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.route.message}</span>}
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Vehicle / tracking number</span>
            <input {...register('trackingNumber')} className={`${inputCls} font-mono`} placeholder="e.g. TRK-88140" />
            {errors.trackingNumber && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.trackingNumber.message}</span>}
          </label>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
              {isSubmitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Truck size={15} aria-hidden="true" />}
              {isSubmitting ? 'Creating…' : 'Create shipment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmCancel}
        title="Cancel shipment?"
        message={`Shipment ${confirmCancel?.id} will be marked CANCELLED and the receiver will be notified.`}
        confirmLabel="Cancel shipment"
        onCancel={() => setConfirmCancel(null)}
        onConfirm={async () => {
          const target = confirmCancel;
          setConfirmCancel(null);
          if (!target) return;
          const res = await dataService.cancelShipment(target.id);
          if (res.ok) {
            toast(`Shipment ${target.id} cancelled.`, 'warning');
            shipmentsQ.refetch();
          } else {
            toast(res.error || 'Cancel failed.', 'error');
          }
        }}
      />
    </>
  );
}
