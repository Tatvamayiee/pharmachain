import { useEffect, useState } from 'react';
import { getDB, Sale } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function SoldStock() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('sales');
      setSales(all.filter(s => s.pharmacy === user?.name).reverse());
    })();
  }, [user]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Sold Stock</h1>
      <div className="space-y-2">
        {Object.entries(sales.reduce<Record<string, number>>((acc, s) => {
          acc[s.drugName] = (acc[s.drugName] || 0) + s.quantity; return acc;
        }, {})).map(([drug, units]) => (
          <div key={drug} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <span className="text-sm font-medium">{drug}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{units} sold</span>
          </div>
        ))}
        {sales.length === 0 && <p className="text-sm text-slate-400">Nothing sold yet</p>}
      </div>
    </div>
  );
}
