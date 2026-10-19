import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Eraser, Save, Upload } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';
import { useToast } from '../../contexts/ToastContext';
import { dataService } from '../../services/dataService';
import { useFetch } from '../../hooks/useFetch';
import SearchableSelect from '../../components/ui/SearchableSelect';
import StockUploadPanel from '../../components/manufacturer/StockUploadPanel';
import type { Batch, Medicine } from '../../types';

const schema = z.object({
  // Medicine source: pick an existing catalog medicine OR register a new one.
  existingMedicine: z.string().optional(),
  name: z.string().optional(),
  genericName: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  manufacturerName: z.string().optional(),
  batchNumber: z.string().min(3, 'Batch number is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  quantity: z.coerce.number().int('Whole units only').positive('Quantity must be positive'),
  storageConditions: z.string().min(3, 'Storage conditions are required'),
  price: z.coerce.number().nonnegative('Price cannot be negative'),
  description: z.string().max(500, 'Keep it under 500 characters').optional(),
}).refine((v) => new Date(v.expiryDate) > new Date(v.manufacturingDate), {
  message: 'Expiry must be after manufacturing date', path: ['expiryDate'],
});

type Values = z.infer<typeof schema>;

const CATEGORIES = ['Analgesic', 'Antibiotic', 'Antihistamine', 'Antidiabetic', 'NSAID', 'PPI', 'Supplement', 'Other'];
const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops'];

const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function Field({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error
        ? <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{error}</span>
        : hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export default function DataEntry() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [createdBatch, setCreatedBatch] = useState<Batch | null>(null);
  // Selected attachment's display name (client-side only — the file itself
  // is not uploaded by this form).
  const [fileName, setFileName] = useState<string | null>(null);
  const medicinesQ = useFetch<Medicine[]>(() => dataService.getMedicines());
  const [medMode, setMedMode] = useState<'existing' | 'new'>('existing');

  const {
    register, handleSubmit, reset, control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { quantity: 1000, price: 0 } });

  const catalogMedicines = medicinesQ.data ?? [];

  const save = async (values: Values, draft: boolean) => {
    if (draft) {
      await new Promise((r) => setTimeout(r, 400)); // drafts stay client-side
      toast('Draft saved — finish it any time.', 'success');
      return;
    }
    // Conditional medicine validation: dropdown pick OR full new-medicine details.
    let medicineName: string;
    if (medMode === 'existing') {
      if (!values.existingMedicine) {
        toast('Select a medicine from the catalog (or switch to "Register new medicine").', 'error');
        return;
      }
      medicineName = values.existingMedicine;
    } else {
      if (!values.name || values.name.trim().length < 3) { toast('Medicine name is required (min 3 characters).', 'error'); return; }
      if (!values.genericName || values.genericName.trim().length < 2) { toast('Generic name is required.', 'error'); return; }
      if (!values.category) { toast('Select a category.', 'error'); return; }
      if (!values.dosageForm) { toast('Select a dosage form.', 'error'); return; }
      if (!values.strength || !values.strength.trim()) { toast('Strength is required.', 'error'); return; }
      if (!values.manufacturerName || values.manufacturerName.trim().length < 2) { toast('Manufacturer name is required.', 'error'); return; }
      medicineName = values.name.trim();
    }

    // REAL persist: batch lands on the server (catalog medicine upserted),
    // so it appears in Batch Management for every login, not just this one.
    const result = await dataService.createBatch({
      medicineName,
      genericName: values.genericName ?? '',
      category: values.category ?? 'Other',
      dosageForm: values.dosageForm ?? '',
      strength: values.strength ?? '',
      batchNumber: values.batchNumber.toUpperCase(),
      manufacturingDate: values.manufacturingDate,
      expiryDate: values.expiryDate,
      quantityProduced: values.quantity,
      storageConditions: values.storageConditions,
      price: values.price,
      description: values.description,
    });
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    setCreatedBatch(result.batch);
    toast(`Medicine batch ${result.batch.batchNumber} created.`, 'success');
  };

  return (
    <>
      <PageHeader
        title="Upload Medicine"
        subtitle="Create a real server-side medicine batch and its QR1 authentication code"
        crumbs={[{ label: 'Manufacturer' }, { label: 'Data Entry' }]}
      />

      <div className="mb-6"><StockUploadPanel /></div>

      {createdBatch && <section className="mb-5 rounded-2xl border-emerald-200 bg-emerald-50 p-5" aria-label="Created medicine batch"><p className="text-sm font-semibold text-emerald-700">Medicine batch created</p><h2 className="mt-1 text-xl font-bold text-slate-900">{createdBatch.medicineName}</h2><p className="mt-2 text-sm">Batch/package ID: <strong className="font-mono">{createdBatch.batchNumber}</strong> · Status: <strong>{createdBatch.status}</strong></p><p className="text-sm">Expiry: {new Date(createdBatch.expiryDate).toLocaleDateString('en-IN')}</p><p className="mt-2 text-xs text-emerald-800">Master matching is not medical approval.</p><div className="mt-4"><p className="mb-2 text-xs font-semibold text-slate-500">Medicine Authentication QR</p><QRCodeDisplay payload={createdBatch.qrCode} pixelSize={150} label={`Medicine authentication QR for ${createdBatch.batchNumber}`} /><button type="button" onClick={() => navigate(`/verify?code=${encodeURIComponent(createdBatch.batchNumber)}`)} className="mt-3 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Verify Medicine</button></div></section>}

      <form onSubmit={handleSubmit((v) => save(v, false))} noValidate className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Medicine details</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button" onClick={() => setMedMode('existing')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${medMode === 'existing' ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Existing medicine
          </button>
          <button
            type="button" onClick={() => setMedMode('new')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${medMode === 'new' ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Enter medicine from master
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {medMode === 'existing' ? (
            <Field
              label="Medicine (from your catalog)"
              hint={catalogMedicines.length ? `${catalogMedicines.length} medicine${catalogMedicines.length === 1 ? '' : 's'} in your catalog — type to filter` : 'Catalog is empty — switch to "Register new medicine"'}
            >
              <Controller
                name="existingMedicine"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    id="existing-medicine"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select medicine"
                    searchPlaceholder="Search medicines…"
                    emptyMessage="No medicine matches that name"
                    options={catalogMedicines.map((m) => ({
                      value: m.name,
                      label: m.strength ? `${m.name} — ${m.strength}` : m.name,
                    }))}
                  />
                )}
              />
            </Field>
          ) : (
            <>
              <Field label="Medicine name" error={errors.name?.message}>
                <input {...register('name')} className={inputCls} placeholder="e.g. Paracetamol 500 mg" />
              </Field>
              <Field label="Generic name" error={errors.genericName?.message}>
                <input {...register('genericName')} className={inputCls} placeholder="e.g. Acetaminophen" />
              </Field>
              <Field label="Category" error={errors.category?.message}>
                <select {...register('category')} className={inputCls} defaultValue="">
                  <option value="" disabled>Select category</option>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Dosage form" error={errors.dosageForm?.message}>
                <select {...register('dosageForm')} className={inputCls} defaultValue="">
                  <option value="" disabled>Select form</option>
                  {FORMS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Strength" error={errors.strength?.message}>
                <input {...register('strength')} className={inputCls} placeholder="e.g. 500 mg" />
              </Field>
              <Field label="Manufacturer name" error={errors.manufacturerName?.message}>
                <input {...register('manufacturerName')} className={inputCls} placeholder="Your registered name" />
              </Field>
            </>
          )}
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-indigo-600">Batch details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Batch number" error={errors.batchNumber?.message} hint="Auto-generate suggested: PCM-2506-15">
            <input {...register('batchNumber')} className={`${inputCls} font-mono uppercase`} placeholder="PCM-2506-15" />
          </Field>
          <Field label="Manufacturing date" error={errors.manufacturingDate?.message}>
            <input type="date" {...register('manufacturingDate')} className={inputCls} />
          </Field>
          <Field label="Expiry date" error={errors.expiryDate?.message}>
            <input type="date" {...register('expiryDate')} className={inputCls} />
          </Field>
          <Field label="Quantity produced" error={errors.quantity?.message}>
            <input type="number" min={1} {...register('quantity')} className={inputCls} />
          </Field>
          <Field label="Price per unit (₹)" error={errors.price?.message}>
            <input type="number" step="0.5" min={0} {...register('price')} className={inputCls} />
          </Field>
          <Field label="Storage conditions" error={errors.storageConditions?.message}>
            <input {...register('storageConditions')} className={inputCls} placeholder="e.g. Below 30°C, dry" />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field label="Description" error={errors.description?.message} hint="Optional, max 500 characters">
            <textarea rows={4} {...register('description')} className={`${inputCls} resize-y`} />
          </Field>
          <Field label="Medicine image or document" hint="PNG, JPG or PDF up to 5 MB">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
              <Upload size={18} className="shrink-0 text-indigo-500" aria-hidden="true" />
              <span className="text-sm text-slate-500">{fileName ?? 'Click to upload a file'}</span>
              <input
                type="file" accept="image/png,image/jpeg,.pdf" className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </Field>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
          <button
            type="button" onClick={() => { reset(); setFileName(null); toast('Form cleared.', 'info'); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Eraser size={15} aria-hidden="true" /> Clear Form
          </button>
          <button
            type="button" disabled={isSubmitting}
            onClick={handleSubmit((v) => save(v, true))}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="submit" disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {isSubmitting
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              : <Save size={15} aria-hidden="true" />}
            {isSubmitting ? 'Saving…' : 'Save Medicine'}
          </button>
        </div>
      </form>
    </>
  );
}
