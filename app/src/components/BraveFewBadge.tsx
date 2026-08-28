import React from 'react';
import { Award } from 'lucide-react';

interface BraveFewBadgeProps {
  avgFarmgatePaidCentsPerLb?: number;
  size?: 'sm' | 'md' | 'lg';
  showAmount?: boolean;
}

export const BraveFewBadge: React.FC<BraveFewBadgeProps> = ({
  avgFarmgatePaidCentsPerLb,
  size = 'md',
  showAmount = false,
}) => {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSize = { sm: 10, md: 12, lg: 15 }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-bold tracking-wide rounded-full bg-gold/15 text-gold-600 border border-gold/50 ${sizeClasses}`}
      title={`Brave Few — paying above $3.00/lb True Price Floor${avgFarmgatePaidCentsPerLb ? `. Average: $${(avgFarmgatePaidCentsPerLb / 100).toFixed(2)}/lb` : ''}`}
    >
      <Award size={iconSize} className="text-gold" />
      <span>Brave Few</span>
      {showAmount && avgFarmgatePaidCentsPerLb && (
        <span className="opacity-80">
          ${(avgFarmgatePaidCentsPerLb / 100).toFixed(2)}/lb
        </span>
      )}
    </span>
  );
};
