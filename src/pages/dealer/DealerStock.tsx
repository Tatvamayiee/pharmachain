import { useEffect, useState } from 'react';
import { PackageSearch, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { backendToken } from '../../services/backendSync';
import { apiUrl } from '../../lib/api';

type StockRow = {
  id: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate?: string;
  availableQuantity: number;
  status: string;
};

/**
 * Dealer "Available Stock" — live, org-scoped data from /api/inventory/stock.
 * The server derives the organization from the JWT, so a dealer only ever
 * sees its own batches. No mock data: when the server is unreachable or the
 * org has no stock, the honest empty/error state is shown.
 */
export default function DealerStock() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = backendToken();
        if (!token) throw new Error('Not signed in — no backend token. Please log in again.');
        const res = await fetch(apiUrl('/api/inventory/stock'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
        if (!cancelled) setRows((data.stock || []) as StockRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stock');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const isExpired = (expiry?: string) => !!expiry && new Date(expiry) < new Date();

  return (
    <div>
      <PageHeader
        title="Available Stock"
        subtitle="Batches currently held by your organization, earliest expiry first."
        actions={
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="mt-6 space-y-2" aria-busy="true" aria-label="Loading stock">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
          <PackageSearch size={36} className="text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-600">No stock in your organization yet</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">
            Batches appear here once shipments are received and released. Demo organizations have starter stock seeded automatically.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Medicine</th>
                <th className="px-4 py-3 font-semibold">Generic</th>
                <th className="px-4 py-3 font-semibold">Batch</th>
                <th className="px-4 py-3 font-semibold">Qty</th>
                <th className="px-4 py-3 font-semibold">Expiry</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.medicineName}</td>
                  <td className="px-4 py-3 text-slate-500">{r.genericName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.batchNumber}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{r.availableQuantity}</td>
                  <td className={`px-4 py-3 text-xs ${isExpired(r.expiryDate) ? 'font-semibold text-red-600' : 'text-slate-600'}`}>
                    {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === 'released'
                        ? 'bg-emerald-50 text-emerald-700'
                        : r.status === 'recalled'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
