import { useCallback, useEffect, useState } from 'react';
import { getDB, StockItem, logActivity, notify } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function DiscountAlert() {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('stock');
    const cutoff = new Date(Date.now() + 60 * 86400_000).toISOString();
    setItems(all.filter(s => s.owner === user?.name && s.expiryDate <= cutoff && s.quantity > 0));
  }, [user?.name]);

  useEffect(() => { void load(); }, [load]);

  const discount = async (item: StockItem, pct: number) => {
    const db = await getDB();
    await db.put('stock', { ...item, price: Math.round(item.price * (1 - pct / 100) * 100) / 100 });
    await logActivity(user?.name ?? '', 'discount applied', `${item.drugName} −${pct}% (near expiry)`);
    await notify(null, `Discount: ${item.drugName}`, `${user?.name} discounted ${item.drugName} by ${pct}% — near expiry.`);
    setMsg(`${item.drugName} discounted ${pct}% and patients were notified.`);
    await load();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Discount Alert</h1>
      <p className="mb-4 text-sm text-slate-500">Stock expiring within 60 days — apply a discount to move it before it expires.</p>
      {msg && <p className="mb-4 text-sm text-emerald-600">{msg}</p>}
      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{s.drugName}</p>
              <p className="text-xs text-slate-500">₹{s.price} · exp {new Date(s.expiryDate).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-1">
              {[10, 20, 30].map(p => (
                <button key={p} onClick={() => discount(s, p)} className="rounded-lg border-slate-200 px-3 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-600">−{p}%</button>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No near-expiry stock to discount ✅</p>}
      </div>
    </div>
  );
}
