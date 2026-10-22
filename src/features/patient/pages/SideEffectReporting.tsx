import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getDB, generateId, SideEffectRow, logActivity, notify } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';

export default function SideEffectReporting() {
  const { user } = useAuth();
  const [reports, setReports] = useState<SideEffectRow[]>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const db = await getDB();
    const all = await db.getAll('sideeffects');
    setReports(all.filter(r => r.patientEmail === user?.email).reverse());
  }, [user?.email]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = new FormData(f);
    const db = await getDB();
    const row: SideEffectRow = {
      id: generateId(), patientEmail: user?.email ?? '',
      drugName: String(data.get('drugName') || ''),
      severity: String(data.get('severity')) as SideEffectRow['severity'],
      description: String(data.get('description') || ''),
      at: new Date().toISOString(),
    };
    await db.add('sideeffects', row);
    await logActivity(user?.name ?? '', 'side effect reported', `${row.drugName} (${row.severity})`);
    await notify(null, `Side effect reported: ${row.drugName}`, `Severity ${row.severity} — flagged for manufacturer review.`);
    f.reset(); setMsg('Report submitted — regulators and the manufacturer have been notified.'); await load();
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Side Effect Reporting</h1>
      <form onSubmit={submit} className="space-y-3 rounded-xl border-slate-200 bg-white p-4">
        <input name="drugName" required placeholder="Medicine name" className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <select name="severity" className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm">
          <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
        </select>
        <textarea name="description" required placeholder="Describe the side effect…" rows={3} className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Submit report</button>
      </form>
      {msg && <p className="mt-4 text-sm text-emerald-600">{msg}</p>}
      <div className="mt-6 space-y-2">
        {reports.map(r => (
          <div key={r.id} className="rounded-xl border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium">{r.drugName} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{r.severity}</span></p>
            <p className="text-xs text-slate-500">{r.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
