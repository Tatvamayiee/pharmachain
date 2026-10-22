import { useEffect, useState } from 'react';
import { getDB, StockItem } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export function useExpiring(days: number) {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('stock');
      const cutoff = new Date(Date.now() + days * 86400_000).toISOString();
      setItems(all.filter(s => s.owner === user?.name && s.expiryDate <= cutoff));
    })();
  }, [user, days]);
  return items;
}

export default function ExpiryAlert() {
  const items = useExpiring(30);
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Expiry Alert</h1>
      <p className="mb-4 text-sm text-slate-500">Stock expiring within 30 days.</p>
      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{s.drugName}</p>
              <p className="font-mono text-xs text-slate-500">{s.batchNumber} · {s.quantity} units</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              exp {new Date(s.expiryDate).toLocaleDateString()}
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Nothing expiring soon ✅</p>}
      </div>
    </div>
  );
}
