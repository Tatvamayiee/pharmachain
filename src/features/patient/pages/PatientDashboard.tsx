import { useEffect, useState } from 'react';
import { getDB, Sale, Reminder, RefillRow } from '../../../platform/database/db';
import { useAuth } from '../../../platform/auth/auth';
import { StatCard } from '../../admin/pages/AdminDashboard';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [refills, setRefills] = useState<RefillRow[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      setSales(await db.getAll('sales'));
      setReminders(await db.getAll('reminders'));
      setRefills(await db.getAll('refills'));
    })();
  }, []);

  const mySales = sales.filter(s => s.buyerEmail === user?.email);
  const myReminders = reminders.filter(r => r.patientEmail === user?.email && !r.done);
  const myRefills = refills.filter(r => r.patientEmail === user?.email && !r.done);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Patient Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">Welcome, {user?.name}</p>
      <div className="mb-8 grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Purchases" value={mySales.length} />
        <StatCard label="Pending Doses" value={myReminders.length} color="bg-amber-500" />
        <StatCard label="Refills Due" value={myRefills.length} color="bg-rose-500" />
      </div>
      <h2 className="mb-3 font-semibold">Your Medicines</h2>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Drug</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Purchased</th></tr>
          </thead>
          <tbody>
            {mySales.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.drugName}</td>
                <td className="px-4 py-2">{s.quantity}</td>
                <td className="px-4 py-2 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {mySales.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No purchases yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
