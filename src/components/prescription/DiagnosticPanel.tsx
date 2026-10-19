// ---------------------------------------------------------------------------
// DiagnosticPanel — Development-only diagnostic report for prescription analysis.
// Not exposed in production (guarded by import.meta.env.DEV).
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Activity, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { PrescriptionAnalysis } from '../../types/prescription';
import type { AiErrorState } from './useScannerReview';

interface DiagnosticPanelProps {
  file: File | null;
  serverHealthy: boolean | null;
  analyzing: boolean;
  stepIndex: number | null;
  analysis: PrescriptionAnalysis | null;
  aiError: AiErrorState | null;
  aiSource: 'server' | 'local' | null;
}

type StatusState = 'PASS' | 'FAIL' | 'PENDING' | 'RUNNING';

export default function DiagnosticPanel({
  file,
  serverHealthy,
  analyzing,
  stepIndex,
  analysis,
  aiError,
  aiSource,
}: DiagnosticPanelProps) {
  // Hooks must run unconditionally (before any early return) to respect the
  // Rules of Hooks.
  const [expanded, setExpanded] = useState(true);

  // Only available in development mode
  if (!import.meta.env.DEV) return null;

  // Diagnostic states
  const uploadStatus: StatusState = file ? 'PASS' : 'PENDING';
  const backendStatus: StatusState = serverHealthy === true ? 'PASS' : serverHealthy === false ? 'FAIL' : 'PENDING';
  
  let imageSentStatus: StatusState = 'PENDING';
  if (stepIndex !== null && stepIndex >= 2) imageSentStatus = 'PASS';
  else if (analyzing && stepIndex === 1) imageSentStatus = 'RUNNING';
  // Honest signal: an aiError after step 2 means the image WAS sent and the
  // server rejected it — the failure is server-side validation, not the send.
  else if (aiError) imageSentStatus = aiError.imageSent === true || stepIndex !== null ? 'PASS' : 'FAIL';

  let openaiStatus: StatusState = 'PENDING';
  if (analysis && aiSource === 'server') openaiStatus = 'PASS';
  else if (analyzing && stepIndex !== null && stepIndex >= 2) openaiStatus = 'RUNNING';
  else if (aiError) openaiStatus = 'FAIL';

  let aiResponseStatus: StatusState = 'PENDING';
  if (analysis) aiResponseStatus = 'PASS';
  else if (analyzing && stepIndex !== null && stepIndex >= 2) aiResponseStatus = 'RUNNING';
  else if (aiError) aiResponseStatus = 'FAIL';

  let parsingStatus: StatusState = 'PENDING';
  if (analysis && Array.isArray(analysis.medicines)) parsingStatus = 'PASS';
  else if (aiError) parsingStatus = 'FAIL';

  let frontendDisplayStatus: StatusState = 'PENDING';
  if (analysis) frontendDisplayStatus = 'PASS';
  else if (aiError) frontendDisplayStatus = 'FAIL';

  const diagnostics: { label: string; status: StatusState; detail?: string }[] = [
    { label: 'UPLOAD', status: uploadStatus, detail: file ? `${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'No file chosen' },
    { label: 'BACKEND', status: backendStatus, detail: serverHealthy ? 'Connected to Express backend' : 'Backend unreachable' },
    { label: 'IMAGE SENT', status: imageSentStatus, detail: imageSentStatus === 'PASS' ? 'Base64 image sent to /api/prescriptions/:id/analyze' : undefined },
    { label: 'OPENAI / AI PROVIDER', status: openaiStatus, detail: analysis ? `Provider: ${analysis.analysisProvider || 'vision AI'} (${analysis.analysisModel || 'model'})` : (aiError ? aiError.message : undefined) },
    { label: 'AI RESPONSE', status: aiResponseStatus, detail: analysis ? `Overall confidence: ${(analysis.confidence * 100).toFixed(0)}%` : undefined },
    { label: 'PARSING', status: parsingStatus, detail: analysis ? `Extracted ${analysis.medicines.length} medicine(s) dynamically` : undefined },
    { label: 'FRONTEND DISPLAY', status: frontendDisplayStatus, detail: analysis ? 'Displaying extracted medicines' : (aiError ? 'Displaying safe error notice' : undefined) },
  ];

  const getStatusBadge = (status: StatusState) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
            <XCircle size={12} /> FAIL
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200 animate-pulse">
            <Activity size={12} /> RUNNING
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
            PENDING
          </span>
        );
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm" aria-label="Development Diagnostic Panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            Development Diagnostic Mode (Pipeline Status)
          </h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">DEV ONLY</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded p-1 text-slate-500 hover:bg-indigo-100/60"
          aria-label={expanded ? 'Collapse diagnostics' : 'Expand diagnostics'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {diagnostics.map((d) => (
            <div key={d.label} className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">{d.label}</span>
                {getStatusBadge(d.status)}
              </div>
              {d.detail && (
                <p className="mt-1 truncate text-[11px] text-slate-500" title={d.detail}>
                  {d.detail}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
