import { useEffect, useState } from 'react';
import { getDB, Order, logActivity, notify } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function DelayAlerts() {
  const { user } = useAuth();
  const [delayed, setDelayed] = useState<Order[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('orders');
      const cutoff = Date.now() - 24 * 86400_000;
      setDelayed(all.filter(o =>
        (o.status === 'dispatched' || o.status === 'in_transit') &&
        new Date(o.createdAt).getTime() < cutoff
      ));
    })();
  }, []);

  const escalate = async (o: Order) => {
    await logActivity(user?.name ?? '', 'delay escalated', `${o.drugName} → ${o.to}`);
    await notify(o.to, '⏰ Delivery delayed', `${o.drugName} ×${o.quantity} is past its ETA. Transport is investigating.`);
    setDelayed(prev => prev.filter(x => x.id !== o.id));
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Delay Alerts</h1>
      <p className="mb-4 text-sm text-slate-500">Deliveries in transit for more than 24 hours.</p>
      <div className="space-y-2">
        {delayed.map(o => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-medium">{o.drugName} ×{o.quantity}</p>
              <p className="text-xs text-slate-500">{o.from} → {o.to} · since {new Date(o.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => escalate(o)} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">Notify receiver</button>
          </div>
        ))}
        {delayed.length === 0 && <p className="text-sm text-slate-400">No delayed deliveries ✅</p>}
      </div>
    </div>
  );
}
