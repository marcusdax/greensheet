import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  Cell,
} from 'recharts';
import type { GrowthFunnelPoint } from '../../stores/selectors/analytics-selectors';

export interface KitFunnelChartProps {
  title: string;
  data: GrowthFunnelPoint[];
}

const FUNNEL_COLORS = ['#16323E', '#2A6E73', '#C9A34A', '#8C3B34'];

const tooltipStyle = {
  backgroundColor: '#16323E',
  borderColor: '#16323E',
  borderRadius: '6px',
  color: '#FDFBF5',
  fontFamily: 'IBM Plex Mono',
  fontSize: '11px',
};

export const KitFunnelChart: React.FC<KitFunnelChartProps> = ({ title, data }) => {
  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="overline text-xs text-muted font-bold">{title}</h3>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis dataKey="stage" stroke="#8A8272" fontSize={10} tickLine={false} interval={0} />
            <YAxis stroke="#8A8272" fontSize={10} tickLine={false} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'conversionRate') return [`${value}%`, 'Conversion'];
                return [value, 'Count'];
              }}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#FDFBF5' }}
            />
            <Bar dataKey="count" name="Count">
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${entry.stage}`}
                  fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                />
              ))}
              <LabelList
                dataKey="conversionRate"
                position="top"
                formatter={(value) => `${Number(value)}%`}
                fill="#8A8272"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
