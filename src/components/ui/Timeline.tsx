import type { TimelineEvent } from '../../types';

const DOT_TONES: Record<string, string> = {
  default: 'bg-slate-300 ring-slate-100',
  success: 'bg-emerald-500 ring-emerald-100',
  warning: 'bg-amber-500 ring-amber-100',
  error: 'bg-red-500 ring-red-100',
  info: 'bg-cyan-500 ring-cyan-100',
};

export default function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5" aria-label="Timeline">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full ring-4 ${e.done ? (DOT_TONES[e.tone ?? 'success']) : DOT_TONES.default}`}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className={`text-sm font-semibold ${e.done ? 'text-slate-800' : 'text-slate-400'}`}>{e.label}</p>
            {e.timestamp && <time className="text-xs text-slate-400">{e.timestamp}</time>}
          </div>
          {e.description && <p className={`mt-0.5 text-xs ${e.done ? 'text-slate-500' : 'text-slate-400'}`}>{e.description}</p>}
        </li>
      ))}
    </ol>
  );
}
