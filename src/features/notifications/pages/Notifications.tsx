import { useCallback, useEffect, useState } from 'react';
import { getDB, NotificationRow } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);

  const load = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('notifications');
    setRows(all.filter(n => !n.targetEmail || n.targetEmail === user?.email).reverse());
  }, [user?.email]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: string) => {
    const db = await getDB();
    const n = await db.get('notifications', id);
    if (n) { await db.put('notifications', { ...n, read: true }); await load(); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Notifications</h1>
      <div className="space-y-2">
        {rows.map(n => (
          <div key={n.id} className={`rounded-xl border-slate-200 bg-white p-4 ${n.read ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">{n.title}</p>
              {!n.read && <button onClick={() => markRead(n.id)} className="text-xs text-indigo-600 hover:underline">Mark read</button>}
            </div>
            {n.body && <p className="mt-1 text-xs text-slate-500">{n.body}</p>}
            <p className="mt-1 text-[11px] text-slate-400">{new Date(n.at).toLocaleString()}</p>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No notifications</p>}
      </div>
    </div>
  );
}
