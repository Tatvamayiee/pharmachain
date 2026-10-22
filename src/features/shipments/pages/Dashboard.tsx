import { useEffect, useState } from 'react';
import { api, Shipment } from '../../../platform/api/api';
import { useAuth } from '../../../platform/auth/auth';

export default function Dashboard() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Shipment[]>('/api/shipments').then(setShipments).catch(e => setError(e.message));
    const t = setInterval(() => api<Shipment[]>('/api/shipments').then(setShipments).catch(() => { }), 5000);
    return () => clearInterval(t);
  }, []);

  const stats = [
    { label: 'Total Shipments', value: shipments.length, color: 'bg-indigo-600' },
    { label: 'In Transit', value: shipments.filter(s => s.status === 'in_transit').length, color: 'bg-amber-500' },
    { label: 'Delivered', value: shipments.filter(s => s.status === 'delivered').length, color: 'bg-emerald-600' },
    { label: 'Verified', value: shipments.filter(s => s.status === 'verified').length, color: 'bg-sky-600' },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Welcome, {user?.name}</h1>
      <p className="mb-6 text-sm text-slate-500">Role: {user?.role}</p>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="mb-8 grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border-slate-200 bg-white p-4">
            <div className={`mb-2 inline-block h-2 w-8 rounded-full ${s.color}`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
      <h2 className="mb-3 font-semibold">Recent Shipments</h2>
      <div className="overflow-hidden rounded-xl border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th><th className="px-4 py-3">Drug</th>
              <th className="px-4 py-3">Qty</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3">{s.drugName}</td>
                <td className="px-4 py-3">{s.quantity}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{s.status.replace('_', ' ')}</span>
                </td>
              </tr>
            ))}
            {shipments.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No shipments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
