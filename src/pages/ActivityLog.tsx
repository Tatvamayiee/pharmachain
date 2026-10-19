import { useEffect, useState } from 'react';
import { getDB, ActivityRow } from '../lib/db';

export default function ActivityLog() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  useEffect(() => {
    (async () => { const db = await getDB(); setRows((await db.getAll('activity')).reverse()); })();
  }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Activity Log</h1>
      <ol className="space-y-3 border-l-2 border-indigo-100 pl-4">
        {rows.map(r => (
          <li key={r.id} className="text-sm">
            <span className="font-medium">{r.actor}</span> — {r.action}
            {r.detail && <span className="text-slate-500"> · {r.detail}</span>}
            <div className="text-xs text-slate-400">{new Date(r.at).toLocaleString()}</div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-slate-400">No activity yet</li>}
      </ol>
    </div>
  );
}
