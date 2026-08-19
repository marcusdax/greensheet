import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { WtrPoint } from '../../types/api';

export interface WtrChartProps {
  title: string;
  data: WtrPoint[];
}

const tooltipStyle = {
  backgroundColor: '#16323E',
  borderColor: '#16323E',
  borderRadius: '6px',
  color: '#FDFBF5',
  fontFamily: 'IBM Plex Mono',
  fontSize: '11px',
};

export const WtrChart: React.FC<WtrChartProps> = ({ title, data }) => {
  return (
    <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
      <div className="border-b border-border pb-3">
        <h3 className="overline text-xs text-muted font-bold">{title}</h3>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis dataKey="week" stroke="#8A8272" fontSize={10} tickLine={false} interval={0} />
            <YAxis domain={[0, 'auto']} stroke="#8A8272" fontSize={10} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#FDFBF5' }} />
            <Line
              type="monotone"
              dataKey="wtr"
              stroke="#2A6E73"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="WTR"
            />
            <Line
              type="monotone"
              dataKey="movingAverage"
              stroke="#C9A34A"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3 }}
              name="Moving Average"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
