// ---------------------------------------------------------------------------
// WorkflowStepper + BlockchainPanel — the confirm/verify/anchor side of the
// scanner. The stepper mirrors the five mandated stages; the panel drives
// Confirm → Register on Polygon Amoy → Verify, always honestly (a failed
// registration shows the error, never a fake success).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  Check, Copy, ExternalLink, FileUp, Link2, Loader2,
  PenLine, ScanSearch, ShieldCheck,
} from 'lucide-react';
import type { PrescriptionAnalysis } from '../types/prescription';
import {
  confirmPrescription, registerOnBlockchain, verifyOnBlockchain,
  type BlockchainRegistration,
} from '../../../platform/api/backendSync';

// ------------------------------ Stepper -------------------------------------

const STAGES = [
  { id: 'upload', label: 'Upload', icon: FileUp },
  { id: 'analyze', label: 'Analyze', icon: ScanSearch },
  { id: 'review', label: 'Review', icon: PenLine },
  { id: 'verify', label: 'Verify', icon: ShieldCheck },
  { id: 'blockchain', label: 'Blockchain', icon: Link2 },
] as const;

export type WorkflowStage = 0 | 1 | 2 | 3 | 4;

export function WorkflowStepper({ stage }: { stage: WorkflowStage }) {
  return (
    <nav aria-label="Prescription workflow progress">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {STAGES.map((s, i) => {
          const done = i < stage;
          const active = i === stage;
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex items-center gap-1.5">
              <span
                aria-current={active ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  done ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : active ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100'
                  : 'border-slate-200 bg-white text-slate-400'}`}
              >
                {done ? <Check size={12} aria-hidden="true" /> : <Icon size={12} aria-hidden="true" />}
                {s.label}
              </span>
              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className={`h-px w-4 sm:w-6 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// --------------------------- Blockchain panel --------------------------------

type PanelPhase =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'confirmed'; hash: string }
  | { kind: 'registering'; hash: string }
  | { kind: 'registered'; hash: string; tx: BlockchainRegistration }
  | { kind: 'verifying'; hash: string }
  | { kind: 'verified'; hash: string; matches: boolean; reason: string; onChainHash?: string }
  | { kind: 'error'; hash: string | null; message: string; hint?: string };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable — the hash stays selectable */ }
  }, [value]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700" title={hash}>{hash}</code>
        <CopyButton value={hash} label={label} />
      </div>
    </div>
  );
}

