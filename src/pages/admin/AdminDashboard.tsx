import { useEffect, useState } from 'react';
import { getDB, Batch, Order, StockItem, ScanRecord, Sale } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export function StatCard({ label, value, color = 'bg-indigo-600' }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-xl border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-block h-2 w-8 rounded-full ${color}`} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

export function useCoreData() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      setBatches(await db.getAll('batches'));
      setOrders(await db.getAll('orders'));
      setStock(await db.getAll('stock'));
      setScans(await db.getAll('scans'));
      setSales(await db.getAll('sales'));
    })();
  }, [tick]);
  return { batches, orders, stock, scans, sales, refresh: () => setTick(t => t + 1) };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { batches, orders, stock, scans, sales } = useCoreData();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Admin Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">System-wide oversight — {user?.name}</p>
      <div className="mb-8 grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Batches" value={batches.length} />
        <StatCard label="Orders" value={orders.length} color="bg-amber-500" />
        <StatCard label="Stock Items" value={stock.length} color="bg-emerald-600" />
        <StatCard label="QR Scans" value={scans.length} color="bg-sky-600" />
        <StatCard label="Sales" value={sales.length} color="bg-rose-500" />
      </div>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Recent Scans</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Reasons</th><th className="px-4 py-3">When</th></tr>
          </thead>
          <tbody>
            {scans.slice(-8).reverse().map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.result === 'green' ? 'bg-emerald-50 text-emerald-700' :
                      s.result === 'orange' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                    {s.result}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{s.reasons.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-400">{new Date(s.at).toLocaleString()}</td>
              </tr>
            ))}
            {scans.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No scans yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
