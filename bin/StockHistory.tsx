import { useEffect, useState } from 'react';
import { getDB, StockItem } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function StockHistory() {
  const { user } = useAuth();
  const [ledger, setLedger] = useState<StockItem[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('stock');
      setLedger(all.filter(s => s.owner === user?.name).reverse());
    })();
  }, [user]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Stock History</h1>
      <p className="mb-4 text-sm text-slate-500">Full ledger of every stock movement into your inventory.</p>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Units</th></tr>
          </thead>
          <tbody>
            {ledger.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-xs text-slate-400">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.batchNumber}</td>
                <td className={`px-4 py-2 font-medium ${s.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {s.quantity < 0 ? s.quantity : `+${s.quantity}`}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No stock movements yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
