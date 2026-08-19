import React from 'react';
import type { Segment } from '../../types/api';
import type { HazardHeatmapRow } from '../../types/api';
import { GrowthWidgetCard } from './GrowthWidgetCard';

export interface HazardHeatmapProps {
  title: string;
  description?: string;
  data: HazardHeatmapRow[];
}

const TIERS: Array<'T1' | 'T2' | 'T3'> = ['T3', 'T2', 'T1'];
const SEGMENTS: Segment[] = ['micro', 'boutique', 'commercial'];

function findRow(
  data: HazardHeatmapRow[],
  tier: 'T1' | 'T2' | 'T3',
  segment: Segment,
): HazardHeatmapRow | undefined {
  return data.find((d) => d.tier === tier && d.segment === segment);
}

function hazardColorClass(value: number): string {
  if (value < 0.3) return 'bg-leaf text-white';
  if (value < 0.7) return 'bg-gold/70 text-ink';
  return 'bg-cherry text-white';
}

export const HazardHeatmap: React.FC<HazardHeatmapProps> = ({ title, description, data }) => {
  return (
    <GrowthWidgetCard title={title} description={description}>
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse border border-border font-sans text-xs">
          <thead>
            <tr className="bg-recessed/20 border-b border-border text-muted">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Tier</th>
              {SEGMENTS.map((segment) => (
                <th key={segment} scope="col" className="px-2 py-2 font-semibold capitalize">
                  {segment}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {TIERS.map((tier) => (
              <tr key={tier}>
                <th scope="row" className="px-3 py-2.5 text-left font-sans text-ink font-semibold">
                  {tier}
                </th>
                {SEGMENTS.map((segment) => {
                  const row = findRow(data, tier, segment);
                  const count = row?.count;
                  const avgHazard = row?.avgHazard;
                  return (
                    <td
                      key={`${tier}-${segment}`}
                      className={`px-2 py-2 border-l border-border ${
                        avgHazard == null ? 'bg-transparent text-subtle/30' : hazardColorClass(avgHazard)
                      }`}
                    >
                      {avgHazard != null ? (
                        <div className="leading-tight">
                          <div className="text-[10px] font-sans opacity-90">{count} accounts</div>
                          <div className="figure font-bold">{avgHazard.toFixed(2)}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GrowthWidgetCard>
  );
};
