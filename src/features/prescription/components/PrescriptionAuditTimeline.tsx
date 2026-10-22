// ---------------------------------------------------------------------------
// PrescriptionAuditTimeline — renders a record's session-local audit trail.
// Prototype indicator is always shown: this history is NOT persisted.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import {
  CheckCircle2, ChevronDown, FileEdit, FilePlus2, History, MessageSquare,
  PlayCircle, ShieldAlert, ShieldCheck, Sparkles, Stamp, XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEventType, PrescriptionAuditEvent } from '../types/prescription';

const EVENT_ICON: Record<AuditEventType, LucideIcon> = {
  created: FilePlus2,
  uploaded: FilePlus2,
  analysis_started: PlayCircle,
  analysis_completed: Sparkles,
  medicine_corrected: FileEdit,
  alert_acknowledged: ShieldAlert,
  note_added: MessageSquare,
  clarification_requested: MessageSquare,
  approved: ShieldCheck,
  rejected: XCircle,
  dispensed: Stamp,
  draft_saved: FileEdit,
};

const EVENT_TONE: Record<AuditEventType, string> = {
  created: 'bg-slate-100 text-slate-600',
  uploaded: 'bg-slate-100 text-slate-600',
  analysis_started: 'bg-cyan-50 text-cyan-600',
  analysis_completed: 'bg-cyan-50 text-cyan-700',
  medicine_corrected: 'bg-violet-50 text-violet-600',
  alert_acknowledged: 'bg-amber-50 text-amber-600',
  note_added: 'bg-slate-100 text-slate-600',
  clarification_requested: 'bg-violet-50 text-violet-700',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-red-50 text-red-600',
  dispensed: 'bg-emerald-50 text-emerald-700',
  draft_saved: 'bg-violet-50 text-violet-600',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleTimeString()} · ${d.toLocaleDateString()}`;
}

export default function PrescriptionAuditTimeline({
  events, initiallyOpen = false,
}: {
  events: PrescriptionAuditEvent[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Audit history">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="rx-audit-panel"
        className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
          <History size={17} className="text-indigo-600" aria-hidden="true" />
          Audit history ({events.length})
        </span>
        <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id="rx-audit-panel" className="border-t border-slate-100 px-4 py-4">
          {events.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <CheckCircle2 size={15} aria-hidden="true" /> No audit events yet.
            </p>
          ) : (
            <ol className="space-y-3" aria-label="Prescription audit events, newest first">
              {events.map((e) => {
                const Icon = EVENT_ICON[e.type] ?? History;
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${EVENT_TONE[e.type] ?? 'bg-slate-100 text-slate-600'}`} aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{e.label}</p>
                      <p className="text-xs text-slate-400">
                        {e.actor} · {formatWhen(e.timestamp)}
                      </p>
                      {e.note && (
                        <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs italic text-slate-600">{e.note}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Prototype audit history — not persisted to the backend. Resets when the page session ends.
          </p>
        </div>
      )}
    </section>
  );
}
