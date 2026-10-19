import { useEffect, useState } from 'react';
import { getDB, StockItem } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function LowStockAlert() {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [threshold, setThreshold] = useState(100);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('stock');
      setItems(all.filter(s => s.owner === user?.name && s.quantity < threshold));
    })();
  }, [user, threshold]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Low Stock Alert</h1>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-slate-600">Alert threshold (units)</label>
        <input type="number" value={threshold} onChange={e => setThreshold(+e.target.value)} className="w-40 rounded-lg border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{s.drugName}</p>
              <p className="font-mono text-xs text-slate-500">{s.batchNumber}</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">{s.quantity} units</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">All stock above threshold ✅</p>}
      </div>
    </div>
  );
}
