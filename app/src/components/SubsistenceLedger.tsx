import React from 'react';
import type { SubsistenceLedger as SubsistenceLedgerType } from '../types/lotspace';

interface SubsistenceLedgerProps {
  ledger: SubsistenceLedgerType;
  compact?: boolean;
}

const PILLARS = [
  {
    key: 'householdCentsPerLb' as const,
    label: 'Household',
    shortLabel: 'HH',
    color: '#2A6E73',   // teal
    description: 'Food, shelter, clothing, education',
  },
  {
    key: 'operatingCentsPerLb' as const,
    label: 'Operating',
    shortLabel: 'OP',
    color: '#3E6B50',   // leaf green
    description: 'Seeds, fertilizer, labor, processing',
  },
  {
    key: 'debtCentsPerLb' as const,
    label: 'Debt Service',
    shortLabel: 'DS',
    color: '#8C3B34',   // cherry
    description: 'Input loans & credit repayment',
  },
  {
    key: 'infrastructureCentsPerLb' as const,
    label: 'Infrastructure',
    shortLabel: 'INF',
    color: '#4A3527',   // roast
    description: 'Farm maintenance, equipment depreciation',
  },
  {
    key: 'resilienceCentsPerLb' as const,
    label: 'Resilience',
    shortLabel: 'RES',
    color: '#C9A34A',   // gold
    description: 'Crop insurance, savings, climate buffer',
  },
];

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export const SubsistenceLedger: React.FC<SubsistenceLedgerProps> = ({
  ledger,
  compact = false,
}) => {
  const total = ledger.truePriceFloorCentsPerLb;
  const actualAboveFloor = ledger.actualFarmgateCentsPerLb - ledger.truePriceFloorCentsPerLb;
  const isAboveFloor = actualAboveFloor >= 0;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-mono text-muted tracking-widest uppercase">True Price Floor</p>
          <p className="text-2xl font-display font-semibold text-ink">
            {centsToDisplay(ledger.truePriceFloorCentsPerLb)}<span className="text-sm text-muted font-sans font-normal">/lb</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-muted tracking-widest uppercase">Actual Farmgate</p>
          <p className={`text-2xl font-display font-semibold ${isAboveFloor ? 'text-leaf' : 'text-cherry'}`}>
            {centsToDisplay(ledger.actualFarmgateCentsPerLb)}<span className="text-sm font-sans font-normal opacity-70">/lb</span>
          </p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="space-y-2">
        <div className="flex h-5 rounded-sm overflow-hidden w-full">
          {PILLARS.map((pillar) => {
            const pct = (ledger[pillar.key] / total) * 100;
            return (
              <div
                key={pillar.key}
                style={{ width: `${pct}%`, backgroundColor: pillar.color }}
                title={`${pillar.label}: ${centsToDisplay(ledger[pillar.key])}/lb`}
                className="transition-all duration-base"
              />
            );
          })}
        </div>

        {/* Farmer surplus bar */}
        {isAboveFloor && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-recessed rounded-sm overflow-hidden">
              <div
                className="h-full bg-leaf rounded-sm"
                style={{ width: `${Math.min((actualAboveFloor / ledger.actualFarmgateCentsPerLb) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-leaf font-semibold whitespace-nowrap">
              +{centsToDisplay(actualAboveFloor)}/lb surplus
            </span>
          </div>
        )}
      </div>

      {/* Pillar breakdown */}
      {!compact && (
        <div className="space-y-1.5">
          {PILLARS.map((pillar) => (
            <div key={pillar.key} className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: pillar.color }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-sans text-ink font-medium">{pillar.label}</span>
                <span className="text-[10px] text-muted font-sans ml-1.5 hidden sm:inline">
                  — {pillar.description}
                </span>
              </div>
              <span className="text-xs font-mono text-ink font-semibold tabular-nums">
                {centsToDisplay(ledger[pillar.key])}/lb
              </span>
            </div>
          ))}
          {/* Divider + total */}
          <div className="border-t border-border pt-2 flex justify-between items-center">
            <span className="text-xs font-mono text-muted uppercase tracking-wider">Floor Total</span>
            <span className="text-sm font-mono font-bold text-ink">{centsToDisplay(total)}/lb</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-muted uppercase tracking-wider">Actual Farmgate</span>
            <span className={`text-sm font-mono font-bold ${isAboveFloor ? 'text-leaf' : 'text-cherry'}`}>
              {centsToDisplay(ledger.actualFarmgateCentsPerLb)}/lb
            </span>
          </div>
          <p className="text-[10px] text-subtle font-mono pt-1">{ledger.seasonLabel} · Updated {new Date(ledger.lastUpdatedAt).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};
