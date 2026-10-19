import { useEffect, useState } from 'react';
import { getDB, StockItem, Sale } from '../../lib/db';
import { useAuth } from '../../lib/auth';
import { StatCard } from '../admin/AdminDashboard';

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      setStock(await db.getAll('stock'));
      setSales(await db.getAll('sales'));
    })();
  }, []);

  const mine = stock.filter(s => s.owner === user?.name);
  const mySales = sales.filter(s => s.pharmacy === user?.name);
  const soon = new Date(Date.now() + 30 * 86400_000).toISOString();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Pharmacy Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">Welcome, {user?.name}</p>
      <div className="mb-8 grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Stock Lines" value={mine.length} />
        <StatCard label="Expiring <30d" value={mine.filter(s => s.expiryDate <= soon).length} color="bg-amber-500" />
        <StatCard label="Low Stock (<100)" value={mine.filter(s => s.quantity < 100).length} color="bg-rose-500" />
        <StatCard label="Sales Today" value={mySales.filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString()).length} color="bg-emerald-600" />
      </div>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Batch</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Expiry</th></tr>
          </thead>
          <tbody>
            {mine.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2 font-mono text-xs">{s.batchNumber}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2 text-xs">{new Date(s.expiryDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {mine.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No stock yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
