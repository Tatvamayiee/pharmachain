// ---------------------------------------------------------------------------
// ReanalyzeWorkflow — ONE cohesive 3-step workflow that replaces the previous
// stacked "Re-analyze with another AI" and "Parallel OCR + AI + ML" cards.
//
//   ① OCR ENGINE  →  ② AI MODEL  →  ③ RESULTS & COMPARISON
//
// Pure UI consolidation: identical backend calls (runParallelAnalysis,
// reanalyzeWithProvider, getAvailableProviders), identical data, no mock
// values, no behavior change. Compact horizontal layout, side-by-side
// selectors (desktop), centered run button, side-by-side result cards and a
// single compact ML comparison table. Status: ✓ Match / ⚠ Verify / ✕ Error.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Cpu, FileScan,
  Loader2, ScanText, ShieldAlert, XCircle, GitCompare, Clock,
} from 'lucide-react';
import type {
  AnalysisComparison, AnalysisHistoryEntry, AvailableProvider, ParallelAnalysisResult,
} from '../../types/prescription';
import { getAvailableProviders, getMlTrainingStatus, reanalyzeWithProvider, runParallelAnalysis, type MlTrainingStatus } from '../../services/backendSync';

// ---------------------------------------------------------------------------
// Tiny shared pieces
// ---------------------------------------------------------------------------

function StepBadge({ n, label, state }: { n: number; label: string; state?: 'done' | 'active' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
        state === 'done' ? 'bg-emerald-100 text-emerald-700'
          : state === 'active' ? 'bg-indigo-600 text-white'
          : 'bg-slate-100 text-slate-500'
      }`}>{n}</span>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${
        state === 'active' ? 'text-indigo-700' : 'text-slate-500'
      }`}>{label}</span>
    </span>
  );
}

function MatchBadge({ status }: { status: 'match' | 'needs_verification' }) {
  return status === 'match' ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
      <CheckCircle2 size={9} aria-hidden="true" /> Match
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
      <AlertTriangle size={9} aria-hidden="true" /> Verify
    </span>
  );
}

function Chip({
  label, sub, selected, onClick,
}: { label: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected}
      className={`rounded-lg border px-2.5 py-1 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
        selected ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className={`block font-semibold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>{label}</span>
      {sub && <span className="block truncate text-[9px] leading-tight text-slate-400">{sub}</span>}
    </button>
  );
}

function StatusPill({ status }: { status: 'running' | 'complete' | 'failed' | 'idle' }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
        <Loader2 size={9} className="animate-spin" aria-hidden="true" /> Running…
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        <CheckCircle2 size={9} aria-hidden="true" /> Complete
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
        <XCircle size={9} aria-hidden="true" /> Error
      </span>
    );
  }
  return <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Idle</span>;
}

