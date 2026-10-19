import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

type Tone = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

const TONE_BOX: Record<Tone, string> = {
  default: 'bg-indigo-50 text-indigo-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
  info: 'bg-cyan-50 text-cyan-600',
  purple: 'bg-violet-50 text-violet-600',
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: number;
  tone?: Tone;
  linkTo?: string;
  format?: 'number' | 'currency' | 'percent';
  loading?: boolean;
}

export default function StatCard({
  icon: Icon, label, value, trend, tone = 'default', linkTo, format = 'number', loading = false,
}: StatCardProps) {
  const body = (
    <div className="group h-full rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE_BOX[tone]} transition-transform duration-200 group-hover:scale-110`} aria-hidden="true">
          <Icon size={20} strokeWidth={2.2} />
        </span>
        {typeof trend === 'number' && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {loading ? (
        <>
          <div className="mt-4 h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-2 h-3.5 w-28 animate-pulse rounded bg-slate-100" />
        </>
      ) : (
        <>
          <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {typeof value === 'number'
              ? format === 'currency'
                ? `₹${value.toLocaleString('en-IN')}`
                : format === 'percent'
                  ? `${value.toLocaleString()}%`
                  : value.toLocaleString('en-IN')
              : value}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{label}</p>
        </>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">{body}</Link>;
  }
  return body;
}
