import React from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { SCAAttributes } from '../types/lotspace';

interface CuppingScoreDisplayProps {
  cupScore: number;
  attributes?: SCAAttributes;
  compact?: boolean;
  graderName?: string | null;
}

const ATTRIBUTE_LABELS: Record<keyof SCAAttributes, string> = {
  fragrance: 'Fragrance',
  flavor: 'Flavor',
  aftertaste: 'Aftertaste',
  acidity: 'Acidity',
  body: 'Body',
  balance: 'Balance',
  sweetness: 'Sweetness',
};

function scoreTier(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'Outstanding', className: 'text-gold bg-gold/10 border-gold/40' };
  if (score >= 87) return { label: 'Excellent', className: 'text-teal bg-teal/10 border-teal/30' };
  if (score >= 84) return { label: 'Very Good', className: 'text-leaf bg-leaf/10 border-leaf/30' };
  if (score >= 80) return { label: 'Good', className: 'text-muted bg-recessed border-border' };
  return { label: 'Below Specialty', className: 'text-muted bg-recessed border-border' };
}

// Custom tooltip for radar chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border rounded-md px-2 py-1 shadow-e2 text-xs font-mono">
        <span className="text-ink font-semibold">{payload[0].payload.attribute}: </span>
        <span className="text-teal">{payload[0].value}</span>
      </div>
    );
  }
  return null;
};

export const CuppingScoreDisplay: React.FC<CuppingScoreDisplayProps> = ({
  cupScore,
  attributes,
  compact = false,
  graderName,
}) => {
  const tier = scoreTier(cupScore);

  const radarData = attributes
    ? Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => ({
        attribute: label,
        score: attributes[key as keyof SCAAttributes],
        fullMark: 10,
      }))
    : null;

  return (
    <div className="space-y-3">
      {/* Score headline */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-mono text-muted tracking-widest uppercase">SCA Cup Score</span>
          <span className="text-4xl font-display font-semibold text-ink leading-none">
            {cupScore.toFixed(2)}
          </span>
        </div>
        <div className={`px-3 py-1.5 rounded-full border text-xs font-mono font-semibold ${tier.className}`}>
          {tier.label}
        </div>
      </div>

      {/* Radar chart */}
      {!compact && radarData && (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="rgb(var(--gs-border))" />
              <PolarAngleAxis
                dataKey="attribute"
                tick={{ fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', fill: 'rgb(var(--gs-text-muted))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#2A6E73"
                fill="#2A6E73"
                fillOpacity={0.18}
                strokeWidth={1.5}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attribute table */}
      {!compact && attributes && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-[10px] text-muted font-mono">{label}</span>
              <span className="text-xs font-mono font-semibold text-ink">
                {attributes[key as keyof SCAAttributes].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {graderName && (
        <p className="text-[10px] text-subtle font-mono">Graded by {graderName}</p>
      )}
    </div>
  );
};
