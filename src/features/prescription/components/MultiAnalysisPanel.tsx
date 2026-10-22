// ---------------------------------------------------------------------------
// MultiAnalysisPanel — "Re-analyze with another AI" feature.
//
// Shows after a successful first analysis:
//   1. A button to trigger re-analysis with a selectable AI provider.
//   2. A provider-selector (only configured/available providers shown).
//   3. Side-by-side comparison after re-analysis completes.
//   4. Analysis history timeline for the current prescription.
//
// Rules enforced here:
//   - The original first analysis is NEVER overwritten or silently discarded.
//   - Disagreements are explicitly marked "NEEDS VERIFICATION" — never auto-resolved.
//   - No mock data: every result comes from the real backend.
//   - Credentials are never shown or requested.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  GitCompare, Loader2, RefreshCw, ShieldAlert, Sparkles,
} from 'lucide-react';
import type { AnalysisComparison, AnalysisHistoryEntry, AvailableProvider } from '../types/prescription';
import { getAvailableProviders, reanalyzeWithProvider } from '../../../platform/api/backendSync';
import StatusBadge from '../../../shared/components/ui/StatusBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MultiAnalysisPanelProps {
  /** Server-side prescription ID (e.g. PRX-1234). */
  serverId: string | null;
  /** The original file object — re-sent verbatim to the second provider. */
  file: File | null;
  /** Label for the FIRST analysis provider. */
  firstProviderLabel: string;
  /** Existing re-analysis history (from the server record). */
  analysisHistory?: AnalysisHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function ProviderBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
      <Sparkles size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

function FieldStatusBadge({ status }: { status: 'match' | 'needs_verification' }) {
  if (status === 'match') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={10} aria-hidden="true" /> MATCH
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <AlertTriangle size={10} aria-hidden="true" /> NEEDS VERIFICATION
    </span>
  );
}

