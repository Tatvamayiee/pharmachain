import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Megaphone, ShieldAlert } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import DataTable, { type Column } from '../../../shared/components/ui/DataTable';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { ExportButton } from '../../../shared/components/ui/inputs';
import { useToast } from '../../../app/providers/ToastContext';
import { useFetch } from '../../../shared/hooks/useFetch';
import { dataService } from '../../../platform/data/dataService';
import { exportCsv } from '../../../shared/services/exportService';
import { medicineName, mockBatches } from '../../../shared/data/mockData';
import type { Batch, Recall } from '../../../shared/types';

const schema = z.object({
  batchId: z.string().min(1, 'Select a batch'),
  reason: z.string().min(10, 'Provide a clear reason (min 10 characters)'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});
type Values = z.infer<typeof schema>;

interface Row extends Record<string, unknown> {
  id: string; batch: string; medicine: string; reason: string; severity: string;
  status: string; affectedQuantity: number; createdAt: string;
}

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export default function RecallManagement() {
  const { toast } = useToast();
  const recallsQ = useFetch<Recall[]>(() => dataService.getRecalls());
  const batchesQ = useFetch<Batch[]>(() => dataService.getBatches());
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<Values | null>(null);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { severity: 'medium' } });

  // Real batches from the server (org-scoped): only non-recalled ones are
  // recallable; mock fallback keeps the picker usable offline.
  const recallableBatches = (batchesQ.data ?? mockBatches).filter((b) => b.status !== 'recalled');

  const rows: Row[] = useMemo(() => {
    const list = recallsQ.data ?? [];
    return list.map((r) => ({
      id: r.id,
      batch: r.batchNumber ?? r.batchId,
      medicine: r.medicineName ?? '—',
      reason: r.reason,
      severity: r.severity,
      status: r.status,
      affectedQuantity: r.affectedQuantity,
      createdAt: fmt(r.createdAt),
    }));
  }, [recallsQ.data]);

  const columns: Column<Row>[] = [
    { key: 'batch', header: 'Batch', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.batch}</span> },
    { key: 'medicine', header: 'Medicine', sortable: true },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-64 truncate text-slate-600" title={r.reason}>{r.reason}</span> },
    { key: 'severity', header: 'Severity', render: (r) => <StatusBadge status={r.severity === 'critical' || r.severity === 'high' ? 'recalled' : r.severity === 'medium' ? 'expired' : 'active'} tone={r.severity === 'critical' ? 'error' : r.severity === 'high' ? 'error' : r.severity === 'medium' ? 'warning' : 'default'} pretty={false} /> },
    { key: 'affectedQuantity', header: 'Affected Units', sortable: true, render: (r) => r.affectedQuantity.toLocaleString('en-IN') },
    { key: 'status', header: 'Case Status', render: (r) => <StatusBadge status={r.status === 'open' ? 'Pending' : r.status === 'in_progress' ? 'IN_TRANSIT' : 'DELIVERED'} /> },
    { key: 'createdAt', header: 'Initiated', hideOnMobile: true },
  ];

  const prepare = (values: Values) => {
    setPending(values);
    setConfirmOpen(true);
  };

  const doRecall = async () => {
    if (!pending) return;
    const res = await dataService.setBatchStatus(
      pending.batchId,
      'recalled',
      pending.reason,
      pending.severity
    );
    setConfirmOpen(false);
    setModalOpen(false);
    if (res.ok) {
      toast('Recall initiated — dealers, hospitals and customers will see it immediately.', 'warning');
      recallsQ.refetch();
    } else {
      toast(res.error || 'Recall failed — please try again.', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Recall Management"
        subtitle="Initiate recalls with severity and notify every stakeholder"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Recall Management' }]}
        actions={
          <>
            <ExportButton onExport={() => exportCsv('recalls', ['Batch', 'Medicine', 'Reason', 'Severity', 'Affected', 'Status'], rows.map((r) => [r.batch, r.medicine, r.reason, r.severity, r.affectedQuantity, r.status]))} />
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
              <Megaphone size={15} aria-hidden="true" /> Initiate Recall
            </button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={recallsQ.loading}
        emptyMessage="No recall cases — all batches are healthy"
        skeletonRows={3}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Initiate recall">
        <form onSubmit={handleSubmit(prepare)} noValidate className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Batch to recall</span>
            <select {...register('batchId')} className={inputCls} defaultValue="">
              <option value="" disabled>Select batch</option>
              {recallableBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.batchNumber} — {b.medicineName ?? medicineName(b.medicineId) ?? 'Unknown medicine'}</option>
              ))}
            </select>
            {errors.batchId && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.batchId.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Recall reason</span>
            <textarea rows={3} {...register('reason')} className={`${inputCls} resize-y`} placeholder="Explain the quality issue detected…" />
            {errors.reason && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.reason.message}</span>}
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">Severity</legend>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((s) => (
                <label key={s} className="cursor-pointer">
                  <input type="radio" value={s} {...register('severity')} className="peer sr-only" />
                  <span className="block rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold capitalize text-slate-600 transition-colors peer-checked:border-red-400 peer-checked:bg-red-50 peer-checked:text-red-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-indigo-600">
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <ShieldAlert size={13} className="mr-1 inline" aria-hidden="true" />
            Recalling notifies all distributors, dealers, hospitals and customers holding this batch, and
            regulators are informed immediately.
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50">
              {isSubmitting ? 'Preparing…' : 'Continue'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm recall"
        message={pending ? `Recall batch with reason "${pending.reason}" at ${pending.severity} severity? This cannot be undone.` : ''}
        confirmLabel="Yes, initiate recall"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doRecall}
      />
    </>
  );
}
