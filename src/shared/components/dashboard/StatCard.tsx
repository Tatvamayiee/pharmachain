import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: number;
  /** Tailwind classes for the small icon container background. */
  iconClassName?: string;
  /** Tailwind classes for the icon itself. */
  iconColorClassName?: string;
  loading?: boolean;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  iconClassName = 'bg-indigo-50',
  iconColorClassName = 'text-indigo-600',
  loading = false,
}: StatCardProps) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName} transition-transform duration-200 group-hover:scale-110`}
          aria-hidden="true"
        >
          <Icon size={20} className={iconColorClassName} strokeWidth={2.2} />
        </span>
        {typeof trend === 'number' && (
          <span
            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}
            aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(trend).toFixed(1)} percent versus last month`}
          >
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {loading ? (
        <>
          <div className="mt-4 h-8 w-20 animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
          <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-slate-100" aria-hidden="true" />
        </>
      ) : (
        <>
          <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900" aria-live="polite">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{label}</p>
        </>
      )}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" role="status" aria-label="Loading statistic">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="mt-4 h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-slate-100" />
      <span className="sr-only">Loading statistic…</span>
    </div>
  );
}
