import React from 'react';
import { Award } from 'lucide-react';
import type { CurriculumTrack, ModuleStatus } from '../types/ledger';

interface CupScoreBadgeProps {
  score: number;
  size?: 'sm' | 'lg';
  /**
   * Optional curriculum completion status. When provided, a small
   * sub-badge is rendered after the cup score indicating how many
   * curriculum modules the lot's farmer has completed.
   */
  curriculum?: {
    /** Number of completed modules to display. */
    completedModules: number;
    /** Total modules in scope (for ratio display). */
    totalModules?: number;
    /** Whether to render as a condensed dot instead of a text badge. */
    condensed?: boolean;
  };
  /** Controls the visual styling of the curriculum badge. */
  curriculumStatus?: ModuleStatus;
  /**
   * Optional curriculum completion track. When provided alongside
   * `curriculum`, a small track-colored Award icon is rendered to
   * indicate completion for that track (quality, compliance, finance,
   * logistics).
   */
  curriculumTier?: CurriculumTrack;
}

const STATUS_CLASSES: Record<ModuleStatus, string> = {
  completed: 'bg-leaf text-white',
  in_progress: 'bg-teal text-white',
  available: 'bg-slate text-white',
  locked: 'bg-slate text-white',
};

/** Track-specific color mapping for the curriculum tier Award icon. */
const TIER_COLORS: Record<CurriculumTrack, string> = {
  quality:    'text-gold',
  compliance: 'text-navy',
  finance:    'text-teal',
  logistics:  'text-cherry',
};

/** Returns a short, stable label for a completion ratio. */
function completionLabel(completed: number, total?: number): string {
  if (total && total > 0) return `${completed}/${total}`;
  return `${completed}`;
}

export const CupScoreBadge: React.FC<CupScoreBadgeProps> = ({
  score,
  size = 'sm',
  curriculum,
  curriculumStatus = 'completed',
  curriculumTier,
}) => {
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
    badgeClasses = 'bg-slate text-white';
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
      {curriculum && (
        <>
          <span
            className={`ml-1.5 inline-flex items-center rounded-full font-sans ${curriculum.condensed ? 'w-1.5 h-1.5' : 'px-1 py-0.5 text-[9px] font-bold'} ${STATUS_CLASSES[curriculumStatus]}`}
            title={`Curriculum: ${curriculumStatus} (${completionLabel(curriculum.completedModules, curriculum.totalModules)} modules)`}
            aria-label={`Curriculum modules completed: ${completionLabel(curriculum.completedModules, curriculum.totalModules)}`}
          >
            {curriculum.condensed ? null : completionLabel(curriculum.completedModules, curriculum.totalModules)}
          </span>
          {curriculumTier && (
            <span
              className="ml-1 inline-flex"
              title={`Curriculum track: ${curriculumTier}`}
              aria-label={curriculumTier}
            >
              <Award
                className={`h-3 w-3 ${TIER_COLORS[curriculumTier]}`}
                aria-hidden="true"
              />
            </span>
          )}
        </>
      )}
    </span>
  );
};
