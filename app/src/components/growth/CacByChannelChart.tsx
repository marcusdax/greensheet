import React from 'react';
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

export interface CacByChannelChartProps {
  title: string;
  data: CacChannelRow[];
}

const tooltipStyle = {
  backgroundColor: '#16323E',
  borderColor: '#16323E',
  borderRadius: '6px',
  color: '#FDFBF5',
  fontFamily: 'IBM Plex Mono',
  fontSize: '11px',
};

export const CacByChannelChart: React.FC<CacByChannelChartProps> = ({
  title,
  data,
}) => {
  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="overline text-xs text-muted font-bold">{title}</h3>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis type="number" stroke="#8A8272" fontSize={10} tickLine={false} />
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
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#FDFBF5' }}
            />
            <ReferenceLine
              x={500}
              stroke="#8C3B34"
              strokeDasharray="3 3"
              label={{
                value: 'Ceiling $500',
                fill: '#8C3B34',
                fontSize: 10,
                position: 'top',
              }}
            />
            <Bar dataKey="cac" fill="#2A6E73" name="CAC" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
