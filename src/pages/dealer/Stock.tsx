import { useEffect, useState } from 'react';
import { getDB, StockItem } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export function useMyStock() {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('stock');
      setStock(all.filter(s => s.owner === user?.name));
    })();
  }, [user, tick]);
  return { stock, refresh: () => setTick(t => t + 1) };
}

export default function Stock() {
  const { stock } = useMyStock();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Current Stock</h1>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Expiry</th></tr>
          </thead>
          <tbody>
            {stock.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.batchNumber}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2 text-xs">{new Date(s.expiryDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {stock.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No stock</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
