import { useCallback, useEffect, useState } from 'react';
import { getDB, generateId, Order, logActivity, notify } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

const THRESHOLD = 50;

export default function AutoReorder() {
  const { user } = useAuth();
  const [placed, setPlaced] = useState<string[]>([]);

  const run = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('stock');
    const orders = await db.getAll('orders');
    const low = all.filter(s => s.owner === user?.name && s.quantity < THRESHOLD);
    const results: string[] = [];
    for (const item of low) {
      const existing = orders.find(o => o.from === user?.name && o.drugName === item.drugName && o.status === 'pending');
      if (existing) { results.push(`${item.drugName}: order already pending`); continue; }
      const o: Order = { id: generateId(), from: user?.name ?? '', to: item.role === 'pharmacy' ? 'MediDist Dealer' : 'Acme Pharma', drugName: item.drugName, quantity: 200, status: 'pending', createdAt: new Date().toISOString() };
      await db.add('orders', o);
      await logActivity(user?.name ?? '', 'auto-reorder', `${item.drugName} ×200 from ${o.to}`);
      await notify(o.to, 'New reorder request', `${user?.name} needs ${item.drugName} ×200`);
      results.push(`${item.drugName}: ordered 200 from ${o.to}`);
    }
    setPlaced(results);
  }, [user?.name]);

  useEffect(() => { void run(); }, [run]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">Auto Reorder</h1>
      <p className="mb-4 text-sm text-slate-500">Places a 200-unit reorder with your supplier for any line below {THRESHOLD} units.</p>
      <button onClick={run} className="mb-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Run reorder scan</button>
      <div className="space-y-2">
        {placed.map((p, i) => <p key={i} className="rounded-lg bg-indigo-50 px-4 py-2 text-sm text-indigo-700">{p}</p>)}
        {placed.length === 0 && <p className="text-sm text-slate-400">All stock levels are healthy ✅</p>}
      </div>
    </div>
  );
}
