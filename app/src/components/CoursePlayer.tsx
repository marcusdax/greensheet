import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurriculum } from '../stores/root-store';
import { SEED_LESSONS, getMilestoneForModule, getModuleAuthor } from '../data/curriculum';
import type { CurriculumModule, CurriculumLesson, CurriculumMilestone } from '../types/ledger';
import type { CurriculumModuleData } from '../stores/slices/curriculum-slice';

// ─── Local fallback seed (backward compatibility) ──────────────────────────────
// When the root store catalog does not contain the requested module (e.g. tests
// that render CoursePlayer with moduleId="mod_1" without seeding the store),
// we fall back to this hardcoded seed so the component still renders the
// "Quality Foundations" module with its lessons. This preserves backward
// compatibility with the old useModuleData hook behaviour.

const SEED_MODULE_FALLBACK: CurriculumModuleData = {
  id: 'mod_1',
  title: 'Quality Foundations',
  description: 'An introductory module covering green coffee quality fundamentals, sensory evaluation, and EUDR compliance basics.',
  level: 'beginner',
  prerequisites: [],
  regionCode: 'VN-DKL',
  track: 'quality',
  lessons: ['lesson_1', 'lesson_2', 'lesson_3'],
};

const SEED_LESSONS_FALLBACK: Record<string, CurriculumLesson> = {
  lesson_1: {
    id: 'lesson_1',
    moduleId: 'mod_1',
    title: 'Introduction to Green Coffee Quality',
    content: 'Green coffee quality starts in the cherry. This lesson covers...',
    estimatedMinutes: 8,
  },
  lesson_2: {
    id: 'lesson_2',
    moduleId: 'mod_1',
    title: 'Sensory Evaluation Basics',
    content: 'Sensory evaluation is the backbone of quality assessment...',
    estimatedMinutes: 12,
  },
  lesson_3: {
    id: 'lesson_3',
    moduleId: 'mod_1',
    title: 'EUDR Traceability Requirements',
    content: 'The EU Deforestation Regulation requires...',
    estimatedMinutes: 15,
  },
};

const SEED_MILESTONE_FALLBACK: CurriculumMilestone = {
  id: 'milestone_1',
  moduleId: 'mod_1',
  lessonCount: 3,
  verificationTier: 'agent_verified',
  badgeId: 'badge_quality_foundation',
  unlocks: ['track_quality_complete'],
};

export type CourseTab = 'overview' | 'lessons' | 'progress';

export interface CoursePlayerProps {
  moduleId: string;
  onTabChange?: (tab: CourseTab) => void;
}

/**
 * Reads the lesson objects for the current module.
 *
 * Primary: the root-store catalog stores lesson ids on a module, so full lesson
 * detail is resolved from the SEED_LESSONS map.
 * Fallback: when the catalog is empty/missing the module, a local hardcoded
 * seed is used for backward compatibility.
 */
function useModuleLessons(_moduleId: string, catalogModule: CurriculumModuleData | null, fallback: boolean): CurriculumLesson[] {
  return useMemo(() => {
    const lessonIds = catalogModule?.lessons ?? (fallback ? SEED_MODULE_FALLBACK.lessons : []);
    if (!lessonIds.length) return [];
    // Try the canonical SEED_LESSONS first; fall back to the local seed map for
    // backward-compatible lesson ids (e.g. lesson_1/2/3 used by the fallback).
    return lessonIds
      .map((lessonId) => SEED_LESSONS[lessonId] ?? SEED_LESSONS_FALLBACK[lessonId])
      .filter((l): l is CurriculumLesson => Boolean(l));
  }, [catalogModule, fallback]);
}

/**
 * Builds a full CurriculumModule (with author/region/createdAt) from either the
 * store catalog data + seed author map, or the local fallback seed.
 * Returns undefined when neither source has the module.
 */
