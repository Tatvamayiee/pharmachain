// ---------------------------------------------------------------------------
// StockAvailability — real per-medicine stock status for scanned prescriptions.
//
// Availability comes from the server (GET /api/platform/stock-availability),
// the same Batch store the manufacturer stock upload fills. Purchases go
// through POST /api/platform/purchase, which verifies stock server-side,
// deducts FIFO across released lots and records the transaction; the panel
// re-fetches from the server after every confirmed update. Nothing here is
// mocked — when the server cannot be reached it says so.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShoppingCart } from 'lucide-react';
import { dataService } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

type Availability = Record<string, { available: number; found: boolean }>;

type Row = { name: string; prescribed: string; available: number | null; found: boolean };

const canPurchase = (role?: string) =>
  ['dealer', 'pharmacy', 'hospital', 'distributor', 'customer', 'admin'].includes(role || '');

const toneClasses: Record<string, string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  gray: 'border-slate-200 bg-slate-50 text-slate-600',
};

function badgeFor(row: Row, requested: number): { label: string; tone: keyof typeof toneClasses } {
  if (row.available === null) return { label: '⚠ Stock unavailable', tone: 'gray' };
  if (!row.found) return { label: '⚪ Medicine Not Found', tone: 'gray' };
  if (row.available === 0) return { label: '🔴 Out of Stock — 0 available', tone: 'red' };
  if (requested > row.available) return { label: `🟠 Insufficient Stock — ${row.available} available`, tone: 'amber' };
  return { label: `🟢 Available — ${row.available} units`, tone: 'green' };
}

export default function StockAvailability({ medicines }: { medicines: { id: string; extractedName: string; quantity?: string }[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const names = useMemo(
    () => Array.from(new Set(medicines.map((m) => m.extractedName.trim()).filter(Boolean))),
    [medicines],
  );
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!names.length) { setAvailability({}); return; }
    setLoadError(null);
    const data = await dataService.getStockAvailability(names);
    if (Object.keys(data).length === 0) {
      setLoadError('Could not reach the stock service — availability is unknown right now.');
    }
    setAvailability(data);
  }, [names]);

  useEffect(() => { void load(); }, [load]);

  const purchase = async (name: string) => {
    const qty = quantities[name] ?? 1;
    if (!Number.isInteger(qty) || qty < 1) { toast('Enter a whole quantity of at least 1.', 'error'); return; }
    setBusy(name);
    const result = await dataService.recordPurchase({ medicineName: name, quantity: qty });
    setBusy(null);
    if (!result.ok) { toast(result.error, 'error'); return; }
    toast(`Purchase successful — stock updated. ${result.remainingStock} unit(s) remaining.`, 'success');
    void load();
  };

  if (!medicines.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Stock availability for scanned medicines">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Stock availability (live inventory)</h3>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          <RefreshCw size={12} aria-hidden="true" /> Refresh
        </button>
      </div>
      {loadError && (
        <p role="alert" className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{loadError}</p>
      )}
      <div className="mt-3 space-y-2.5">
        {names.map((name) => {
          const entry = availability?.[name];
          const prescribed = medicines.find((m) => m.extractedName === name)?.quantity ?? '';
          const row: Row = entry
            ? { name, prescribed, available: entry.available, found: entry.found }
            : { name, prescribed, available: availability ? 0 : null, found: false };
          const requested = Math.max(Math.round(quantities[name] ?? 1), 1);
          const badge = badgeFor(row, requested);
          const purchasable = canPurchase(user?.role) && row.available !== null && row.available > 0;
          return (
            <div key={name} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-800">{name}</span>
              {prescribed && <span className="text-xs text-slate-400">Prescribed: {prescribed}</span>}
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClasses[badge.tone]}`}>
                {badge.label}
              </span>
              {purchasable && (
                <div className="ml-auto flex items-center gap-1.5">
                  <label className="sr-only" htmlFor={`qty-${name}`}>Quantity for {name}</label>
                  <input
                    id={`qty-${name}`}
                    type="number"
                    min={1}
                    value={quantities[name] ?? 1}
                    onChange={(e) => setQuantities((q) => ({ ...q, [name]: Number(e.target.value) }))}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    disabled={busy === name || requested > row.available!}
                    onClick={() => void purchase(name)}
                    title={requested > row.available! ? `Only ${row.available} unit(s) available` : undefined}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    <ShoppingCart size={12} aria-hidden="true" /> {busy === name ? 'Purchasing…' : 'Purchase'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs text-slate-400">
        Availability reflects the real medicine-stock database filled by the manufacturer upload. Purchases deduct stock server-side and are recorded as transactions.
      </p>
    </section>
  );
}
