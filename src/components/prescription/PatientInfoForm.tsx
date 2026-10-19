// ---------------------------------------------------------------------------
// PatientInfoForm — RHF+Zod form; collects the minimum necessary information.
// Role-specific labels: hospital shows "Patient reference ID" + Department.
// ---------------------------------------------------------------------------

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import type { PrescriptionFormData, PrescriptionRoleAccess } from '../../types/prescription';
import { Spinner } from '../ui/states';

const scannerSchema = z.object({
  patientReference: z.string().min(1, 'Patient reference is required'),
  patientName: z.string().optional(),
  patientAge: z.coerce.number({ invalid_type_error: 'Age is required' })
    .int('Age must be a whole number').min(0, 'Age cannot be negative').max(120, 'Age looks incorrect'),
  patientGender: z.enum(['female', 'male', 'other', '']).optional(),
  knownAllergies: z.string().optional(),
  existingConditions: z.string().optional(),
  currentMedicines: z.string().optional(),
  prescriptionDate: z.string().min(1, 'Prescription date is required'),
  prescriberName: z.string().optional(),
  department: z.string().optional(),
});

type ScannerValues = z.infer<typeof scannerSchema>;

interface PatientInfoFormProps {
  role: PrescriptionRoleAccess;
  analyzing: boolean;
  /** Prefill when hydrating a record from history (falls back to demo ref). */
  initialReference?: string | null;
  onSubmit: (values: PrescriptionFormData) => void;
}

export default function PatientInfoForm({ role, analyzing, initialReference, onSubmit }: PatientInfoFormProps) {
  const isHospital = role === 'hospital';
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<ScannerValues>({
    resolver: zodResolver(scannerSchema),
    defaultValues: {
      patientReference: initialReference ?? (isHospital ? 'HOSP-DEMO-0001' : 'CUST-DEMO-0001'),
      patientAge: 34,
      prescriptionDate: new Date().toISOString().slice(0, 10),
      patientGender: '',
    },
  });

  const submit = handleSubmit((values: ScannerValues) => {
    onSubmit({
      patientReference: values.patientReference,
      patientName: values.patientName,
      patientAge: values.patientAge,
      patientGender: values.patientGender || '',
      knownAllergies: values.knownAllergies,
      existingConditions: values.existingConditions,
      currentMedicines: values.currentMedicines,
      prescriptionDate: values.prescriptionDate,
      prescriberName: values.prescriberName,
      department: isHospital ? values.department : undefined,
    });
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="rx-info-heading">
      <h2 id="rx-info-heading" className="text-base font-semibold text-slate-900">
        {isHospital ? 'Patient and prescription information' : 'Customer or patient reference'}
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">Minimum necessary information only. Synthetic demo patients only.</p>

      <form onSubmit={submit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={isHospital ? 'Patient reference ID' : 'Customer or patient reference'} required error={errors.patientReference?.message}>
          <input {...register('patientReference')} className={inputCls} aria-required="true" />
        </Field>
        <Field label="Patient name (optional)" error={errors.patientName?.message}>
          <input {...register('patientName')} className={inputCls} />
        </Field>
        <Field label="Patient age" required error={errors.patientAge?.message}>
          <input {...register('patientAge')} type="number" min={0} max={120} className={inputCls} aria-required="true" />
        </Field>
        <Field label="Gender (optional)">
          <select {...register('patientGender')} className={inputCls}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Known allergies (optional)" hint="Comma-separated, e.g. penicillin, sulfa">
          <input {...register('knownAllergies')} className={inputCls} />
        </Field>
        <Field label="Existing conditions (optional)">
          <input {...register('existingConditions')} className={inputCls} />
        </Field>
        <Field label="Current medicines (optional)" hint="Try adding “warfarin” to see a demo critical interaction">
          <input {...register('currentMedicines')} className={inputCls} />
        </Field>
        <Field label="Prescription date" required error={errors.prescriptionDate?.message}>
          <input {...register('prescriptionDate')} type="date" className={inputCls} aria-required="true" />
        </Field>
        <Field label="Prescriber name (optional)">
          <input {...register('prescriberName')} className={inputCls} />
        </Field>
        {isHospital && (
          <Field label="Department (hospital only)">
            <input {...register('department')} className={inputCls} placeholder="e.g. General Medicine" />
          </Field>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={analyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {analyzing ? <Spinner className="text-white" /> : <ShieldCheck size={16} aria-hidden="true" />}
            Analyze Prescription
          </button>
        </div>
      </form>
    </section>
  );
}

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
