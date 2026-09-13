import React from 'react';

export interface TrustScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  evidenceCount?: number;
  modelVersion?: string;
}

/** 5-band Trust Score — never rendered without its band (§5.1). */
export const TrustScoreBadge: React.FC<TrustScoreBadgeProps> = ({
  score,
  size = 'sm',
  evidenceCount,
  modelVersion,
}) => {
  const bandLabels: Record<string, string> = {
    sealed: 'Sealed',
    verified: 'Verified',
    established: 'Established',
    provisional: 'Provisional',
    at_risk: 'At Risk',
  };

  const bandColors: Record<string, string> = {
    sealed: 'bg-gold text-ink-900',
    verified: 'bg-teal text-white',
    established: 'bg-cherry-100 text-cherry border border-cherry/30',
    provisional: 'bg-slate-700 text-white',
    at_risk: 'bg-danger-bg text-danger',
  };

  // Band lookup: descending by min score
  let band = 'at_risk';
  if (score >= 90) band = 'sealed';
  else if (score >= 75) band = 'verified';
  else if (score >= 55) band = 'established';
  else if (score >= 35) band = 'provisional';

  const label = bandLabels[band];
  const colorClass = bandColors[band];
  const shown = score.toFixed(score % 1 === 0 ? 0 : 1);

  const tooltip = [
    `Trust Score ${shown} — ${label}`,
    evidenceCount !== undefined ? `${evidenceCount} accepted document${evidenceCount === 1 ? '' : 's'}` : null,
    modelVersion ? `model ${modelVersion}` : null,
  ].filter(Boolean).join(' · ');

  const sizeClasses =
    size === 'md'
      ? 'h-7 px-2.5 text-xs'
      : 'h-6 px-2 text-[11px]';

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center gap-1 rounded-full font-mono font-bold tabular-nums ${colorClass} ${sizeClasses}`}
    >
      {band === 'sealed' && (
        <span aria-hidden className="text-[10px]">●</span>
      )}
      {shown}
      <span className="font-sans font-medium opacity-80 text-[10px]">{label}</span>
    </span>
  );
};
