import { PackageCheck } from 'lucide-react';
import type { Shipment } from '../../lib/manufacturerData';

interface RecentShipmentsProps {
  shipments: Shipment[];
  loading?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  ASSIGNED_TO_DEALER: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Card listing recent shipments with ID, dealer, route and status badge. */
export default function RecentShipments({ shipments, loading = false }: RecentShipmentsProps) {
  return (
    <section
      aria-label="Recent Shipments"
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6"
    >
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Recent Shipments</h2>
        <p className="mt-0.5 text-sm text-slate-500">Latest shipments assigned to dealers</p>
      </header>

      {loading ? (
        <ul className="space-y-3" role="status" aria-label="Loading recent shipments">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 p-3">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 max-w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-32 max-w-full animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-6 w-36 animate-pulse rounded-full bg-slate-100" />
            </li>
          ))}
          <span className="sr-only">Loading shipments…</span>
        </ul>
      ) : shipments.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
          <PackageCheck size={28} className="text-slate-300" aria-hidden="true" />
          <p className="max-w-xs px-4 text-sm text-slate-500">
            No shipments yet. Shipments you create will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shipments.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 py-3 transition-colors duration-150 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
                  aria-hidden="true"
                >
                  <PackageCheck size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-slate-800">{s.id}</p>
                  <p className="truncate text-sm text-slate-500">
                    {s.dealer} · <span className="text-slate-400">{s.route}</span>
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex w-fit shrink-0 items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${STATUS_STYLES[s.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                {s.status.split('_').join(' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
