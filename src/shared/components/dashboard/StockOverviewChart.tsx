import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCardFrame from './ChartCardFrame';
import type { StockPoint } from '../../../features/manufacturer/data/manufacturerData';

interface StockOverviewChartProps {
  data: StockPoint[];
  loading?: boolean;
}

/** Blue bar chart of total vs low stock across all medicines. */
export default function StockOverviewChart({ data, loading = false }: StockOverviewChartProps) {
  const isEmpty = !loading && data.length === 0;

  return (
    <ChartCardFrame
      title="Stock Overview"
      subtitle="Total stock across all medicines"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="No stock data available yet. Stock levels will appear here once medicines are added or received."
    >
      <div className="h-64 w-full" role="img" aria-label="Bar chart comparing total stock and low stock across all medicines">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 13 }}
              dy={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'rgba(79, 70, 229, 0.06)' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                fontSize: 13,
              }}
              formatter={(value) => [Number(value).toLocaleString(), 'Units']}
            />
            <Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} maxBarSize={72} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCardFrame>
  );
}