export function BlockchainPanel({
  serverId,
  analysis,
}: {
  serverId: string | null;
  analysis: PrescriptionAnalysis | null;
}) {
  const [phase, setPhase] = useState<PanelPhase>({ kind: 'idle' });

  // A new analysis invalidates any prior confirm/registration view.
  useEffect(() => { setPhase({ kind: 'idle' }); }, [serverId]);

  const canConfirm = !!serverId && !!analysis && analysis.medicines.length > 0;
  const confirmed = phase.kind !== 'idle' && phase.kind !== 'confirming' && phase.kind !== 'error' && !!phase.hash;

  const handleConfirm = useCallback(async () => {
    if (!serverId || !analysis) return;
    setPhase({ kind: 'confirming' });
    const result = await confirmPrescription(
      serverId,
      analysis.medicines.map((m) => ({
        name: m.extractedName,
        correctedName: m.extractedName || null,
        strength: m.strength || null,
        dosage: m.dosage || null,
        frequency: m.frequency || null,
        duration: m.duration || null,
        route: m.route || null,
        quantity: Number(m.quantity) || null,
      })),
    );
    if (result.ok && result.hash) setPhase({ kind: 'confirmed', hash: result.hash });
    else setPhase({ kind: 'error', hash: null, message: result.error || 'Confirmation failed.' });
  }, [serverId, analysis]);

  const handleRegister = useCallback(async () => {
    if (!serverId || phase.kind !== 'confirmed') return;
    const { hash } = phase;
    setPhase({ kind: 'registering', hash });
    const result = await registerOnBlockchain(serverId);
    if (result.ok) setPhase({ kind: 'registered', hash, tx: result.tx });
    else setPhase({ kind: 'error', hash, message: result.error, hint: result.hint });
  }, [serverId, phase]);

  const handleVerify = useCallback(async () => {
    if (!serverId || phase.kind !== 'registered' && phase.kind !== 'confirmed') return;
    const hash = phase.kind === 'registered' ? phase.hash : phase.hash;
    setPhase({ kind: 'verifying', hash });
    const result = await verifyOnBlockchain(serverId);
    if (result.ok) {
      setPhase({ kind: 'verified', hash, matches: result.result.verified, reason: result.result.reason, onChainHash: result.result.onChainHash });
    } else {
      setPhase({ kind: 'error', hash, message: result.error });
    }
  }, [serverId, phase]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="blockchain-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 size={16} className="text-indigo-600" aria-hidden="true" />
        <h2 id="blockchain-heading" className="text-base font-semibold text-slate-900">Blockchain verification</h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          Polygon Amoy testnet
        </span>
        <p className="ml-auto text-xs text-slate-400">Only a SHA-256 hash of the confirmed data goes on-chain — never images or patient data.</p>
      </div>

      {!serverId && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          Blockchain anchoring requires the prescription to be saved on the backend. Run the analysis with the server running, then confirm here.
        </p>
      )}

      {serverId && (
        <div className="mt-4 space-y-3">
          {phase.kind === 'idle' && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <ShieldCheck size={15} aria-hidden="true" /> Confirm prescription data
              </button>
              <p className="text-xs text-slate-500">
                Confirms the reviewed medicines are final and computes the SHA-256 fingerprint for anchoring.
              </p>
            </div>
          )}

          {phase.kind === 'confirming' && (
            <p className="flex items-center gap-2 text-sm text-indigo-700">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Computing confirmation hash…
            </p>
          )}

          {confirmed && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <HashRow label="Confirmed data hash (SHA-256)" hash={phase.hash} />
              {phase.kind === 'confirmed' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRegister}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <Link2 size={15} aria-hidden="true" /> Register on Polygon Amoy
                  </button>
                  <p className="text-xs text-slate-500">Anchors only this hash on-chain (requires a funded testnet key on the server).</p>
                </div>
              )}
              {phase.kind === 'registering' && (
                <p className="flex items-center gap-2 text-sm text-indigo-700">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Sending transaction — this can take up to a minute on Amoy…
                </p>
              )}
              {phase.kind === 'registered' && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    <ShieldCheck size={15} aria-hidden="true" /> Hash registered on-chain
                  </div>
                  <HashRow label="Transaction hash" hash={phase.tx.txHash} />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Network: <strong className="text-slate-700">{phase.tx.network}</strong></span>
                    {phase.tx.blockNumber != null && <span>· Block {phase.tx.blockNumber}</span>}
                    <a
                      href={phase.tx.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 underline decoration-dotted underline-offset-2 hover:text-indigo-800"
                    >
                      View on explorer <ExternalLink size={11} aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={handleVerify}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <ShieldCheck size={12} aria-hidden="true" /> Verify on-chain
                    </button>
                  </div>
                </div>
              )}
              {phase.kind === 'verifying' && (
                <p className="flex items-center gap-2 text-sm text-indigo-700">
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Reading the on-chain record…
                </p>
              )}
              {phase.kind === 'verified' && (
                <div
                  role="status"
                  className={`rounded-xl border px-3.5 py-2.5 text-sm ${phase.matches
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'}`}
                >
                  <p className="font-semibold">{phase.matches ? 'Verified — on-chain hash matches the confirmed data.' : 'Mismatch — the on-chain hash does NOT match.'}</p>
                  <p className="mt-0.5 text-xs">{phase.reason}</p>
                  {phase.onChainHash && <div className="mt-2"><HashRow label="On-chain hash" hash={phase.onChainHash} /></div>}
                </div>
              )}
            </div>
          )}

          {phase.kind === 'error' && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
              <p className="text-sm font-semibold text-red-900">{phase.message}</p>
              {phase.hint && <p className="mt-0.5 text-xs text-red-700">{phase.hint}</p>}
              {phase.hash
                ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleRegister}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                    >
                      Retry registration
                    </button>
                  </div>
                )
                : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="mt-2 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                  >
                    Retry confirmation
                  </button>
                )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
