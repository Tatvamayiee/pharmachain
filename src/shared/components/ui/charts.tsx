import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Inbox } from 'lucide-react';
import type { ChartPoint } from '../../types';

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  fontSize: 13,
} as const;

function Frame({ title, subtitle, loading, empty, children }: {
  title: string; subtitle?: string; loading?: boolean; empty?: string; children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </header>
      {loading ? (
        <div className="flex h-64 animate-pulse items-end gap-6 px-2 pb-2" role="status" aria-label={`Loading ${title}`}>
          <div className="h-3/4 flex-1 rounded-t-lg bg-indigo-50" />
          <div className="h-1/2 flex-1 rounded-t-lg bg-indigo-50" />
          <div className="h-2/3 flex-1 rounded-t-lg bg-indigo-50" />
          <span className="sr-only">Loading chart…</span>
        </div>
      ) : empty ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
          <Inbox size={28} className="text-slate-300" aria-hidden="true" />
          <p className="max-w-xs px-4 text-sm text-slate-500">{empty}</p>
        </div>
      ) : children}
    </section>
  );
}

export function BarChartCard({ title, subtitle, data, loading, color = '#4f46e5', emptyMessage }: {
  title: string; subtitle?: string; data: ChartPoint[]; loading?: boolean; color?: string; emptyMessage?: string;
}) {
  const empty = !loading && data.length === 0;
  return (
    <Frame title={title} subtitle={subtitle} loading={loading} empty={empty ? (emptyMessage ?? 'No data available yet.') : undefined}>
      <div className="h-64 w-full" role="img" aria-label={`${title} bar chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 12 }} dy={6} interval={0} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={44} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v))} />
            <Tooltip cursor={{ fill: 'rgba(79,70,229,0.06)' }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value).toLocaleString(), 'Units']} />
            <Bar dataKey="value" fill={color} radius={[8, 8, 0, 0]} maxBarSize={64}>
              {data.map((d) => <Cell key={d.label} fill={d.value === 0 ? '#cbd5e1' : color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  );
}

export function DonutChartCard({ title, subtitle, data, loading, colors, emptyMessage }: {
  title: string; subtitle?: string; data: ChartPoint[]; loading?: boolean; colors: Record<string, string>; emptyMessage?: string;
}) {
  const empty = !loading && data.length === 0;
  return (
    <Frame title={title} subtitle={subtitle} loading={loading} empty={empty ? (emptyMessage ?? 'No data available yet.') : undefined}>
      <div className="h-64 w-full" role="img" aria-label={`${title} donut chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="80%" paddingAngle={3} cornerRadius={6} strokeWidth={0}>
              {data.map((d) => <Cell key={d.label} fill={colors[d.label] ?? '#94a3b8'} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [Number(value).toLocaleString(), String(name)]} />
            <Legend verticalAlign="bottom" height={34} iconType="circle" iconSize={10} formatter={(value) => <span className="text-sm text-slate-600">{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  );
}

export function AreaChartCard({ title, subtitle, data, loading, emptyMessage }: {
  title: string; subtitle?: string; data: ChartPoint[]; loading?: boolean; emptyMessage?: string;
}) {
  const empty = !loading && data.length === 0;
  return (
    <Frame title={title} subtitle={subtitle} loading={loading} empty={empty ? (emptyMessage ?? 'No activity data yet.') : undefined}>
      <div className="h-64 w-full" role="img" aria-label={`${title} area chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 12 }} dy={6} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={44} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2.5} fill="url(#areaFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  );
}

export { AlertTriangle };
