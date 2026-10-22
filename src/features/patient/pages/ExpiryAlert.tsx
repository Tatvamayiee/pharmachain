import { useEffect, useState } from 'react';
import { getDB, Sale } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function ExpiryAlert() {
  const { user } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const all = await db.getAll('sales');
      // patient's own purchases; check batch expiry
      const mine = all.filter(s => s.buyerEmail === user?.email);
      const result: Sale[] = [];
      for (const s of mine) {
        const b = await db.getFromIndex('batches', 'by-batchNumber', s.batchNumber);
        if (b && new Date(b.expiryDate).getTime() - Date.now() < 90 * 86400_000) result.push(s);
      }
      setItems(result);
    })();
  }, [user]);

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-bold">Expiry Alert</h1>
      <p className="mb-4 text-sm text-slate-500">Your medicines expiring within 90 days.</p>
      <div className="space-y-2">
        {items.map(s => (
          <div key={s.id} className="rounded-xl border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium">{s.drugName}</p>
            <p className="text-xs text-slate-500">batch {s.batchNumber} · bought {new Date(s.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Your medicines are all well within expiry ✅</p>}
      </div>
    </div>
  );
}
