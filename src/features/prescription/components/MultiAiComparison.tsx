// ---------------------------------------------------------------------------
// Multi-AI Analysis Comparison UI
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Bot, Check, GitCompare, ShieldAlert, Sparkles } from 'lucide-react';
import type { PrescriptionAnalysis } from '../types/prescription';

export interface MultiAnalysisResult {
  provider: string;
  providerLabel: string;
  status?: string;
  error?: string;
  analysis?: PrescriptionAnalysis;
}

export interface MultiAnalysisData {
  enabled: boolean;
  providersUsed: string[];
  results: MultiAnalysisResult[];
  comparison: {
    differences: Array<{ field: string; description: string }>;
    matches: Array<{ field: string; value: unknown; providers: string[] }>;
    needsVerification: Array<{
      field: string;
      first: { value: unknown; provider: string };
      second: { value: unknown; provider: string };
    }>;
  };
}

export interface MultiAnalysisComparisonProps {
  data: MultiAnalysisData;
  onReanalyze: (provider: string) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
      <Bot size={11} aria-hidden="true" /> {provider}
    </span>
  );
}

function ComparisonTable({ data }: { data: MultiAnalysisData }) {
  const results = data.results.filter(r => r.analysis);
  if (results.length < 2) return null;

  const fields = [
    { label: 'Medicine name', get: (a: PrescriptionAnalysis) => a.medicines[0]?.extractedName ?? '' },
    { label: 'Strength', get: (a: PrescriptionAnalysis) => a.medicines[0]?.strength ?? '' },
    { label: 'Dosage', get: (a: PrescriptionAnalysis) => a.medicines[0]?.dosage ?? '' },
    { label: 'Frequency', get: (a: PrescriptionAnalysis) => a.medicines[0]?.frequency ?? '' },
    { label: 'Duration', get: (a: PrescriptionAnalysis) => a.medicines[0]?.duration ?? '' },
    { label: 'Doctor', get: (a: PrescriptionAnalysis) => (a as PrescriptionAnalysis & { doctor?: { name?: string } }).doctor?.name ?? '' },
    { label: 'Patient', get: (a: PrescriptionAnalysis) => (a as PrescriptionAnalysis & { patient?: { name?: string } }).patient?.name ?? '' },
    { label: 'Date', get: (a: PrescriptionAnalysis) => (a as PrescriptionAnalysis & { date?: string }).date ?? '' },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Field</th>
            {results.map((r) => (
              <th key={r.provider} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">
                {r.providerLabel}
              </th>
            ))}
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(({ label, get }) => {
            const values = results.map(r => get(r.analysis!));
            const isMatch = values.every(v => v === values[0]);
            const isUnclear = values.some(v => !v || String(v).toLowerCase() === 'unclear');
            const status = isUnclear ? 'needs-verification' : isMatch ? 'match' : 'needs-verification';
            return (
              <tr key={label} className={status === 'needs-verification' ? 'bg-amber-50/50' : 'border-b border-slate-100 last:border-0'}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{label}</td>
                {values.map((v, i) => (
                  <td key={i} className="px-4 py-2.5 text-slate-700">
                    {formatValue(v)}
                    {status === 'needs-verification' && !isUnclear && i > 0 && (
                      <span className="ml-1.5 inline-block rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-800">DIFF</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5">
                  {status === 'match' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Check size={12} aria-hidden="true" /> MATCH
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                      <ShieldAlert size={12} aria-hidden="true" /> NEEDS VERIFICATION
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MultiAiComparison({ data, onReanalyze }: MultiAnalysisComparisonProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  if (!data.enabled || data.results.length === 0) return null;

  const completedResults = data.results.filter(r => r.analysis);
  const availableForReanalysis = data.results.filter(r => !r.analysis);

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-sm" aria-labelledby="multi-ai-heading">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <GitCompare size={18} className="text-indigo-600" aria-hidden="true" />
          <h2 id="multi-ai-heading" className="text-base font-semibold text-slate-900">Multi-AI Analysis</h2>
        </div>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          {data.results.length} provider{data.results.length === 1 ? '' : 's'} analyzed
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.results.map((r) => (
          <article key={r.provider} className="rounded-xl border border-indigo-100 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <ProviderBadge provider={r.providerLabel} />
                  {r.analysis && <span className="text-xs text-emerald-700">✓ completed</span>}
                  {!r.analysis && r.error && <span className="text-xs text-red-700">✗ failed</span>}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {r.analysis
                    ? `${r.analysis.medicines.length} medicine${r.analysis.medicines.length === 1 ? '' : 's'} extracted`
                    : r.error || 'Analysis failed'}
                </p>
              </div>
              {r.analysis && (
                <span className="text-xs text-slate-400">
                  {(r.analysis.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            {r.error && <p className="mt-2 text-xs text-red-600">{r.error}</p>}
          </article>
        ))}
      </div>

      {completedResults.length >= 2 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Comparison</h3>
          <ComparisonTable data={{ ...data, results: completedResults }} />
          {data.comparison.needsVerification.length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <ShieldAlert size={13} aria-hidden="true" />
              {data.comparison.needsVerification.length} field(s) need human verification before confirmation.
            </p>
          )}
        </div>
      )}

      {availableForReanalysis.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Re-analyze with another AI</h3>
          <div className="flex flex-wrap gap-2">
            {availableForReanalysis.map((r) => (
              <button
                key={r.provider}
                type="button"
                onClick={() => {
                  setSelectedProvider(r.provider);
                  onReanalyze(r.provider);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <Sparkles size={12} aria-hidden="true" />
                {selectedProvider === r.provider ? 'Analyzing…' : `Analyze with ${r.providerLabel}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {data.results.length >= 2 && (
        <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          <ShieldAlert size={13} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            Results are shown side by side for human review. No provider is automatically selected as the winner —
            verify disagreements against the original prescription before confirming.
          </span>
        </p>
      )}
    </section>
  );
}
