import { useEffect, useState } from 'react';
import { getDB, Order } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';
import { StatCard } from '../../admin/pages/AdminDashboard';

export default function TransportDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    (async () => { const db = await getDB(); setOrders(await db.getAll('orders')); })();
  }, []);

  const active = orders.filter(o => o.status === 'dispatched' || o.status === 'in_transit');

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Transport Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">Welcome, {user?.name}</p>
      <div className="mb-8 grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Active Deliveries" value={active.length} color="bg-amber-500" />
        <StatCard label="Delivered" value={orders.filter(o => o.status === 'delivered').length} color="bg-emerald-600" />
        <StatCard label="Awaiting Pickup" value={orders.filter(o => o.status === 'pending').length} color="bg-sky-600" />
      </div>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {active.map(o => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{o.from}</td>
                <td className="px-4 py-2">{o.to}</td>
                <td className="px-4 py-2">{o.drugName}</td>
                <td className="px-4 py-2">{o.quantity}</td>
                <td className="px-4 py-2"><span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{o.status.replace('_', ' ')}</span></td>
              </tr>
            ))}
            {active.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No active deliveries</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
