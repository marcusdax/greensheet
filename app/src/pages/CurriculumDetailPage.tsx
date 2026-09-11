import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUi, useCurriculum } from '../stores/root-store';
import { CoursePlayer } from '../components/CoursePlayer';
import { SEED_CATALOG } from '../data/curriculum';
import type { CurriculumModuleData } from '../stores/slices/curriculum-slice';
import type { CurriculumTrack, ModuleStatus } from '../types/ledger';
import {
  ArrowLeft, BookOpen, CheckCircle, Clock, Lock,
} from 'lucide-react';

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
 * CurriculumDetailPage
 *
 * Renders the detail view for a single curriculum module at
 * /:locale/curriculum/:track/:moduleId.
 *
 * Uses the root curriculum store (catalog + user progress) rather than a
 * local mock. The catalog is seeded into the root store on mount if not
 * already present, and progress is read from the store's userProgress.
 */
export const CurriculumDetailPage: React.FC = () => {
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
  }, [curriculum, curriculum.catalog]);

  const catalog = curriculum.catalog;

  // Seed the root store catalog once if it hasn't been set yet.
  useEffect(() => {
    if (!catalog) {
      curriculum.setCatalog(SEED_CATALOG);
    }
  }, [catalog, curriculum]);

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

  const progress = moduleId ? curriculum.getModuleProgress(moduleId) : undefined;
  const status: ModuleStatus = progress?.status ?? 'available';
  const StatusIcon = statusIcons[status];

  const completedLessonCount = moduleId ? curriculum.getCompletedLessonCount(moduleId) : 0;
  const totalLessons = moduleData?.lessons.length ?? 0;
  const progressPct = totalLessons > 0 ? Math.round((completedLessonCount / totalLessons) * 100) : 0;

  // Only redirect when the catalog has been seeded but the module is genuinely
  // not found, or when the track is invalid. While the catalog is still loading
  // (null), we stay in the loading state.
  useEffect(() => {
    if (catalog && (!trackIsValid || !moduleData)) {
      if (!trackIsValid) {
        pushToast({ kind: 'error', message: t('curriculum.noTrack', 'Invalid curriculum track') });
      } else {
        pushToast({ kind: 'error', message: t('curriculum.moduleNotFound', 'Module not found') });
      }
      void navigate(`/${locale || 'en-US'}/curriculum`, { replace: true });
    }
  }, [catalog, trackIsValid, moduleData, locale, navigate, pushToast, t]);

  const handleBack = () => {
    void navigate(`/${locale || 'en-US'}/curriculum`);
  };

  const handleCompleteModule = () => {
    const mod = moduleData;
    const curStatus = status;
    if (!mod || curStatus === 'locked') return;
    if (curStatus === 'completed') {
      pushToast({ kind: 'info', message: t('curriculum.alreadyCompleted', 'Module already completed') });
      return;
    }
    curriculum.completeModule(mod.id);
    pushToast({ kind: 'success', message: t('curriculum.moduleCompleted', 'Module completed') });
  };

  const handleMarkLesson = (lessonId: string) => {
    if (!moduleData || status === 'locked') return;
    curriculum.markLessonComplete(moduleData.id, lessonId);
  };

  if (!trackIsValid || !moduleData) {
    // Invalid route — redirect will be triggered by the effect above once the
    // catalog is loaded. While the catalog is loading, show a loading state.
    return (
      <div className="p-6 text-muted font-sans">
        {t('common:states.loading', 'Loading…')}
      </div>
    );
  }

  const levelColor = (() => {
    if (moduleData.level === 'beginner') return 'bg-recessed text-muted';
    if (moduleData.level === 'intermediate') return 'bg-gold/10 text-gold';
    return 'bg-navy/10 text-navy';
  })();

  return (
    <div className="space-y-6" data-testid="curriculum-detail-page">
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
          <h1 className="text-2xl font-display font-medium text-ink">{moduleData.title}</h1>
        </div>
      </div>

      {/* Status + level badge row */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="module-status-row">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-sans font-bold uppercase ${levelColor}`}>
          {moduleData.level}
        </span>
        <span
          className="inline-flex items-center gap-1 text-xs font-sans"
          data-testid="module-status"
        >
          <StatusIcon size={12} />
          <span className="capitalize">{status}</span>
        </span>

        {moduleData.prerequisites.length > 0 && (
          <span className="text-xs text-muted font-sans">
            {t('curriculum.trackHeader.prerequisites', 'Prerequisites')}: {moduleData.prerequisites.join(', ')}
          </span>
        )}
      </div>

      {/* Region + progress summary */}
      <div className="flex items-center gap-6 text-sm font-sans" data-testid="module-meta">
        <span className="text-muted">
          {t('curriculum.trackHeader.region', 'Region')}:{' '}
          <span className="text-ink font-medium">{moduleData.regionCode}</span>
        </span>
        <span className="text-muted">
          {completedLessonCount}/{totalLessons} {t('curriculum.moduleCount_one', '{{count}} lesson').replace('{{count}}', String(totalLessons))}
        </span>
        <span className="text-muted">
          {progressPct}% {t('curriculum.progress.inProgress', 'In progress')}
        </span>
      </div>

      {/* Module description */}
      <p className="text-sm text-muted font-sans leading-relaxed max-w-2xl" data-testid="module-description">
        {moduleData.description}
      </p>

      {/* Progress bar */}
      <div className="w-full md:w-1/2 h-2 bg-recessed rounded-full overflow-hidden" data-testid="progress-bar">
        <div
          className="h-full bg-teal transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3" data-testid="module-actions">
        <button
          onClick={handleCompleteModule}
          disabled={status === 'locked' || status === 'completed'}
          className={`px-4 py-2 rounded-md text-sm font-semibold font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            status === 'completed'
              ? 'bg-recessed text-muted cursor-not-allowed'
              : status === 'locked'
                ? 'bg-recessed text-muted cursor-not-allowed'
                : 'bg-navy hover:bg-navy-800 text-white'
          }`}
          data-testid="complete-module-button"
        >
          {status === 'completed'
            ? t('curriculum.reviewModule', 'Review Module')
            : t('curriculum.completeModule', 'Mark Complete')}
        </button>

        <button
          onClick={() => {
            if (moduleData) {
              moduleData.lessons.forEach((lessonId) => handleMarkLesson(lessonId));
              pushToast({ kind: 'success', message: t('curriculum.lessonsMarked', 'All lessons marked complete') });
            }
          }}
          disabled={status === 'locked' || completedLessonCount === totalLessons}
          className="px-4 py-2 rounded-md text-sm font-semibold font-sans text-ink bg-surface border border-border hover:bg-recessed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="mark-all-lessons-button"
        >
          {t('curriculum.markAllLessons', 'Mark All Lessons')}
        </button>
      </div>

      {/* Trust score boost (if any) */}
      {progress?.trustScoreBoost !== undefined && (
        <div className="text-xs text-muted font-sans" data-testid="trust-score">
          {t('curriculum.trackHeader.trustScoreBoost', 'Trust Score Boost')}: +{progress.trustScoreBoost}
        </div>
      )}

      {/* CoursePlayer renders lesson content + tabs */}
      <div data-testid="course-player-container">
        <CoursePlayer moduleId={moduleData.id} onTabChange={() => {}} />
      </div>
    </div>
  );
};
