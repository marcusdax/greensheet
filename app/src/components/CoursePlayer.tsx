import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModuleData } from '../hooks/useModuleData';

export type CourseTab = 'overview' | 'lessons' | 'progress';

export interface CoursePlayerProps {
  moduleId: string;
  onTabChange?: (tab: CourseTab) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({ moduleId, onTabChange }) => {
  const { t } = useTranslation('curriculum');
  const [activeTab, setActiveTab] = useState<CourseTab>('overview');

  const { module, lessons, milestone, progress } = useModuleData(moduleId);

  const handleTabChange = (tab: CourseTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const totalMinutes = lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0);
  const completedLessons = progress?.lessonsCompleted ?? [];
  const completedCount = lessons.filter((l) => completedLessons.includes(l.id)).length;
  const progressPct = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const tabs: { id: CourseTab; label: string; count?: number }[] = [
    { id: 'overview', label: t('tabs.overview', 'Overview') },
    { id: 'lessons', label: t('tabs.lessons', 'Lessons') },
    { id: 'progress', label: t('tabs.progress', 'Progress') },
  ];

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
        aria-label="Course tabs"
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
            {module.prerequisites.length > 0 && (
              <div>
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
                  {t('trackHeader.prerequisites', 'Prerequisites')}
                </span>
                <ul className="text-sm text-ink font-sans mt-1 list-disc list-inside">
                  {module.prerequisites.map((prereq) => (
                    <li key={prereq}>{prereq}</li>
                  ))}
                </ul>
              </div>
            )}
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
            {lessons.map((lesson) => {
              const isDone = completedLessons.includes(lesson.id);
              return (
                <div
                  key={lesson.id}
                  className="border border-border rounded-md p-4 hover:border-teal/40 transition-colors"
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
          </div>
        )}
      </div>
    </section>
  );
};