function useCurriculumModule(moduleId: string, catalogModule: CurriculumModuleData | null, fallback: boolean): CurriculumModule | undefined {
  return useMemo(() => {
    const data = catalogModule ?? (fallback ? SEED_MODULE_FALLBACK : null);
    if (!data) return undefined;

    const author = getModuleAuthor(moduleId) ?? (fallback ? 'Auctum Curriculum Team' : (getModuleAuthor(data.id) ?? 'Auctum Curriculum Team'));
    const iso = '2025-01-15T00:00:00.000Z';

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      level: data.level,
      prerequisites: data.prerequisites,
      regionCode: data.regionCode as CurriculumModule['regionCode'],
      track: data.track,
      author,
      createdAt: iso,
      updatedAt: iso,
    };
  }, [catalogModule, fallback, moduleId]);
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({ moduleId, onTabChange }) => {
  const { t } = useTranslation('curriculum');
  const [activeTab, setActiveTab] = useState<CourseTab>('overview');

  const curriculum = useCurriculum();
  const { markLessonComplete, completeModule, getModuleProgress, setCatalog } = curriculum;
  const catalogModule = curriculum.catalog?.modules[moduleId] ?? null;

  // Backward-compatibility fallback: when the store catalog is empty or does not
  // contain the requested module AND the moduleId is "mod_1", we seed the store
  // with the local fallback seed so the component renders the legacy
  // "Quality Foundations" module. For any other missing moduleId, we return the
  // not-found state.
  const fallback = !catalogModule && moduleId === 'mod_1';

  // Seed the store catalog the first time the fallback path is taken so that
  // progress tracking (markLessonComplete, completeModule) works against the
  // store instead of a disconnected local copy.
  useEffect(() => {
    if (fallback && !curriculum.catalog) {
      setCatalog({
        modules: {
          mod_1: SEED_MODULE_FALLBACK,
        },
      });
    }
    // Intentionally omit `curriculum.catalog` from deps to avoid loops;
    // the fallback flag is stable for a given moduleId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, setCatalog]);

  const resolvedCatalogModule = curriculum.catalog?.modules[moduleId] ?? (fallback ? SEED_MODULE_FALLBACK : null);

  const module = useCurriculumModule(moduleId, resolvedCatalogModule, fallback);
  const lessons = useModuleLessons(moduleId, resolvedCatalogModule, fallback);
  const milestone: CurriculumMilestone | null = getMilestoneForModule(moduleId) ?? (fallback ? SEED_MILESTONE_FALLBACK : null);

  const progress = getModuleProgress(moduleId);
  const completedLessons = progress?.lessonsCompleted ?? [];
  const completedCount = lessons.filter((l) => completedLessons.includes(l.id)).length;
  const status = progress?.status ?? 'available';

  const handleTabChange = (tab: CourseTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleMarkLessonComplete = (lessonId: string) => {
    markLessonComplete(moduleId, lessonId);
  };

  const handleReviewModule = () => {
    // "Review" re-engages a completed module. completeModule is
    // idempotent and does not re-grant trust-score points.
    completeModule(moduleId);
  };

  const handleCompleteModule = () => {
    // Complete the whole module at once from the progress tab.
    // completeModule does NOT auto-fill lessons — it marks the module
    // completed and grants +50 trust score.
    completeModule(moduleId);
  };

  const totalMinutes = lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0);
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const allLessonsCompleted = lessons.length > 0 && completedCount === lessons.length;

  const tabs: { id: CourseTab; label: string; count?: number }[] = [
    { id: 'overview', label: t('tabs.overview', 'Overview') },
    { id: 'lessons', label: t('tabs.lessons', 'Lessons') },
    { id: 'progress', label: t('tabs.progress', 'Progress') },
  ];

  if (!module) {
    return (
      <section
        className="bg-surface border border-border-strong rounded-lg shadow-e1 flex flex-col"
        data-testid="course-player"
      >
        <div className="flex-1 p-6 overflow-y-auto">
          <p className="text-sm text-muted font-sans">
            {t('noModule', 'Module not found.')}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-surface border border-border-strong rounded-lg shadow-e1 flex flex-col"
      data-testid="course-player"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-recessed/20">
        <h1 className="text-xl font-display font-semibold text-ink">{module.title}</h1>
        <p className="text-sm text-muted font-sans mt-1">{module.description}</p>
        <div className="flex gap-3 mt-3 text-xs font-mono">
          <span className="inline-flex px-2 py-0.5 rounded-full bg-recessed text-ink capitalize">
            {module.level}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full bg-recessed text-ink capitalize">
            {module.track}
          </span>
          <span className="text-subtle">~{totalMinutes} min</span>
        </div>
      </div>

      {/* Tabs */}
      <nav
        className="flex border-b border-border bg-recessed/10"
        role="tablist"
        aria-label={t('ariaLabel.courseTabs', 'Course tabs')}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-2.5 text-sm font-sans font-medium transition-all focus-visible:ring-1 focus-visible:ring-teal ${
              activeTab === tab.id
                ? 'text-teal border-b-2 border-teal'
                : 'text-muted hover:text-ink hover:bg-recessed/30'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && ` (${tab.count})`}
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4" data-testid="tab-overview">
            <div>
              <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                {t('trackHeader.author', 'Author')}
              </span>
              <p className="text-sm text-ink font-sans mt-1">{module.author}</p>
            </div>
            <div>
              <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                {t('trackHeader.region', 'Region')}
              </span>
              <p className="text-sm text-ink font-sans mt-1">{module.regionCode}</p>
            </div>
            {milestone?.badgeId && (
              <div>
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                  {t('trackHeader.milestoneBadge', 'Milestone Badge')}
                </span>
                <p className="text-sm text-ink font-sans mt-1">{milestone.badgeId}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lessons' && (
          <div className="space-y-3" data-testid="tab-lessons">
            {status === 'completed' && (
              <div className="flex items-center justify-between p-4 bg-recessed/20 border border-border rounded-md">
                <span className="text-sm font-sans text-ink">
                  {t('lessonControls.completedMessage', 'Module complete — ready for review.')}
                </span>
                <button
                  type="button"
                  onClick={handleReviewModule}
                  className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold font-sans text-navy bg-gold hover:bg-gold/90 focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1 transition-colors"
                  data-testid="review-module"
                  aria-label={t('ariaLabel.reviewModule', 'Review module')}
                >
                  {t('lessonControls.review', 'Review')}
                </button>
              </div>
            )}
            {lessons.map((lesson) => {
              const isDone = completedLessons.includes(lesson.id);
              return (
                <div
                  key={lesson.id}
                  className="border border-border rounded-md p-4 hover:border-teal/40 transition-colors"
                  data-testid={`lesson-${lesson.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-sans font-semibold text-ink">{lesson.title}</h3>
                    <span className={`text-xs font-mono ${isDone ? 'text-teal' : 'text-subtle'}`}>
                      ~{lesson.estimatedMinutes} min
                    </span>
                  </div>
                  <p className="text-xs text-muted font-sans mt-1 line-clamp-2">
                    {lesson.content}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => handleMarkLessonComplete(lesson.id)}
                        className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold font-sans text-white bg-teal hover:bg-teal/90 focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1 transition-colors"
                        data-testid={`mark-complete-${lesson.id}`}
                        aria-label={t('ariaLabel.markLessonComplete', 'Mark {{lesson}} as complete', { lesson: lesson.title })}
                      >
                        {t('lessonControls.markComplete', 'Mark Complete')}
                      </button>
                    )}
                    {isDone && (
                      <span
                        className="text-xs font-sans text-teal"
                        aria-label={t('ariaLabel.lessonComplete', '{{lesson}} completed', { lesson: lesson.title })}
                      >
                        {t('lessonControls.completed', 'Completed')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-4" data-testid="tab-progress">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                  {t('trackHeader.lessonCompletion', 'Lesson Completion')}
                </span>
                <span className="text-xs font-mono text-ink">
                  {completedCount}/{lessons.length} {t('tabs.progress', 'Progress')}
                </span>
              </div>
              <div className="w-full h-2 bg-recessed rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal transition-all duration-base"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {progress && (
              <div>
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                  {t('trackHeader.moduleStatus', 'Module Status')}
                </span>
                <p className="text-sm text-ink font-sans mt-1 capitalize">{progress.status}</p>
              </div>
            )}

            {progress?.trustScoreBoost !== undefined && (
              <div>
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                  {t('trackHeader.trustScoreBoost', 'Trust Score Boost')}
                </span>
                <p className="text-sm text-ink font-sans mt-1">+{progress.trustScoreBoost}</p>
              </div>
            )}

            {!progress && (
              <p className="text-xs text-subtle font-sans">
                {t('noProgress', 'No progress recorded yet for this module.')}
              </p>
            )}

            {allLessonsCompleted && status !== 'completed' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCompleteModule}
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold font-sans text-white bg-gold hover:bg-gold/90 focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1 transition-colors"
                  data-testid="complete-module"
                  aria-label={t('ariaLabel.completeModule', 'Complete module')}
                >
                  {t('lessonControls.completeModule', 'Complete Module')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
