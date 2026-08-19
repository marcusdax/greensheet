import React from 'react';
import type { GrowthKFactorPoint } from '../../stores/selectors/analytics-selectors';
import { GrowthWidgetCard } from './GrowthWidgetCard';

export interface KFactorGaugeProps {
  title: string;
  description?: string;
  data: GrowthKFactorPoint;
}

export const KFactorGauge: React.FC<KFactorGaugeProps> = ({ title, description, data }) => {
  const percentage = Math.min(100, Math.max(0, (data.current / data.target) * 100));

  return (
    <GrowthWidgetCard title={title} description={description}>
      <div className="h-64 flex flex-col items-center justify-center space-y-5">
        <div className="text-center">
          <div className="text-4xl font-display font-medium text-ink" data-testid="kfactor-current">
            {data.current.toFixed(2)}
          </div>
          <div className="text-sm text-muted mt-1">
            Target {data.target.toFixed(2)} &middot; Gap {data.gap.toFixed(2)}
          </div>
        </div>

        <div className="w-full max-w-xs space-y-1">
          <div className="w-full h-3 bg-recessed/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted font-mono">
            <span>0</span>
            <span>{data.target.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </GrowthWidgetCard>
  );
};