function ComparisonTable({
  comparison,
  firstLabel,
  secondLabel,
}: {
  comparison: AnalysisComparison;
  firstLabel: string;
  secondLabel: string;
}) {
  const { fields, summary } = comparison;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm">
        <GitCompare size={15} className="text-slate-500" aria-hidden="true" />
        <span className="font-semibold text-slate-800">Comparison summary</span>
        <span className="text-slate-500">{summary.matched} / {summary.totalFields} fields match</span>
        {summary.disagreements > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            <ShieldAlert size={11} aria-hidden="true" />
            {summary.disagreements} field{summary.disagreements !== 1 ? 's' : ''} need{summary.disagreements === 1 ? 's' : ''} verification
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={11} aria-hidden="true" /> Full agreement
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">{summary.agreementPercent}% agreement</span>
      </div>

      {summary.disagreements > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          <strong>Fields marked "NEEDS VERIFICATION" disagree between the two providers.</strong>{' '}
          Review each field against the original prescription image and confirm the correct value.
          Neither provider's value is automatically preferred.
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Field</th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-indigo-600">AI 1 — {firstLabel}</th>
              <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-violet-600">AI 2 — {secondLabel}</th>
              <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((f, i) => {
              const rowBg = f.status === 'needs_verification' ? 'bg-amber-50/50' : '';
              const val1 = f.ai1 !== null && f.ai1 !== '' ? String(f.ai1) : '—';
              const val2 = f.ai2 !== null && f.ai2 !== '' ? String(f.ai2) : '—';
              return (
                <tr key={i} className={rowBg}>
                  <td className="px-3 py-2 font-medium text-slate-700">{f.label}</td>
                  <td className={`px-3 py-2 text-slate-800 ${f.status === 'needs_verification' ? 'font-semibold text-indigo-700' : ''}`}>{val1}</td>
                  <td className={`px-3 py-2 text-slate-800 ${f.status === 'needs_verification' ? 'font-semibold text-violet-700' : ''}`}>{val2}</td>
                  <td className="px-3 py-2 text-center">
                    <FieldStatusBadge status={f.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryTimeline({ history, firstProviderLabel }: { history: AnalysisHistoryEntry[]; firstProviderLabel: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analysis history</h4>
      <ol className="space-y-1.5">
        {/* Attempt 1 — always the first analysis */}
        <li className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">1</span>
          <div>
            <span className="font-semibold text-slate-800">Attempt 1</span>
            <span className="mx-1.5 text-slate-400">→</span>
            <ProviderBadge label={firstProviderLabel} />
            <span className="ml-2 text-xs text-slate-400">(primary analysis)</span>
          </div>
        </li>
        {history.map((entry) => (
          <li key={entry.attemptNumber} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
              {entry.attemptNumber}
            </span>
            <div>
              <span className="font-semibold text-slate-800">Attempt {entry.attemptNumber}</span>
              <span className="mx-1.5 text-slate-400">→</span>
              <ProviderBadge label={entry.providerLabel} />
              <span className="ml-2 text-xs text-slate-400">
                {entry.medicineCount} medicine{entry.medicineCount !== 1 ? 's' : ''}
                {' · '}{(entry.overallConfidence * 100).toFixed(0)}% confidence
                {' · '}{new Date(entry.analyzedAt).toLocaleTimeString()}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function MultiAnalysisPanel({
  serverId,
  file,
  firstProviderLabel,
  analysisHistory: initialHistory = [],
}: MultiAnalysisPanelProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<AnalysisComparison | null>(null);
  const [latestEntry, setLatestEntry] = useState<AnalysisHistoryEntry | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>(initialHistory);
  const fetchedRef = useRef(false);

  // Sync history from parent (for initial load from server record)
  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  // Load providers when panel opens
  useEffect(() => {
    if (!open || !serverId || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingProviders(true);
    getAvailableProviders(serverId).then((list) => {
      setProviders(list);
      if (list.length > 0) setSelectedProvider(list[0].id);
      setLoadingProviders(false);
    });
  }, [open, serverId]);

  const handleReanalyze = useCallback(async () => {
    if (!serverId || !file || !selectedProvider) return;
    setRunning(true);
    setError(null);
    setComparison(null);
    setLatestEntry(null);

    const result = await reanalyzeWithProvider(serverId, file, selectedProvider);

    if (!result.ok) {
      setError(result.error);
      setRunning(false);
      return;
    }

    setLatestEntry(result.reanalysis);
    setComparison(result.comparison);
    setHistory((prev) => {
      // Avoid duplicating if server already included this entry
      const exists = prev.some((e) => e.attemptNumber === result.reanalysis.attemptNumber);
      return exists ? prev : [...prev, result.reanalysis];
    });
    setRunning(false);
  }, [serverId, file, selectedProvider]);

  if (!serverId || !file) return null;

  const selectedProviderLabel = providers.find((p) => p.id === selectedProvider)?.label ?? selectedProvider;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="multi-ai-heading">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 rounded-2xl"
        aria-expanded={open}
      >
        <GitCompare size={17} className="shrink-0 text-indigo-600" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="multi-ai-heading" className="text-base font-semibold text-slate-900">
            Re-analyze with another AI
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Send the same prescription image to a different AI and compare the results field-by-field.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {history.length > 0 && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              {history.length} re-analysis
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">
          {/* History timeline */}
          {history.length > 0 && (
            <HistoryTimeline history={history} firstProviderLabel={firstProviderLabel} />
          )}

          {/* Provider selector + run button */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Select AI provider</h3>

            {loadingProviders && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                Loading configured providers…
              </p>
            )}

            {!loadingProviders && providers.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                No additional AI providers are configured on the server. Add credentials to <code className="font-mono">.env</code> to enable more providers.
              </p>
            )}

            {!loadingProviders && providers.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProvider(p.id)}
                      aria-pressed={selectedProvider === p.id}
                      className={`inline-flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                        selectedProvider === p.id
                          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className={`font-semibold ${selectedProvider === p.id ? 'text-indigo-700' : 'text-slate-800'}`}>
                        {p.label}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">{p.model}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleReanalyze}
                    disabled={running || !selectedProvider}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {running
                      ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Analyzing…</>
                      : <><RefreshCw size={14} aria-hidden="true" /> Re-analyze with {selectedProviderLabel}</>}
                  </button>

                  <p className="text-xs text-slate-500">
                    The original prescription image will be sent to {selectedProviderLabel}.
                    The primary analysis result will not be changed.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-red-900">Re-analysis failed</p>
                <p className="mt-0.5 text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Latest result summary */}
          {latestEntry && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                {/* First analysis card */}
                <div className="flex-1 min-w-[200px] rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">First analysis</p>
                  <p className="mt-1 font-semibold text-slate-800">{firstProviderLabel}</p>
                </div>

                {/* Second analysis card */}
                <div className="flex-1 min-w-[200px] rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">Second analysis</p>
                  <p className="mt-1 font-semibold text-slate-800">{latestEntry.providerLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {latestEntry.medicineCount} medicine{latestEntry.medicineCount !== 1 ? 's' : ''}
                    {' · '}{(latestEntry.overallConfidence * 100).toFixed(0)}% confidence
                  </p>
                  {latestEntry.warnings.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {latestEntry.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Medicines side-by-side */}
              {latestEntry.medicines.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-500 mb-2">
                    Medicines extracted by {latestEntry.providerLabel}
                  </h4>
                  <div className="space-y-2">
                    {latestEntry.medicines.map((m) => (
                      <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.needsVerification ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{m.name ?? <em className="text-amber-700">unclear</em>}</span>
                          {m.needsVerification && (
                            <StatusBadge status="Needs verification" tone="warning" />
                          )}
                          <span className="ml-auto text-xs text-slate-400">{(m.confidence * 100).toFixed(0)}% confidence</span>
                        </div>
                        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-3">
                          {m.strength && <><dt className="text-slate-400">Strength</dt><dd className="text-slate-700">{m.strength}</dd></>}
                          {m.dosage && <><dt className="text-slate-400">Dosage</dt><dd className="text-slate-700">{m.dosage}</dd></>}
                          {m.frequency && <><dt className="text-slate-400">Frequency</dt><dd className="text-slate-700">{m.frequency}</dd></>}
                          {m.duration && <><dt className="text-slate-400">Duration</dt><dd className="text-slate-700">{m.duration}</dd></>}
                          {m.route && <><dt className="text-slate-400">Route</dt><dd className="text-slate-700">{m.route}</dd></>}
                        </dl>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Field comparison table */}
          {comparison && latestEntry && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Field-by-field comparison</h3>
              <ComparisonTable
                comparison={comparison}
                firstLabel={firstProviderLabel}
                secondLabel={latestEntry.providerLabel}
              />
            </div>
          )}

          {/* Confirmation note */}
          {(latestEntry || comparison) && (
            <p className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
              <strong>Next step:</strong> Review any fields marked "NEEDS VERIFICATION" against the original prescription image.
              Correct the values in the medicine cards above, then use the Pharmacist Review panel to confirm before blockchain registration.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
