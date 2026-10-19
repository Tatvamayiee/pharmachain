import { FormEvent, useEffect, useState } from 'react';
import { getDB, generateId, RefillRow } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function RefillReminder() {
  const { user } = useAuth();
  const [refills, setRefills] = useState<RefillRow[]>([]);

  const load = async () => {
    const db = await getDB();
    const all = await db.getAll('refills');
    setRefills(all.filter(r => r.patientEmail === user?.email).reverse());
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = new FormData(f);
    const db = await getDB();
    await db.add('refills', {
      id: generateId(), patientEmail: user?.email ?? '',
      drugName: String(data.get('drugName') || ''),
      refillDue: String(data.get('due') || ''),
      done: false,
    });
    f.reset(); load();
  };

  const markDone = async (r: RefillRow) => {
    const db = await getDB();
    await db.put('refills', { ...r, done: true });
    load();
  };

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Refill Reminders</h1>
      <form onSubmit={add} className="mb-6 space-y-3 rounded-xl border-slate-200 bg-white p-4">
        <input name="drugName" required placeholder="Medicine name" className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <input name="due" type="date" required className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Add reminder</button>
      </form>
      <div className="space-y-2">
        {refills.map(r => (
          <div key={r.id} className={`flex items-center justify-between rounded-xl border-slate-200 bg-white p-4 ${r.done ? 'opacity-50' : ''}`}>
            <div>
              <p className="text-sm font-medium">{r.drugName}</p>
              <p className="text-xs text-slate-500">refill due {new Date(r.refillDue).toLocaleDateString()}</p>
            </div>
            {!r.done && <button onClick={() => markDone(r)} className="text-xs text-indigo-600 hover:underline">Done</button>}
          </div>
        ))}
        {refills.length === 0 && <p className="text-sm text-slate-400">No refill reminders yet</p>}
      </div>
    </div>
  );
}
