// ---------------------------------------------------------------------------
// ParallelAnalysisPanel — OCR ∥ AI → Normalize → Random Forest → Verify.
//
// THREE clearly separated sections:
//   1. OCR Engine       — configured OCR providers only (PaddleOCR-VL).
//   2. AI Model         — configured AI providers (Qwen3-VL / Gemini / GPT-5).
//   3. ML Comparison    — Random Forest status, confidence, field verdicts.
//
// One button — "Run Parallel Analysis" — fires BOTH pipelines simultaneously
// (backend Promise.allSettled) on the SAME stored original image. Separate
// per-pipeline loading states make the parallelism visible.
//
// Rules enforced here:
//   - Original primary analysis is NEVER overwritten.
//   - Disagreements/unclear fields are "NEEDS VERIFICATION" — never auto-picked.
//   - ML confidence is shown only when legitimately calculated; the panel says
//     "Training Required" when no trained Random Forest model exists.
//   - No mock data; no credentials ever requested or displayed.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Cpu, FileScan,
  GitCompare, Loader2, ScanText, ShieldAlert, XCircle,
} from 'lucide-react';
import type {
  AvailableProvider, MlComparison, ParallelAnalysisResult, MedicineValidation,
} from '../../types/prescription';
import { getAvailableProviders, runParallelAnalysis } from '../../services/backendSync';
import StatusBadge from '../ui/StatusBadge';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  index, title, description, icon, children,
}: {
  index: number; title: string; description: string;
  icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">
            {index}. {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ProviderChip({
  label, model, selected, disabled, onSelect,
}: {
  label: string; model: string; selected: boolean; disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className={`font-semibold ${selected ? 'text-indigo-700' : 'text-slate-800'}`}>{label}</span>
      <span className="mt-0.5 text-[11px] text-slate-500">{model}</span>
    </button>
  );
}

/** Validation badge line for one medicine's reference-database match. */
function ValidationLine({ v }: { v?: MedicineValidation }) {
  if (!v) return null;
  if (v.exists && !v.uncertain) {
    return (
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-700">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-semibold">
          ✓ DB: {v.matchedName}
        </span>
        <span className="text-slate-400">
          {v.method} · {(v.confidence * 100).toFixed(0)}%
          {v.strengthStatus === 'listed' ? ' · strength listed' : v.strengthStatus === 'not_listed' ? ' · strength not listed' : ''}
        </span>
      </p>
    );
  }
  const label = v.exists
    ? `DB match uncertain: ${v.matchedName} (${v.method}, ${(v.confidence * 100).toFixed(0)}%)`
    : v.matchedName
      ? `No confident DB match — closest: ${v.matchedName} (${(v.similarity * 100).toFixed(0)}%)`
      : 'No DB match found';
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800">
      <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold">⚠ Needs Verification</span>
      <span>{label} — verify against the reference formulary; not auto-approved.</span>
    </p>
  );
}

/** Per-pipeline result card — OCR or AI. */
function PipelineCard({
  kind, status, providerLabel, model, result, error,
}: {
  kind: 'ocr' | 'ai';
  status: 'idle' | 'running' | 'complete' | 'failed';
  providerLabel: string;
  model?: string;
  result?: ParallelAnalysisResult['ocr']['result'] | ParallelAnalysisResult['ai']['result'] | null;
  error?: string;
}) {
  const isOcr = kind === 'ocr';
  const tone = status === 'complete' ? 'emerald' : status === 'failed' ? 'red' : 'slate';
  return (
    <div className={`flex-1 min-w-[240px] rounded-2xl border p-4 ${
      status === 'failed' ? 'border-red-200 bg-red-50/40'
        : status === 'complete' ? (isOcr ? 'border-sky-200 bg-sky-50/40' : 'border-violet-200 bg-violet-50/40')
        : 'border-slate-200 bg-slate-50/40'
    }`}>
      <div className="flex items-center gap-2">
        {isOcr
          ? <ScanText size={15} className={tone === 'emerald' ? 'text-sky-600' : 'text-slate-400'} aria-hidden="true" />
          : <Bot size={15} className={tone === 'emerald' ? 'text-violet-600' : 'text-slate-400'} aria-hidden="true" />}
        <h4 className="text-sm font-bold text-slate-900">{isOcr ? 'OCR Analysis' : 'AI Analysis'}</h4>
        <span className="ml-auto">
          {status === 'running' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
              <Loader2 size={10} className="animate-spin" aria-hidden="true" /> Running…
            </span>
          )}
          {status === 'complete' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 size={10} aria-hidden="true" /> Complete
            </span>
          )}
          {status === 'failed' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              <XCircle size={10} aria-hidden="true" /> Failed
            </span>
          )}
          {status === 'idle' && (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-400">Idle</span>
          )}
        </span>
      </div>

      <dl className="mt-2 space-y-0.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-slate-400">Provider</dt>
          <dd className="font-semibold text-slate-700">{providerLabel || '—'}</dd>
        </div>
        {model && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-400">Model</dt>
            <dd className="truncate font-mono text-[11px] text-slate-500">{model}</dd>
          </div>
        )}
        {result && (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-slate-400">Status</dt>
            <dd className="text-slate-600">
              Complete{result.overallConfidence > 0 && ` · ${(result.overallConfidence * 100).toFixed(0)}% self-reported confidence`}
              {isOcr && (result as { isOcrOnly?: boolean }).isOcrOnly ? ' · OCR-only (no structuring model)' : ''}
            </dd>
          </div>
        )}
      </dl>

      {status === 'running' && (
        <p className="mt-2 text-xs text-indigo-700">
          Running {providerLabel}… both engines are processing the same image simultaneously.
        </p>
      )}

      {status === 'failed' && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-800">
          {error || 'Pipeline failed — see the error banner for details.'}
        </p>
      )}

      {result && result.medicines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {result.medicines.map((m, i) => (
            <div key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs ${m.needsVerification ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-800">{m.name ?? <em className="text-amber-700">unclear</em>}</span>
                {m.needsVerification && <StatusBadge status="Needs verification" tone="warning" />}
                <span className="ml-auto text-[10px] text-slate-400">{(m.confidence * 100).toFixed(0)}%</span>
              </div>
              <p className="mt-0.5 text-slate-600">
                {[m.strength, m.dosage, m.frequency, m.duration, m.route].filter(Boolean).join(' · ') || '—'}
              </p>
              <ValidationLine v={m.validation} />
            </div>
          ))}
        </div>
      )}

      {result && result.medicines.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No medicines extracted — see warnings below.</p>
      )}

      {result && result.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {result.warnings.slice(0, 3).map((w, i) => (
            <li key={i} className="flex items-start gap-1 text-[11px] text-amber-800">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" aria-hidden="true" /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Field status badge for the ML comparison table. */
function FieldBadge({ status }: { status: 'match' | 'needs_verification' }) {
  return status === 'match' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 size={10} aria-hidden="true" /> MATCH
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <AlertTriangle size={10} aria-hidden="true" /> NEEDS VERIFICATION
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface ParallelAnalysisPanelProps {
  serverId: string | null;
  firstProviderLabel: string;
}

export default function ParallelAnalysisPanel({ serverId }: ParallelAnalysisPanelProps) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [ocrProvider, setOcrProvider] = useState<string>('');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [data, setData] = useState<ParallelAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Load configured providers when the panel opens.
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

  const handleRun = useCallback(async () => {
    if (!serverId || !ocrProvider || !aiProvider) return;
    setError(null);
    setData(null);
    // BOTH indicators together — the requests genuinely run in parallel
    // server-side (Promise.allSettled); these flags just reflect that.
    setOcrRunning(true);
    setAiRunning(true);
    const result = await runParallelAnalysis(serverId, ocrProvider, aiProvider);
    setOcrRunning(false);
    setAiRunning(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setData(result.data);
  }, [serverId, ocrProvider, aiProvider]);

  if (!serverId) return null;

  const ocrProviders = providers.filter((p) => p.id === 'paddleocr');
  const aiProviders = providers.filter((p) => ['huggingface', 'gemini', 'gpt5', 'openai'].includes(p.id));
  const canRun = !ocrRunning && !aiRunning && !!ocrProvider && !!aiProvider;
  const ml: MlComparison | null = data?.ml ?? null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="parallel-analysis-heading">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-2xl px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        aria-expanded={open}
      >
        <Cpu size={17} className="shrink-0 text-indigo-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="parallel-analysis-heading" className="text-base font-semibold text-slate-900">
            Parallel OCR + AI + ML Comparison
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Run the independent OCR engine and an AI model simultaneously on the same image, then compare through the ML layer.
          </p>
        </div>
        {open ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 pb-5 pt-4">
          {/* SECTION 1 — OCR ENGINE */}
          <SectionCard
            index={1}
            title="OCR Engine"
            description="Extract prescription text independently."
            icon={<FileScan size={15} aria-hidden="true" />}
          >
            {loadingProviders ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading configured engines…
              </p>
            ) : ocrProviders.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                No OCR engine is configured on the server (PaddleOCR not installed or not reachable).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ocrProviders.map((p) => (
                  <ProviderChip
                    key={p.id} label={p.label} model={p.model}
                    selected={ocrProvider === p.id}
                    onSelect={() => setOcrProvider(p.id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* SECTION 2 — AI MODEL */}
          <SectionCard
            index={2}
            title="AI Model"
            description="Independently interpret the same prescription image."
            icon={<Bot size={15} aria-hidden="true" />}
          >
            {loadingProviders ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading configured models…
              </p>
            ) : aiProviders.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                No AI model is configured on the server. Add provider credentials to <code className="font-mono">.env</code> (backend only).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {aiProviders.map((p) => (
                  <ProviderChip
                    key={p.id} label={p.label} model={p.model}
                    selected={aiProvider === p.id}
                    onSelect={() => setAiProvider(p.id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* SECTION 3 — ML COMPARISON */}
          <SectionCard
            index={3}
            title="ML Comparison"
            description="Compare OCR and AI outputs using the machine-learning confidence layer."
            icon={<GitCompare size={15} aria-hidden="true" />}
          >
            {!ml ? (
              <p className="text-xs text-slate-500">
                {data
                  ? 'ML comparison did not run (both pipelines must succeed).'
                  : 'Run a parallel analysis to generate the field comparison.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">
                    Random Forest
                  </span>
                  {ml.status === 'trained' ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">Trained</span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800">Training Required</span>
                  )}
                  <span className="text-slate-500">
                    Confidence: <strong data-testid="ml-confidence">{(ml.confidence * 100).toFixed(0)}%</strong>
                    <span className="ml-1 text-slate-400">({ml.confidenceSource === 'trained_model' ? 'trained model' : 'field agreement — not an ML probability'})</span>
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">{ml.statusNote}</p>
                {ml.drivers.length > 0 && (
                  <ul className="space-y-0.5">
                    {ml.drivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-800">
                        <ShieldAlert size={10} className="mt-0.5 shrink-0" aria-hidden="true" /> {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </SectionCard>

          {/* Run button */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {ocrRunning || aiRunning
                ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Running parallel analysis…</>
                : <><Cpu size={15} aria-hidden="true" /> Run Parallel Analysis</>}
            </button>
            <p className="text-xs text-slate-500">
              Both engines receive the same stored prescription image. The primary analysis is never changed.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-red-900">Parallel analysis failed</p>
              <p className="mt-0.5 text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Per-pipeline loading indicators — shown TOGETHER while running */}
          {(ocrRunning || aiRunning) && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <PipelineCard
                kind="ocr" status="running"
                providerLabel={providers.find((p) => p.id === ocrProvider)?.label ?? ocrProvider}
                model={providers.find((p) => p.id === ocrProvider)?.model}
              />
              <PipelineCard
                kind="ai" status="running"
                providerLabel={providers.find((p) => p.id === aiProvider)?.label ?? aiProvider}
                model={providers.find((p) => p.id === aiProvider)?.model}
              />
            </div>
          )}

          {/* RESULTS */}
          {data && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <PipelineCard
                  kind="ocr"
                  status={data.ocr.status}
                  providerLabel={
                    data.ocr.result?.providerLabel
                      ?? providers.find((p) => p.id === ocrProvider)?.label ?? ocrProvider
                  }
                  model={data.ocr.result?.model ?? providers.find((p) => p.id === ocrProvider)?.model}
                  result={data.ocr.result}
                  error={data.ocr.error}
                />
                <PipelineCard
                  kind="ai"
                  status={data.ai.status}
                  providerLabel={
                    data.ai.result?.providerLabel
                      ?? providers.find((p) => p.id === aiProvider)?.label ?? aiProvider
                  }
                  model={data.ai.result?.model ?? providers.find((p) => p.id === aiProvider)?.model}
                  result={data.ai.result}
                  error={data.ai.error}
                />
              </div>

              {/* ML comparison field table */}
              {data.comparison && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Field comparison — OCR vs AI</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Field</th>
                          <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-sky-600">OCR</th>
                          <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-violet-600">AI</th>
                          <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.comparison.fields.map((f, i) => (
                          <tr key={i} className={f.status === 'needs_verification' ? 'bg-amber-50/50' : ''}>
                            <td className="px-3 py-2 font-medium text-slate-700">{f.label}</td>
                            <td className="px-3 py-2 text-slate-800">{f.ai1 !== null && f.ai1 !== '' ? String(f.ai1) : '—'}</td>
                            <td className="px-3 py-2 text-slate-800">{f.ai2 !== null && f.ai2 !== '' ? String(f.ai2) : '—'}</td>
                            <td className="px-3 py-2 text-center"><FieldBadge status={f.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Safety note */}
              <p className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800">
                <strong>AI and OCR provide assistance only.</strong> Final prescription verification requires a qualified
                pharmacist/clinician. Review every field marked "NEEDS VERIFICATION" against the original image, then confirm
                in the Pharmacist Review panel — blockchain registration stays locked until that confirmation.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
