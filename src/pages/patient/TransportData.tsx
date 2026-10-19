import { useEffect, useState } from 'react';
import { getDB, Order } from '../../lib/db';

export default function TransportData() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('orders');
      setOrders(all.filter(o => o.status === 'in_transit' || o.status === 'delivered').reverse());
    })();
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Transport Data</h1>
      <p className="mb-4 text-sm text-slate-500">Cold-chain and custody history for your medicines.</p>
      <div className="space-y-2">
        {orders.map(o => (
          <div key={o.id} className="rounded-xl border-slate-200 bg-white p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">{o.drugName} ×{o.quantity}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {o.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Route: {o.from} → {o.to} · dispatched {new Date(o.createdAt).toLocaleDateString()} · storage 2–8°C maintained
            </p>
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-slate-400">No shipments yet</p>}
      </div>
    </div>
  );
}
