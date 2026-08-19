import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { CacChannelRow } from '../../types/api';
import { GrowthWidgetCard } from './GrowthWidgetCard';
import { GROWTH_CHART_TOOLTIP_STYLE } from './chart-styles';

export interface CacByChannelChartProps {
  title: string;
  description?: string;
  data: CacChannelRow[];
  ceiling?: number;
}

export const CacByChannelChart: React.FC<CacByChannelChartProps> = ({
  title,
  description,
  data,
  ceiling = 500,
}) => {
  const xMax = useMemo(
    () => Math.max(ceiling, ...data.map((d) => d.cac)),
    [ceiling, data],
  );

  return (
    <GrowthWidgetCard title={title} description={description}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis type="number" domain={[0, xMax]} stroke="#8A8272" fontSize={10} tickLine={false} />
            <YAxis
              dataKey="channel"
              type="category"
              stroke="#8A8272"
              fontSize={10}
              tickLine={false}
              interval={0}
              width={100}
            />
            <Tooltip
              formatter={(value) => [`$${value}`, 'CAC']}
              contentStyle={GROWTH_CHART_TOOLTIP_STYLE}
              itemStyle={{ color: '#FDFBF5' }}
            />
            <ReferenceLine
              x={ceiling}
              stroke="#8C3B34"
              strokeDasharray="3 3"
              label={{
                value: `Ceiling $${ceiling}`,
                fill: '#8C3B34',
                fontSize: 10,
                position: 'top',
              }}
            />
            <Bar dataKey="cac" fill="#2A6E73" name="CAC" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GrowthWidgetCard>
  );
};
