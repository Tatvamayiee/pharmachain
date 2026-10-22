import { useCallback, useEffect, useState } from 'react';
import { getDB, Order, logActivity, notify } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function DeliveryProof() {
  const { user } = useAuth();
  const [active, setActive] = useState<Order[]>([]);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('orders');
    setActive(all.filter(o => o.status === 'in_transit' || o.status === 'dispatched'));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirm = async (o: Order) => {
    const db = await getDB();
    await db.put('orders', { ...o, status: 'delivered' });
    await logActivity(user?.name ?? '', 'delivery confirmed', `${o.drugName} ×${o.quantity} → ${o.to}`);
    await notify(o.to, '📦 Delivery arrived', `${o.drugName} ×${o.quantity} delivered by ${user?.name}. Please verify stock.`);
    setDone(`${o.drugName} → ${o.to}`); await load();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Delivery Proof</h1>
      <p className="mb-4 text-sm text-slate-500">Confirm hand-over to close out a delivery.</p>
      {done && <p className="mb-4 text-sm text-emerald-600">✅ Delivered: {done}</p>}
      <div className="space-y-2">
        {active.map(o => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{o.drugName} ×{o.quantity}</p>
              <p className="text-xs text-slate-500">{o.from} → {o.to}</p>
            </div>
            <button onClick={() => confirm(o)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Confirm delivery</button>
          </div>
        ))}
        {active.length === 0 && <p className="text-sm text-slate-400">No active deliveries to confirm</p>}
      </div>
    </div>
  );
}
