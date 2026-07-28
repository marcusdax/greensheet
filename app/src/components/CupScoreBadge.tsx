import React from 'react';

interface CupScoreBadgeProps {
  score: number;
  size?: 'sm' | 'lg';
}

export const CupScoreBadge: React.FC<CupScoreBadgeProps> = ({ score, size = 'sm' }) => {
  const formattedScore = score.toFixed(1);
  let badgeClasses = '';
  let tick = false;

  if (score >= 90) {
    badgeClasses = 'bg-gold text-ink border border-navy/20';
    tick = true;
  } else if (score >= 85) {
    badgeClasses = 'bg-teal text-white';
  } else if (score >= 80) {
    badgeClasses = 'bg-leaf text-white';
  } else {
    badgeClasses = 'bg-neutral-700 text-white';
  }

  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-lg font-bold' : 'px-2 py-0.5 text-sm font-bold';

  return (
    <span className={`inline-flex items-center rounded-full font-mono figure-strong ${badgeClasses} ${sizeClasses}`}>
      {formattedScore}
      {tick && (
        <span className="ml-1 text-[10px] inline-flex items-center" aria-hidden="true">
          ✓
        </span>
      )}
    </span>
  );
};
