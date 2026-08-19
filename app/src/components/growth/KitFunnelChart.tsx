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
import { GrowthWidgetCard } from './GrowthWidgetCard';
import { GROWTH_CHART_TOOLTIP_STYLE } from './chart-styles';

export interface KitFunnelChartProps {
  title: string;
  data: GrowthFunnelPoint[];
}

const FUNNEL_COLORS = ['#16323E', '#2A6E73', '#C9A34A', '#8C3B34'];

export const KitFunnelChart: React.FC<KitFunnelChartProps> = ({ title, data }) => {
  return (
    <GrowthWidgetCard title={title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis dataKey="stage" stroke="#8A8272" fontSize={10} tickLine={false} interval={0} />
            <YAxis stroke="#8A8272" fontSize={10} tickLine={false} />
            <Tooltip
              formatter={(value, name) => [value, name]}
              contentStyle={GROWTH_CHART_TOOLTIP_STYLE}
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
    </GrowthWidgetCard>
  );
};
