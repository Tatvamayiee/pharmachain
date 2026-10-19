import { useEffect, useState } from 'react';
import { getDB, Batch } from '../../lib/db';
import { StatCard } from '../admin/AdminDashboard';

export default function LowStockAlert() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [threshold, setThreshold] = useState(500);

  useEffect(() => {
    (async () => { const db = await getDB(); setBatches(await db.getAll('batches')); })();
  }, []);

  const low = batches.filter(b => b.quantity < threshold);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Low Stock Alert</h1>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-slate-600">Alert threshold (units)</label>
        <input type="number" value={threshold} onChange={e => setThreshold(+e.target.value)}
          className="w-40 rounded-lg border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div className="mb-6 grid-cols-2 gap-4">
        <StatCard label="Batches below threshold" value={low.length} color={low.length ? 'bg-rose-500' : 'bg-emerald-600'} />
      </div>
      <div className="space-y-2">
        {low.map(b => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{b.drugName}</p>
              <p className="font-mono text-xs text-slate-500">{b.batchNumber}</p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">{b.quantity} units</span>
          </div>
        ))}
        {low.length === 0 && <p className="text-sm text-slate-400">All batches are above the threshold ✅</p>}
      </div>
    </div>
  );
}
