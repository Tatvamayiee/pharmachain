import { AlertTriangle, Inbox } from 'lucide-react';

interface ChartCardFrameProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}

/**
 * Shared white rounded card shell for charts: title, subtitle, loading
 * skeleton and a consistent empty state so charts never render blank.
 */
export default function ChartCardFrame({
  title,
  subtitle,
  loading = false,
  isEmpty = false,
  emptyMessage,
  children,
}: ChartCardFrameProps) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </header>

      {loading ? (
        <div
          className="flex h-64 items-end gap-6 px-2 pb-2 animate-pulse"
          role="status"
          aria-label={`Loading ${title} chart`}
        >
          <div className="h-3/4 flex-1 rounded-t-lg bg-indigo-50" />
          <div className="h-1/2 flex-1 rounded-t-lg bg-indigo-50" />
          <div className="h-2/3 flex-1 rounded-t-lg bg-indigo-50" />
          <span className="sr-only">Loading chart data…</span>
        </div>
      ) : isEmpty ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
          {title.toLowerCase().includes('batch') ? (
            <AlertTriangle size={28} className="text-slate-300" aria-hidden="true" />
          ) : (
            <Inbox size={28} className="text-slate-300" aria-hidden="true" />
          )}
          <p className="max-w-xs px-4 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
