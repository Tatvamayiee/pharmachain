import { FormEvent, useEffect, useState } from 'react';
import { getDB, generateId, Reminder } from '../../lib/db';
import { useAuth } from '../../lib/auth';

export default function UsageReminder() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const load = async () => {
    const db = await getDB();
    const all = await db.getAll('reminders');
    setReminders(all.filter(r => r.patientEmail === user?.email).reverse());
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = new FormData(f);
    const db = await getDB();
    await db.add('reminders', {
      id: generateId(), patientEmail: user?.email ?? '',
      drugName: String(data.get('drugName') || ''),
      nextDoseAt: new Date(String(data.get('time') || '')).toISOString(),
      done: false,
    });
    f.reset(); load();
  };

  const take = async (r: Reminder) => {
    const db = await getDB();
    await db.put('reminders', { ...r, done: true });
    load();
  };

  const due = (iso: string) => new Date(iso).getTime() <= Date.now();

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Usage Reminders</h1>
      <form onSubmit={add} className="mb-6 space-y-3 rounded-xl border-slate-200 bg-white p-4">
        <input name="drugName" required placeholder="Medicine name" className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <input name="time" type="datetime-local" required className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm" />
        <button className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700">Add dose reminder</button>
      </form>
      <div className="space-y-2">
        {reminders.map(r => (
          <div key={r.id} className={`flex items-center justify-between rounded-xl border-slate-200 bg-white p-4 ${r.done ? 'opacity-50' : ''}`}>
            <div>
              <p className="text-sm font-medium">{r.drugName}</p>
              <p className={`text-xs ${!r.done && due(r.nextDoseAt) ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                {r.done ? 'taken' : due(r.nextDoseAt) ? '⚠️ due now!' : `next dose ${new Date(r.nextDoseAt).toLocaleString()}`}
              </p>
            </div>
            {!r.done && <button onClick={() => take(r)} className="text-xs text-indigo-600 hover:underline">Taken</button>}
          </div>
        ))}
        {reminders.length === 0 && <p className="text-sm text-slate-400">No reminders yet</p>}
      </div>
    </div>
  );
}