/** One side (OCR / AI) of the results grid. */
function ResultColumn({
  kind, status, providerLabel, model, result, error,
}: {
  kind: 'ocr' | 'ai';
  status: 'running' | 'complete' | 'failed' | 'idle';
  providerLabel: string;
  model?: string;
  result?: ParallelAnalysisResult['ocr']['result'] | ParallelAnalysisResult['ai']['result'] | null;
  error?: string;
}) {
  const isOcr = kind === 'ocr';
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-1.5">
        {isOcr ? <ScanText size={13} className="text-sky-600" aria-hidden="true" /> : <Bot size={13} className="text-violet-600" aria-hidden="true" />}
        <h4 className="text-xs font-bold text-slate-900">{isOcr ? 'OCR Result' : 'AI Result'}</h4>
        <span className="ml-auto"><StatusPill status={status} /></span>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">{providerLabel}</span>
        {model ? <span className="ml-1 font-mono text-[10px] text-slate-400">{model}</span> : null}
      </p>

      {status === 'running' && (
        <div className="mt-2.5 space-y-1.5" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-3.5 animate-pulse rounded bg-slate-100" />)}
        </div>
      )}

      {status === 'failed' && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-red-800">{error || 'Pipeline failed.'}</p>
      )}

      {status === 'complete' && result && (
        <dl className="mt-2 space-y-1 text-[11px]">
          {result.medicines.length === 0 && (
            <p className="text-slate-500">No medicines extracted.</p>
          )}
          {result.medicines.map((m, i) => (
            <div key={i} className={`rounded-lg px-2 py-1 ${m.needsVerification ? 'bg-amber-50/60' : 'bg-slate-50/70'}`}>
              <dt className={`font-semibold ${m.needsVerification ? 'text-amber-900' : 'text-slate-800'}`}>
                {m.name ?? <em>unclear</em>}
              </dt>
              <dd className="mt-0.5 text-slate-600">
                {[m.strength, m.dosage, m.frequency, m.duration, m.route].filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {result && result.warnings.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-800">
          <AlertTriangle size={9} className="mt-0.5 shrink-0" aria-hidden="true" />
          {result.warnings[0]}
          {result.warnings.length > 1 && <span className="text-slate-400"> +{result.warnings.length - 1} more</span>}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main workflow
// ---------------------------------------------------------------------------

interface ReanalyzeWorkflowProps {
  serverId: string | null;
  file: File | null;
  firstProviderLabel: string;
  analysisHistory?: AnalysisHistoryEntry[];
}

export default function ReanalyzeWorkflow({
  serverId, file, analysisHistory: initialHistory = [],
}: ReanalyzeWorkflowProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [ocrProvider, setOcrProvider] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [data, setData] = useState<ParallelAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Legacy single-provider re-analysis history (preserved feature).
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>(initialHistory);
  const [legacyRunning, setLegacyRunning] = useState(false);
  const [legacyComparison, setLegacyComparison] = useState<AnalysisComparison | null>(null);
  const [showAllFields, setShowAllFields] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<MlTrainingStatus | null>(null);

  // Dataset progress toward the Random Forest training gate (honest counts).
  useEffect(() => {
    if (!open) return;
    getMlTrainingStatus().then((s) => setTrainingStatus(s));
  }, [open, data]);
  const fetchedRef = useRef(false);

  useEffect(() => { setHistory(initialHistory); }, [initialHistory]);

  useEffect(() => {
    if (!open || !serverId || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingProviders(true);
    getAvailableProviders(serverId).then((list) => {
      setProviders(list);
      const ocr = list.find((p) => p.id === 'paddleocr');
      const ai = list.find((p) => ['huggingface', 'gemini', 'gpt5', 'openai'].includes(p.id));
      setOcrProvider(ocr ? ocr.id : '');
      setAiProvider(ai ? ai.id : '');
      setLoadingProviders(false);
    });
  }, [open, serverId]);

  const runParallel = useCallback(async () => {
    if (!serverId || !ocrProvider || !aiProvider) return;
    setError(null);
    setData(null);
    setOcrRunning(true);
    setAiRunning(true);
    const result = await runParallelAnalysis(serverId, ocrProvider, aiProvider);
    setOcrRunning(false);
    setAiRunning(false);
    if (!result.ok) { setError(result.error); return; }
    setData(result.data);
  }, [serverId, ocrProvider, aiProvider]);

  // Preserved: single-AI re-analysis with history tracking (from the old
  // MultiAnalysisPanel). Compact button row under the results.
  const runLegacy = useCallback(async () => {
    if (!serverId || !file || !aiProvider) return;
    setLegacyRunning(true);
    setError(null);
    const result = await reanalyzeWithProvider(serverId, file, aiProvider);
    setLegacyRunning(false);
    if (!result.ok) { setError(result.error); return; }
    setLegacyComparison(result.comparison);
    setHistory((prev) => (prev.some((e) => e.attemptNumber === result.reanalysis.attemptNumber)
      ? prev : [...prev, result.reanalysis]));
  }, [serverId, file, aiProvider]);

  // Compact by default: one summary row per medicine (name+strength match);
  // "Show field detail" expands to the full per-field grid.
  // Runs unconditionally (Rules of Hooks) — moved above the early return.
  const comparisonFields = useMemo(() => {
    const all = data?.comparison?.fields ?? [];
    if (!all.length) return [];
    if (showAllFields) return all;
    // Medicine count row + one row per medicine (the "Medicine name" field).
    return all.filter((f) =>
      f.category === 'medicines' || (f.category === 'medicine' && f.field === 'name'));
  }, [data, showAllFields]);

  if (!serverId) return null;

  const ocrProviders = providers.filter((p) => p.id === 'paddleocr');
  const aiProviders = providers.filter((p) => ['huggingface', 'gemini', 'gpt5', 'openai'].includes(p.id));
  const running = ocrRunning || aiRunning;
  const canRun = !running && !!ocrProvider && !!aiProvider;
  const step3State = running ? 'active' : data ? 'done' : undefined;
  const ml = data?.ml ?? null;
  const showResults = data || running;
  const hiddenCount = (data?.comparison?.fields.length ?? 0) - comparisonFields.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="reanalyze-heading">
      {/* Header — one line, quiet */}
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-2xl px-5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
      >
        <Cpu size={16} className="shrink-0 text-indigo-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="reanalyze-heading" className="text-sm font-semibold text-slate-900">Re-analyze Prescription</h2>
          <p className="text-[11px] text-slate-500">Compare an independent OCR result with an AI result.</p>
        </div>
        {history.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 sm:inline">
            {history.length} saved
          </span>
        )}
        {open ? <ChevronUp size={15} className="shrink-0 text-slate-400" /> : <ChevronDown size={15} className="shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5">
          {/* Step indicator — compact horizontal */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StepBadge n={1} label="OCR Engine" state={ocrProvider ? 'done' : undefined} />
            <span className="hidden h-px w-4 bg-slate-200 sm:block" aria-hidden="true" />
            <StepBadge n={2} label="AI Model" state={aiProvider ? 'done' : undefined} />
            <span className="hidden h-px w-4 bg-slate-200 sm:block" aria-hidden="true" />
            <StepBadge n={3} label="Compare" state={step3State} />
          </div>

          {/* ① + ② selectors — side by side on desktop, stacked on mobile */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <FileScan size={12} className="text-sky-600" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">① OCR Engine</h3>
              </div>
              {loadingProviders ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Loading…</p>
              ) : ocrProviders.length === 0 ? (
                <p className="text-[11px] text-amber-800">No OCR engine configured on the server.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {ocrProviders.map((p) => (
                    <Chip key={p.id} label={p.label} sub={p.model} selected={ocrProvider === p.id} onClick={() => setOcrProvider(p.id)} />
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Bot size={12} className="text-violet-600" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">② AI Model</h3>
              </div>
              {loadingProviders ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Loading…</p>
              ) : aiProviders.length === 0 ? (
                <p className="text-[11px] text-amber-800">No AI model configured on the server.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {aiProviders.map((p) => (
                    <Chip key={p.id} label={p.label} sub={p.model} selected={aiProvider === p.id} onClick={() => setAiProvider(p.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Run button — centered */}
          <div className="mt-3 flex justify-center">
            <button
              type="button" onClick={runParallel} disabled={!canRun}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {running
                ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Running parallel analysis…</>
                : <><Cpu size={14} aria-hidden="true" /> Run Parallel Analysis</>}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            Both engines receive the same stored prescription image. The primary analysis is never changed.
          </p>

          {error && (
            <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-900">Analysis failed</p>
              <p className="mt-0.5 text-xs text-red-800">{error}</p>
            </div>
          )}

          {/* ③ RESULTS — side-by-side, compact */}
          {showResults && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <GitCompare size={12} className="text-slate-400" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">③ Results &amp; Comparison</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <ResultColumn
                  kind="ocr"
                  status={ocrRunning ? 'running' : data?.ocr.status === 'complete' ? 'complete' : data?.ocr.status === 'failed' ? 'failed' : 'idle'}
                  providerLabel={data?.ocr.result?.providerLabel ?? providers.find((p) => p.id === ocrProvider)?.label ?? 'PaddleOCR-VL'}
                  model={data?.ocr.result?.model ?? providers.find((p) => p.id === ocrProvider)?.model}
                  result={data?.ocr.result}
                  error={data?.ocr.error}
                />
                <ResultColumn
                  kind="ai"
                  status={aiRunning ? 'running' : data?.ai.status === 'complete' ? 'complete' : data?.ai.status === 'failed' ? 'failed' : 'idle'}
                  providerLabel={data?.ai.result?.providerLabel ?? providers.find((p) => p.id === aiProvider)?.label ?? 'AI model'}
                  model={data?.ai.result?.model ?? providers.find((p) => p.id === aiProvider)?.model}
                  result={data?.ai.result}
                  error={data?.ai.error}
                />
              </div>

              {/* ML TRAINING PROGRESS — honest dataset counts toward the gate */}
              {trainingStatus && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-500">RF training dataset</span>
                  <span className="font-mono font-bold text-slate-800" data-testid="ml-training-progress">
                    {trainingStatus.uniqueRows}/{trainingStatus.gate}
                  </span>
                  <span className="text-slate-400">unique labeled rows</span>
                  <div className="h-1.5 min-w-[80px] flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={trainingStatus.progressPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className={`h-full rounded-full transition-all ${trainingStatus.progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(2, trainingStatus.progressPct)}%` }} />
                  </div>
                  {trainingStatus.trained
                    ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Model trained</span>
                    : <span className="text-slate-500">{trainingStatus.needed} more to train</span>}
                </div>
              )}

              {/* ML COMPARISON — one compact table: Field | OCR | AI | ML */}
              {data?.comparison && (
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[10px]">
                    <span className="font-bold uppercase tracking-wide text-slate-500">ML Comparison</span>
                    {ml && (
                      <>
                        <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-600">Random Forest</span>
                        {ml.status === 'trained'
                          ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Trained</span>
                          : <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">Training Required</span>}
                        <span className="text-slate-500">
                          Confidence <strong data-testid="ml-confidence">{(ml.confidence * 100).toFixed(0)}%</strong>
                          <span className="ml-1 text-slate-400">({ml.confidenceSource === 'trained_model' ? 'trained model' : 'field agreement'})</span>
                        </span>
                      </>
                    )}
                    {data.comparison.summary.disagreements > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-800">
                        <ShieldAlert size={10} aria-hidden="true" /> {data.comparison.summary.disagreements} to verify
                      </span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/60 text-left text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th scope="col" className="px-3 py-1.5 font-semibold">Field</th>
                          <th scope="col" className="px-3 py-1.5 font-semibold text-sky-600">OCR</th>
                          <th scope="col" className="px-3 py-1.5 font-semibold text-violet-600">AI</th>
                          <th scope="col" className="px-3 py-1.5 text-center font-semibold">ML</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonFields.map((f, i) => (
                          <tr key={i} className={f.status === 'needs_verification' ? 'bg-amber-50/40' : ''}>
                            <td className="px-3 py-1.5 font-medium text-slate-700">{f.label}</td>
                            <td className="px-3 py-1.5 text-slate-700">{f.ai1 !== null && f.ai1 !== '' ? String(f.ai1) : '—'}</td>
                            <td className="px-3 py-1.5 text-slate-700">{f.ai2 !== null && f.ai2 !== '' ? String(f.ai2) : '—'}</td>
                            <td className="px-3 py-1.5 text-center"><MatchBadge status={f.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hiddenCount > 0 ? (
                    <button
                      type="button" onClick={() => setShowAllFields(true)}
                      className="w-full border-t border-slate-100 py-1.5 text-[10px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      Show field detail — {hiddenCount} more field{hiddenCount !== 1 ? 's' : ''} (strength, dosage, frequency…)
                    </button>
                  ) : showAllFields && (
                    <button
                      type="button" onClick={() => setShowAllFields(false)}
                      className="w-full border-t border-slate-100 py-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      Show summary (one row per medicine)
                    </button>
                  )}
                  {ml && ml.drivers.length > 0 && (
                    <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-amber-800">
                      {ml.drivers[0]}{ml.drivers.length > 1 ? ` · +${ml.drivers.length - 1} more signals` : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Preserved legacy feature: single-AI re-analysis + history */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button" onClick={runLegacy}
                  disabled={legacyRunning || !aiProvider || !file}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                >
                  {legacyRunning
                    ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Re-analyzing…</>
                    : <><Clock size={12} aria-hidden="true" /> Re-analyze with {providers.find((p) => p.id === aiProvider)?.label ?? 'selected AI'} (keep in history)</>}
                </button>
                {history.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    {history.length} saved re-analys{history.length === 1 ? 'y' : 'es'} · latest: {history[history.length - 1].providerLabel}
                    {' · '}{(history[history.length - 1].overallConfidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {legacyComparison && (
                <p className="mt-1.5 text-[10px] text-slate-500">
                  History comparison: {legacyComparison.summary.matched}/{legacyComparison.summary.totalFields} fields match
                  {' '}({legacyComparison.summary.agreementPercent}%) vs the primary analysis — full table in the saved record.
                </p>
              )}

              {/* Safety line — one compact line */}
              <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] leading-relaxed text-blue-800">
                <strong>AI and OCR provide assistance only.</strong> Final verification requires a qualified pharmacist/clinician —
                confirm in the Pharmacist Review panel below; blockchain stays locked until then.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
