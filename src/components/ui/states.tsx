import type { LucideIcon } from 'lucide-react';
import { Loader2, PackageOpen, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Icon = PackageOpen, title, message, action }: {
  icon?: LucideIcon; title: string; message?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <Icon size={30} className="text-slate-300" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
        >
          <RefreshCw size={15} /> Retry
        </button>
      )}
    </div>
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-hidden="true">
      <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`mt-3 h-3.5 animate-pulse rounded bg-slate-100 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 size={18} className={`animate-spin ${className}`} aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <Loader2 size={28} className="animate-spin text-indigo-600" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
