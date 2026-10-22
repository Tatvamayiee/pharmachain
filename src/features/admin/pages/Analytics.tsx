import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useCoreData } from './AdminDashboard';

const COLORS = ['#4f46e5', '#f59e0b', '#10b981', '#0ea5e9', '#f43f5e'];

export default function Analytics() {
  const { batches, sales, scans } = useCoreData();

  const byDrug = Object.values(
    batches.reduce<Record<string, { name: string; units: number }>>((acc, b) => {
      acc[b.drugName] = acc[b.drugName] || { name: b.drugName, units: 0 };
      acc[b.drugName].units += b.quantity;
      return acc;
    }, {})
  );

  const scanMix = (['green', 'orange', 'red'] as const).map(r => ({
    name: r, value: scans.filter(s => s.result === r).length,
  })).filter(x => x.value > 0);

  const salesByDrug = Object.values(
    sales.reduce<Record<string, { name: string; units: number }>>((acc, s) => {
      acc[s.drugName] = acc[s.drugName] || { name: s.drugName, units: 0 };
      acc[s.drugName].units += s.quantity;
      return acc;
    }, {})
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>
      <div className="grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Units Produced by Drug</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDrug}><XAxis dataKey="name" fontSize={10} /><YAxis /><Tooltip />
              <Bar dataKey="units" fill="#4f46e5" radius={4} /></BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Scan Outcomes</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart><Pie data={scanMix} dataKey="value" nameKey="name" outerRadius={80}>
              {scanMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie><Legend /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Units Sold by Drug</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesByDrug}><XAxis dataKey="name" fontSize={10} /><YAxis /><Tooltip />
              <Bar dataKey="units" fill="#10b981" radius={4} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
