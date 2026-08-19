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
  Cell,
} from 'recharts';
import type { GrowthCampaignLiftPoint } from '../../stores/selectors/analytics-selectors';

export interface CampaignLiftChartProps {
  title: string;
  data: GrowthCampaignLiftPoint[];
}

const tooltipStyle = {
  backgroundColor: '#16323E',
  borderColor: '#16323E',
  borderRadius: '6px',
  color: '#FDFBF5',
  fontFamily: 'IBM Plex Mono',
  fontSize: '11px',
};

export const CampaignLiftChart: React.FC<CampaignLiftChartProps> = ({
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
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
            <XAxis
              dataKey="campaignName"
              stroke="#8A8272"
              fontSize={9}
              tickLine={false}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis domain={[0, 1]} stroke="#8A8272" fontSize={10} tickLine={false} />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'lift') return [`${value}`, 'Lift'];
                return [`${value}`, 'Probability'];
              }}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#FDFBF5' }}
            />
            <ReferenceLine
              y={0.95}
              stroke="#8C3B34"
              strokeDasharray="3 3"
              label={{
                value: '95% threshold',
                fill: '#8C3B34',
                fontSize: 10,
                position: 'top',
              }}
            />
            <Bar dataKey="probability" name="Probability">
              {data.map((entry) => (
                <Cell
                  key={entry.campaignName}
                  fill={entry.isSignificant ? '#C9A34A' : '#D8CFBB'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
