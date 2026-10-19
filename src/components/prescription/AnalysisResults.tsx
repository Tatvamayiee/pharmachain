// ---------------------------------------------------------------------------
// AnalysisResults — stepper while running; session banner, mock OCR text,
// editable medicine cards (with Reset corrections) and disclaimer when done.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { FileText, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import type { PrescriptionAnalysis, PrescriptionMedicine } from '../../types/prescription';
import { ANALYSIS_STEPS, PROTOTYPE_LABELS } from '../../services/prescriptionService';
import StatusBadge from '../ui/StatusBadge';
import { Spinner } from '../ui/states';
import { MATCH_LABEL } from './shared';

// ------------------------------ Stepper -------------------------------------

export function AnalysisStepper({ current }: { current: number }) {
  return (
    <ol className="space-y-2.5" aria-label="Analysis progress">
      {ANALYSIS_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-center gap-3 text-sm" aria-current={active ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                done ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : active ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-400'}`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={done ? 'text-slate-500' : active ? 'font-medium text-indigo-700' : 'text-slate-400'}>
              {s.label}
            </span>
            {active && <Spinner className="text-indigo-500" />}
          </li>
        );
      })}
    </ol>
  );
}

// -------------------------- Medicine result card ----------------------------

const MED_TEXT_FIELDS: { key: keyof PrescriptionMedicine; label: string }[] = [
  { key: 'extractedName', label: 'Medicine name' },
  { key: 'strength', label: 'Strength' },
  { key: 'dosage', label: 'Dosage' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'duration', label: 'Duration' },
  { key: 'route', label: 'Route' },
  { key: 'quantity', label: 'Quantity' },
];

function MedicineResultCard({ med, editing, onToggleEdit, onChange }: {
  med: PrescriptionMedicine;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: (patch: Record<string, string>) => void;
}) {
  const tone =
    med.match.status === 'matched' ? 'success'
    : med.match.status === 'possible_match' ? 'warning'
    : med.match.status === 'needs_review' ? 'purple' : 'error';
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <FileText size={16} className="text-indigo-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-800">{med.extractedName}</span>
        <StatusBadge status={MATCH_LABEL[med.match.status]} tone={tone} />
        <span className="ml-auto text-xs text-slate-400">OCR confidence {(med.confidence * 100).toFixed(0)}%</span>
        <button
          type="button"
          onClick={onToggleEdit}
          aria-pressed={editing}
          aria-label={`${editing ? 'Close' : 'Open'} correction editor for ${med.extractedName}`}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
            editing ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <Pencil size={12} aria-hidden="true" /> {editing ? 'Close' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {MED_TEXT_FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="mb-0.5 block text-xs font-medium text-slate-500">{label}</span>
              <input
                value={String(med[key] ?? '')}
                onChange={(e) => onChange({ [key]: e.target.value })}
                aria-label={`Correct ${label} for ${med.extractedName}`}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          ))}
        </div>
      ) : (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-400">Matched name</dt><dd className="text-slate-700">{med.match.matchedName ?? '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Generic</dt><dd className="text-slate-700">{med.match.genericName ?? '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Brand</dt><dd className="text-slate-700">{med.match.brandName ?? '—'}</dd></div>
          <div><dt className="text-xs text-slate-400">Strength</dt><dd className="text-slate-700">{med.strength}</dd></div>
          <div><dt className="text-xs text-slate-400">Dosage</dt><dd className="text-slate-700">{med.dosage}</dd></div>
          <div><dt className="text-xs text-slate-400">Route</dt><dd className="text-slate-700">{med.route}</dd></div>
          <div><dt className="text-xs text-slate-400">Frequency</dt><dd className="text-slate-700">{med.frequency}</dd></div>
          <div><dt className="text-xs text-slate-400">Duration</dt><dd className="text-slate-700">{med.duration}</dd></div>
          <div><dt className="text-xs text-slate-400">Quantity</dt><dd className="text-slate-700">{med.quantity}</dd></div>
        </dl>
      )}

      {med.match.manualVerificationRequired && (
        <p className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Manual verification required — please verify this medicine manually.
        </p>
      )}
    </article>
  );
}

// ------------------------------ Results section -----------------------------

interface AnalysisResultsProps {
  analysis: PrescriptionAnalysis;
  analysisRecordId: string | null;
  savedDraft: boolean;
  draftPharmacist: string | null;
  correctionsDirty: boolean;
  historyPath: string;
  /** 'server' = real AI extraction (Hugging Face via backend); 'local' = prototype. */
  source?: 'server' | 'local';
  onUpdateMedicine: (medId: string, patch: Record<string, string>) => void;
  onResetCorrections: () => void;
}

export default function AnalysisResults({
  analysis, analysisRecordId, savedDraft, draftPharmacist, correctionsDirty,
  historyPath, source = 'local', onUpdateMedicine, onResetCorrections,
}: AnalysisResultsProps) {
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  // Workflow thresholds only — NOT medical accuracy percentages.
  const confidenceBand = analysis.confidence >= 0.85 ? 'normal' : analysis.confidence >= 0.6 ? 'verify' : 'low';

  return (
    <div className="space-y-4">
      {analysisRecordId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            Reviewing <span className="font-semibold font-mono">{analysisRecordId}</span> from this session
            {savedDraft ? ` — draft saved${draftPharmacist ? ` by ${draftPharmacist}` : ''}` : ' — not saved yet'}
          </span>
          <a
            href={historyPath}
            className="ml-auto text-xs font-semibold text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
            onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', historyPath); window.dispatchEvent(new PopStateEvent('popstate')); }}
          >
            Back to history
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Extracted prescription text</h3>
        {source === 'server'
          ? <StatusBadge status="AI-assisted extraction — verification required" tone="info" />
          : <StatusBadge status={PROTOTYPE_LABELS.ocrLabel} tone="warning" />}
        <span className="ml-auto text-xs text-slate-400">Overall confidence {(analysis.confidence * 100).toFixed(0)}%</span>
      </div>
      {source === 'server' && confidenceBand !== 'normal' && (
        <p role="note" className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${confidenceBand === 'low' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {confidenceBand === 'low'
            ? 'Low confidence — manual verification required.'
            : 'Please verify the extracted fields against the original prescription.'}
        </p>
      )}
      <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 font-mono text-xs leading-relaxed text-slate-700">{analysis.ocrText}</pre>

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Extracted medicines ({analysis.medicines.length})</h3>
        {correctionsDirty && <StatusBadge status="corrected" tone="purple" />}
        <button
          type="button"
          onClick={() => { onResetCorrections(); setEditingMedId(null); }}
          disabled={!correctionsDirty}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <RotateCcw size={12} aria-hidden="true" /> Reset corrections
        </button>
      </div>
      <div className="space-y-3">
        {analysis.medicines.map((m) => (
          <MedicineResultCard
            key={m.id}
            med={m}
            editing={editingMedId === m.id}
            onToggleEdit={() => setEditingMedId((cur) => (cur === m.id ? null : m.id))}
            onChange={(patch) => onUpdateMedicine(m.id, patch)}
          />
        ))}
      </div>
    </div>
  );
}
