import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import ChartCardFrame from './ChartCardFrame';
import type { BatchSlice } from '../../lib/manufacturerData';

const COLORS: Record<BatchSlice['name'], string> = {
  Active: '#4f46e5', // blue (indigo)
  Expired: '#f97316', // orange
  Recalled: '#22c55e', // green
};

interface BatchDistributionChartProps {
  data: BatchSlice[];
  loading?: boolean;
}

/** Donut chart of active vs expired vs recalled batches with a bottom legend. */
export default function BatchDistributionChart({ data, loading = false }: BatchDistributionChartProps) {
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartCardFrame
      title="Batch Distribution"
      subtitle="Active vs Recalled vs Expired"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No batch data available yet. Create a batch to see its distribution here."
    >
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Donut chart of batch distribution: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={3}
              cornerRadius={6}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                fontSize: 13,
              }}
              formatter={(value, name) => [Number(value).toLocaleString(), String(name)]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={10}
              formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCardFrame>
  );
}
