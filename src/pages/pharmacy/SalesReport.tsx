import { useEffect, useState } from 'react';
import { getDB, Sale } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function SalesReport() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('sales');
      setSales(all.filter(s => s.pharmacy === user?.name).reverse());
    })();
  }, [user]);

  const revenue = sales.reduce((a, s) => a + s.quantity * s.price, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Sales Report</h1>
      <div className="mb-4 rounded-xl border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">Total revenue</p>
        <p className="text-3xl font-bold text-emerald-600">₹{revenue.toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-400">{sales.length} transactions</p>
      </div>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Amount</th></tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2 font-medium">₹{s.quantity * s.price}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No sales yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
