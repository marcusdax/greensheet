import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUi, useCurriculum } from '../stores/root-store';
import { SEED_CATALOG, SEED_LESSONS } from '../data/curriculum';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  Clock,
  Lock,
} from 'lucide-react';
import type { CurriculumModuleData } from '../stores/slices/curriculum-slice';
import type { CurriculumTrack, CurriculumLesson, ModuleStatus } from '../types/ledger';

const statusIcons: Record<ModuleStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  available: Clock,
  locked: Lock,
  in_progress: BookOpen,
  completed: CheckCircle,
};

const validTracks: Record<string, CurriculumTrack> = {
  quality: 'quality',
  compliance: 'compliance',
  finance: 'finance',
  logistics: 'logistics',
};

/**
 * CurriculumModuleDetail
 *
 * Dedicated detail page for a single curriculum module at
 * /:locale/curriculum/:track/:moduleId.
 *
 * Renders module title, description, lessons with mark-complete controls,
 * progress summary, and trust-score boost — all driven by the root
 * curriculum store.
 */
export const CurriculumModuleDetail: React.FC = () => {
  const { t } = useTranslation(['curriculum', 'common']);
  const navigate = useNavigate();
  const { locale, track, moduleId } = useParams<{ locale: string; track: string; moduleId: string }>();
  const { pushToast } = useUi();
  const curriculum = useCurriculum();

  // Seed the root store catalog once if it hasn't been set yet.
  useEffect(() => {
    if (!curriculum.catalog) {
      curriculum.setCatalog(SEED_CATALOG);
    }
  }, [curriculum]);

  const catalog = curriculum.catalog;

  // Validate track + module against the root store catalog
  const trackIsValid = track !== undefined && track in validTracks;
  const trackKey: string = track ?? '';

  const moduleData: CurriculumModuleData | undefined = useMemo(() => {
    if (!trackIsValid || !catalog) return undefined;
    const mod = moduleId ? catalog.modules[moduleId] : undefined;
    // Ensure the module belongs to the requested track
    if (mod && mod.track === validTracks[trackKey]) return mod;
    return undefined;
  }, [trackIsValid, catalog, moduleId, trackKey]);

  // Resolve full lesson objects from the seed lesson map.
  const lessons: CurriculumLesson[] = useMemo(() => {
    if (!moduleData) return [];
    return moduleData.lessons
      .map((lessonId) => SEED_LESSONS[lessonId])
      .filter((l): l is CurriculumLesson => Boolean(l));
  }, [moduleData]);

  const progress = moduleId ? curriculum.getModuleProgress(moduleId) : undefined;
  const status: ModuleStatus = progress?.status ?? 'available';
  const StatusIcon = statusIcons[status];

  const completedLessonCount = moduleId ? curriculum.getCompletedLessonCount(moduleId) : 0;
  const totalLessons = moduleData?.lessons.length ?? 0;
  const progressPct = totalLessons > 0 ? Math.round((completedLessonCount / totalLessons) * 100) : 0;

  const handleBack = () => {
    void navigate(`/${locale || 'en-US'}/curriculum`);
  };

  const handleMarkLesson = (lessonId: string) => {
    if (!moduleData || status === 'locked') return;
    curriculum.markLessonComplete(moduleData.id, lessonId);
  };

  const handleCompleteModule = () => {
    if (!moduleData || status === 'locked') return;
    if (status === 'completed') {
      // "Review" — re-engages a completed module. The store's completeModule is
      // idempotent and re-grants the trust-score boost on each invocation.
      curriculum.completeModule(moduleData.id);
      pushToast({ kind: 'success', message: t('curriculum.moduleCompleted', 'Module completed') });
      return;
    }
    curriculum.completeModule(moduleData.id);
    pushToast({ kind: 'success', message: t('curriculum.moduleCompleted', 'Module completed') });
  };

  // While the catalog is loading or the module/track can't be resolved,
  // show a friendly "Module not found" message.
  if (!catalog || !trackIsValid || !moduleData) {
    return (
      <div
        className="p-6 space-y-4"
        data-testid="module-detail"
      >
        <button
          onClick={handleBack}
          className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-teal"
          aria-label={t('common:buttons.back', 'Back')}
        >
          <ArrowLeft size={16} />
        </button>
        <p className="text-sm text-muted font-sans">
          {t('curriculum.moduleNotFound', 'Module not found')}
        </p>
      </div>
    );
  }

  const levelColor = (() => {
    if (moduleData.level === 'beginner') return 'bg-recessed text-muted';
    if (moduleData.level === 'intermediate') return 'bg-gold/10 text-gold';
    return 'bg-navy/10 text-navy';
  })();

  return (
    <div
      className="space-y-6"
      data-testid="module-detail"
    >
      {/* Back link + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-1 focus-visible:ring-teal"
          aria-label={t('common:buttons.back', 'Back')}
          data-testid="back-button"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-teal" />
          <h1
            className="text-2xl font-display font-medium text-ink"
            data-testid="module-title"
          >
            {moduleData.title}
          </h1>
        </div>
      </div>

      {/* Status + level + region */}
      <div
        className="flex items-center gap-3 flex-wrap"
        data-testid="module-status-row"
      >
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-sans font-bold uppercase ${levelColor}`}
        >
          {moduleData.level}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs font-sans"
          data-testid="module-status"
        >
          <StatusIcon size={12} />
          <span className="capitalize">{status}</span>
        </span>
        <span className="text-xs text-muted font-sans">
          {t('curriculum.trackHeader.region', 'Region')}: {moduleData.regionCode}
        </span>
      </div>

      {/* Module description */}
      <p
        className="text-sm text-muted font-sans leading-relaxed"
        data-testid="module-description"
      >
        {moduleData.description}
      </p>

      {/* Progress summary */}
      <div
        className="flex items-center gap-6 text-sm font-sans"
        data-testid="progress-summary"
      >
        <span className="text-muted">
          {completedLessonCount}/{totalLessons} {t('curriculum.moduleCount_one', '{{count}} lesson').replace('{{count}}', String(totalLessons))}
        </span>
        <span className="text-muted">{progressPct}%</span>
        <span className="text-muted">
          {progressPct}% {t('curriculum.progress.inProgress', 'In progress')}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full md:w-1/2 h-2 bg-recessed rounded-full overflow-hidden"
        data-testid="progress-bar"
      >
        <div
          className="h-full bg-teal transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Trust Score Boost */}
      {progress?.trustScoreBoost !== undefined && (
        <div
          className="text-xs text-muted font-sans"
          data-testid="trust-score"
        >
          {t('curriculum.trackHeader.trustScoreBoost', 'Trust Score Boost')}: +{progress.trustScoreBoost}
        </div>
      )}

      {/* Action buttons */}
      <div
        className="flex items-center gap-3"
        data-testid="module-actions"
      >
        <button
          onClick={handleCompleteModule}
          disabled={status === 'locked'}
          className={`px-4 py-2 rounded-md text-sm font-semibold font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            status === 'completed'
              ? 'bg-recessed text-muted cursor-not-allowed'
              : 'bg-navy hover:bg-navy-800 text-white'
          }`}
          data-testid="complete-module-button"
        >
          {status === 'completed'
            ? t('curriculum.reviewModule', 'Review Module')
            : t('curriculum.completeModule', 'Mark Complete')}
        </button>
      </div>

      {/* Lessons */}
      <div
        className="space-y-3"
        data-testid="module-lessons"
      >
        <h2 className="text-lg font-display font-semibold text-ink">
          {t('curriculum.tabs.lessons', 'Lessons')}
        </h2>
        {lessons.map((lesson) => {
          const isDone = progress?.lessonsCompleted.includes(lesson.id) ?? false;
          return (
            <div
              key={lesson.id}
              className="border border-border rounded-md p-4"
              data-testid={`lesson-${lesson.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-sans font-semibold text-ink">{lesson.title}</h3>
                <span className="text-xs font-mono text-subtle">~{lesson.estimatedMinutes} min</span>
              </div>
              <p className="text-xs text-muted font-sans mt-1 line-clamp-2">
                {lesson.content}
              </p>
              <div className="mt-2">
                {!isDone && (
                  <button
                    onClick={() => handleMarkLesson(lesson.id)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold font-sans text-white bg-teal hover:bg-teal/90 focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1 transition-colors"
                    data-testid={`mark-complete-${lesson.id}`}
                  >
                    {t('curriculum.lessonControls.markComplete', 'Mark Complete')}
                  </button>
                )}
                {isDone && (
                  <span
                    className="text-xs font-sans text-teal"
                    data-testid={`lesson-completed-${lesson.id}`}
                  >
                    {t('curriculum.lessonControls.completed', 'Completed')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
