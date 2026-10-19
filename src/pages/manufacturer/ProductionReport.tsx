import { getDB, Batch } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { useEffect, useState } from 'react';

export default function ProductionReport() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Batch[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      setRows((await db.getAll('batches')).filter(b => b.manufacturer === user?.name));
    })();
  }, [user]);

  const total = rows.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Production Report</h1>
      <div className="mb-4 rounded-xl border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Total units produced (all time)</p>
        <p className="text-3xl font-bold text-indigo-600">{total.toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">Across {rows.length} batches · {new Set(rows.map(r => r.drugName)).size} distinct drugs</p>
      </div>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Produced</th></tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{b.batchNumber}</td>
                <td className="px-4 py-2">{b.drugName}</td>
                <td className="px-4 py-2">{b.quantity}</td>
                <td className="px-4 py-2 text-xs text-slate-400">{new Date(b.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
