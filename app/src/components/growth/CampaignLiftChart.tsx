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
import { GrowthWidgetCard } from './GrowthWidgetCard';
import { GROWTH_CHART_TOOLTIP_STYLE } from './chart-styles';

export interface CampaignLiftChartProps {
  title: string;
  description?: string;
  data: GrowthCampaignLiftPoint[];
}

export const CampaignLiftChart: React.FC<CampaignLiftChartProps> = ({
  title,
  description,
  data,
}) => {
  return (
    <GrowthWidgetCard title={title} description={description}>
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
              formatter={(value) => [`${value}`, 'Probability']}
              contentStyle={GROWTH_CHART_TOOLTIP_STYLE}
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
    </GrowthWidgetCard>
  );
};
