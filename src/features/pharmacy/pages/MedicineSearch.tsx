import { useState } from 'react';
import { getDB, StockItem } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function MedicineSearch() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StockItem[] | null>(null);

  const search = async () => {
    const db = await getDB();
    const stock = await db.getAll('stock');
    setResults(stock.filter(s => s.owner === user?.name && s.drugName.toLowerCase().includes(q.toLowerCase())));
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">Medicine Search</h1>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search your stock by drug name…" className="flex-1 rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button onClick={search} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Search</button>
      </div>
      {results && (
        <div className="mt-4 space-y-2">
          {results.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-3 text-sm">
              <span>{s.drugName} <span className="font-mono text-xs text-slate-500">{s.batchNumber}</span></span>
              <span className="font-medium">{s.quantity} units · ₹{s.price}</span>
            </div>
          ))}
          {results.length === 0 && <p className="text-sm text-slate-400">No matches in your stock</p>}
        </div>
      )}
    </div>
  );
}
