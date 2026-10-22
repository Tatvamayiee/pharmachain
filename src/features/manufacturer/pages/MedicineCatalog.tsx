import { useMemo, useState } from 'react';
import { Eye, Pencil, Trash2, Boxes, Plus } from 'lucide-react';
import PageHeader from '../../../shared/components/ui/PageHeader';
import DataTable, { type Column } from '../../../shared/components/ui/DataTable';
import StatusBadge from '../../../shared/components/ui/StatusBadge';
import Modal from '../../../shared/components/ui/Modal';
import { SearchInput, FilterDropdown, ExportButton, Pagination } from '../../../shared/components/ui/inputs';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import { ErrorState } from '../../../shared/components/ui/states';
import { useFetch } from '../../../shared/hooks/useFetch';
import { useTableControls } from '../../../shared/hooks/useSearchSort';
import { useToast } from '../../../app/providers/ToastContext';
import { dataService } from '../../../platform/data/dataService';
import { exportCsv } from '../../../shared/services/exportService';
import { mockBatches } from '../../../shared/data/mockData';
import type { Medicine } from '../../../shared/types';

const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

type Row = {
  id: string; name: string; genericName: string; category: string; dosageForm: string;
  batches: number; totalQty: number; status: string;
} & Record<string, unknown>;

export default function MedicineCatalog() {
  const { toast } = useToast();
  const medicinesQ = useFetch<Medicine[]>(() => dataService.getMedicines());
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', genericName: '', category: 'Other', dosageForm: '', strength: '' });
  const [saving, setSaving] = useState(false);

  const rows: Row[] = useMemo(() => {
    const meds = medicinesQ.data ?? [];
    return meds.map((m) => {
      const bs = mockBatches.filter((b) => b.medicineId === m.id);
      const hasActive = bs.some((b) => b.status === 'active');
      return {
        id: m.id, name: m.name, genericName: m.genericName, category: m.category,
        dosageForm: `${m.dosageForm}${m.strength ? ` · ${m.strength}` : ''}`,
        batches: bs.length,
        totalQty: bs.reduce((s, b) => s + b.availableQuantity, 0),
        status: hasActive ? 'active' : bs.length ? 'depleted' : 'active',
      };
    }).filter((r) => (category === 'all' || r.category === category));
  }, [medicinesQ.data, category]);

  const filtered = useMemo(
    () => rows.filter((r) => statusFilter === 'all' || r.status === statusFilter),
    [rows, statusFilter],
  );

  const tc = useTableControls<Row>(filtered, ['name', 'genericName', 'category']);

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Medicine', sortable: true, render: (r) => (
      <div>
        <p className="font-medium text-slate-800">{r.name}</p>
        <p className="text-xs text-slate-400">{r.genericName}</p>
      </div>
    )},
    { key: 'category', header: 'Category', sortable: true },
    { key: 'dosageForm', header: 'Form / Strength', hideOnMobile: true },
    { key: 'batches', header: 'Batches', sortable: true, className: 'text-center' },
    { key: 'totalQty', header: 'Total Quantity', sortable: true, render: (r) => r.totalQty.toLocaleString('en-IN') },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'Actions', hideOnMobile: true,
      render: (r) => (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => toast(`Viewing ${r.name} (prototype).`, 'info')} aria-label={`View ${r.name}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"><Eye size={15} /></button>
          <button type="button" onClick={() => toast(`Edit ${r.name} — use Data Entry to register a new batch with updated details.`, 'info')} aria-label={`Edit ${r.name}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={15} /></button>
          <button type="button" onClick={() => setConfirmDelete(r)} aria-label={`Delete ${r.name}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
          <button type="button" onClick={() => toast(`${r.batches} batches for ${r.name}.`, 'info')} aria-label={`View batches of ${r.name}`} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"><Boxes size={15} /></button>
        </div>
      ),
    },
  ];

  if (medicinesQ.error && !medicinesQ.loading) return <ErrorState message={medicinesQ.error} onRetry={medicinesQ.retry} />;

  return (
    <>
      <PageHeader
        title="Medicine Catalog"
        subtitle="Registered medicines with batch availability and stock totals"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Medicine Catalog' }]}
        actions={
          <>
            <ExportButton onExport={() => exportCsv('medicine-catalog', ['Name', 'Generic', 'Category', 'Batches', 'Total Qty', 'Status'], filtered.map((r) => [r.name, r.genericName, r.category, r.batches, r.totalQty, r.status]))} />
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              <Plus size={15} aria-hidden="true" /> Add Medicine
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={tc.query} onChange={(v) => { tc.setQuery(v); tc.setPage(1); }} placeholder="Search medicines…" label="Search medicines" />
        <FilterDropdown label="Category" value={category} onChange={(v) => { setCategory(v); tc.setPage(1); }}
          options={[{ value: 'all', label: 'All categories' }, ...[...new Set(rows.map((r) => r.category))].map((c) => ({ value: c, label: c }))]} />
        <FilterDropdown label="Status" value={statusFilter} onChange={(v) => { setStatusFilter(v); tc.setPage(1); }}
          options={[{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'depleted', label: 'Depleted' }]} />
      </div>

      <DataTable
        columns={columns}
        rows={tc.paged}
        rowKey={(r) => r.id}
        sortKey={tc.sortKey} sortDir={tc.sortDir} onSort={tc.toggleSort}
        loading={medicinesQ.loading}
        emptyMessage="No medicines match your filters"
        emptyAction={<button type="button" onClick={() => { tc.setQuery(''); setCategory('all'); setStatusFilter('all'); }} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Clear filters</button>}
      />
      <Pagination page={tc.page} totalPages={tc.totalPages} onPage={tc.setPage} total={tc.totalFiltered} unit="medicines" />

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete medicine?"
        message={`This will remove "${confirmDelete?.name}" from the catalog. Medicines with existing batches cannot be deleted.`}
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (!target) return;
          const res = await dataService.deleteMedicine(target.id);
          if (res.ok) {
            toast(`${target.name} removed from the catalog.`, 'success');
            medicinesQ.refetch();
          } else {
            toast(res.error || 'Delete failed.', 'error');
          }
        }}
      />

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add medicine to catalog">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (form.name.trim().length < 2) {
              toast('Medicine name is required (min 2 characters).', 'error');
              return;
            }
            setSaving(true);
            const res = await dataService.createMedicine({
              name: form.name.trim(),
              genericName: form.genericName.trim(),
              category: form.category,
              dosageForm: form.dosageForm.trim(),
              strength: form.strength.trim(),
            });
            setSaving(false);
            if (!res.ok) {
              toast(res.error, 'error');
              return;
            }
            setAddOpen(false);
            setForm({ name: '', genericName: '', category: 'Other', dosageForm: '', strength: '' });
            toast(`${form.name.trim()} added to the catalog — create its first batch in Data Entry.`, 'success');
            medicinesQ.refetch();
          }}
          noValidate
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Medicine name *</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Paracetamol" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Generic name</span>
            <input value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} className={inputCls} placeholder="e.g. Acetaminophen" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {['Analgesic', 'Antibiotic', 'Antihistamine', 'Antidiabetic', 'NSAID', 'PPI', 'Supplement', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Dosage form</span>
              <input value={form.dosageForm} onChange={(e) => setForm({ ...form, dosageForm: e.target.value })} className={inputCls} placeholder="Tablet" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Strength</span>
              <input value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} className={inputCls} placeholder="500mg" />
            </label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add medicine'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
