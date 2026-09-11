import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUi, useCurriculum } from '../stores/root-store';
import { SEED_CATALOG } from '../data/curriculum';
import { BookOpen, ClipboardList, BarChart3, Shield, Wallet, Package, CheckCircle, Clock, Lock } from 'lucide-react';
import type { CurriculumTrack, ModuleStatus } from '../types/ledger';
import type { CurriculumModuleData } from '../stores/slices/curriculum-slice';

interface TrackDefinition {
  key: CurriculumTrack;
  labelKey: string;
  fallbackLabel: string;
  descKey: string;
  fallbackDesc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  colorClasses: string;
}

const tracks: TrackDefinition[] = [
  {
    key: 'quality',
    labelKey: 'curriculum.tracks.quality',
    fallbackLabel: 'Quality',
    descKey: 'curriculum.trackDesc.quality',
    fallbackDesc: 'Sensory calibration, cupping protocols, and Q-grader skills.',
    icon: ClipboardList,
    colorClasses: 'text-gold bg-gold/10',
  },
  {
    key: 'compliance',
    labelKey: 'curriculum.tracks.compliance',
    fallbackLabel: 'Compliance',
    descKey: 'curriculum.trackDesc.compliance',
    fallbackDesc: 'EUDR traceability, customs clearance, and phytosanitary requirements.',
    icon: Shield,
    colorClasses: 'text-navy bg-navy/10',
  },
  {
    key: 'finance',
    labelKey: 'curriculum.tracks.finance',
    fallbackLabel: 'Finance',
    descKey: 'curriculum.trackDesc.finance',
    fallbackDesc: 'Farm budgets, True Price Floor, and futures market literacy.',
    icon: Wallet,
    colorClasses: 'text-teal bg-teal/10',
  },
  {
    key: 'logistics',
    labelKey: 'curriculum.tracks.logistics',
    fallbackLabel: 'Logistics',
    descKey: 'curriculum.trackDesc.logistics',
    fallbackDesc: 'Post-harvest handling, storage, and shipping logistics.',
    icon: Package,
    colorClasses: 'text-cherry bg-cherry/10',
  },
];

const statusIcons: Record<ModuleStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  available: Clock,
  locked: Lock,
  in_progress: BookOpen,
  completed: CheckCircle,
};

export const CurriculumPage: React.FC = () => {
  const { t } = useTranslation(['curriculum', 'common']);
  const navigate = useNavigate();
  const { locale } = useParams<{ locale: string }>();
  const { pushToast } = useUi();
  const curriculum = useCurriculum();

  // Seed the root store catalog on mount if it hasn't been set yet.
  useEffect(() => {
    if (!curriculum.catalog) {
      curriculum.setCatalog(SEED_CATALOG);
    }
  }, [curriculum]);

  const catalog = curriculum.catalog;

  const modulesByTrack = useMemo<Record<CurriculumTrack, CurriculumModuleData[]>>(() => {
    const result: Record<CurriculumTrack, CurriculumModuleData[]> = {
      quality: [],
      compliance: [],
      finance: [],
      logistics: [],
    };
    if (!catalog) return result;
    for (const module of Object.values(catalog.modules)) {
      result[module.track].push(module);
    }
    return result;
  }, [catalog]);

  const getModuleStatus = (moduleId: string): ModuleStatus => {
    return curriculum.getModuleStatus(moduleId);
  };

  const getProgressPct = (module: CurriculumModuleData): number => {
    const completed = curriculum.getCompletedLessonCount(module.id);
    if (!module.lessons.length) return 0;
    return Math.round((completed / module.lessons.length) * 100);
  };

  const getStatusText = (status: ModuleStatus) => {
    const labels: Record<ModuleStatus, string> = {
      available: t('curriculum.progress.notStarted', 'Not started'),
      in_progress: t('curriculum.progress.inProgress', 'In progress'),
      completed: t('curriculum.progress.completed', 'Completed'),
      locked: t('curriculum.progress.locked', 'Locked'),
    };
    return t(`curriculum.progress.${status}`, labels[status]);
  };

  const handleTrackClick = (track: CurriculumTrack) => {
    const trackModules = modulesByTrack[track];
    if (trackModules.length === 0) {
      pushToast({ kind: 'info', message: t('curriculum.noTrack', 'No modules found for this track') });
      return;
    }
    const firstModule = trackModules[0];
    void navigate(`/${locale || 'en-US'}/curriculum/${track}/${firstModule.id}`);
  };

  const handleModuleClick = (track: CurriculumTrack, moduleId: string) => {
    void navigate(`/${locale || 'en-US'}/curriculum/${track}/${moduleId}`);
  };

  if (!catalog) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('curriculum.overline', 'CURRICULUM LEDGER')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('curriculum.title', 'Curriculum')}
          </h1>
        </div>
        <div className="p-6 text-muted font-sans">{t('common:states.loading', 'Loading…')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">
          {t('curriculum.overline', 'CURRICULUM LEDGER')}
        </span>
        <h1 className="text-3xl font-display font-medium text-ink">
          {t('curriculum.title', 'Curriculum')}
        </h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          {t('curriculum.subtitle', 'Master coffee quality, compliance, finance, and logistics through region-specific learning tracks.')}
        </p>
      </div>

      {/* Track Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tracks.map((track) => {
          const trackModules = modulesByTrack[track.key];
          const totalLessons = trackModules.reduce((sum, mod) => sum + mod.lessons.length, 0);
          const completedModules = trackModules.filter((mod) => getModuleStatus(mod.id) === 'completed');

          const Icon = track.icon;
          const StatusIcon = trackModules.length > 0 && completedModules.length > 0
            ? statusIcons.completed
            : statusIcons[getModuleStatus(trackModules[0]?.id ?? '')];

          return (
            <div
              key={track.key}
              data-testid={`track-card-${track.key}`}
              className="bg-surface border border-border-strong rounded-lg p-5 shadow-e1 hover:shadow-e2 transition-shadow cursor-pointer"
              onClick={() => handleTrackClick(track.key)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-md ${track.colorClasses}`}>
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-display font-semibold text-ink">
                  {t(track.labelKey, track.fallbackLabel)}
                </h3>
              </div>

              <p className="text-xs text-muted font-sans leading-relaxed mb-4">
                {t(track.descKey, track.fallbackDesc)}
              </p>

              <div className="flex items-center justify-between text-xs font-sans mb-3">
                <span className="text-muted">
                  {t('curriculum.moduleCount_other', '{{count}} modules')
                    .replace('{{count}}', String(trackModules.length))}
                </span>
                <span className="text-muted">
                  {completedModules.length} of {completedModules.length + trackModules.filter((mod) => getModuleStatus(mod.id) !== 'completed').length} {t('curriculum.moduleCount_one', '{{count}} module').replace('{{count}}', String(trackModules.length))}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs font-sans text-muted mb-3">
                <StatusIcon size={12} className="text-muted" />
                <span>{trackModules.length > 0 ? getStatusText(getModuleStatus(trackModules[0].id)) : t('curriculum.progress.locked', 'Locked')}</span>
                <span>•</span>
                <span>{totalLessons} {t('curriculum.moduleCount_one', '{{count}} lesson').replace('{{count}}', String(totalLessons))}</span>
              </div>

              <a
                href={`/${locale || 'en-US'}/curriculum/${track.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  void handleTrackClick(track.key);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal/80 font-sans"
                data-testid={`track-link-${track.key}`}
              >
                {t('curriculum.viewTrack', 'View Track')}
                <BarChart3 size={12} />
              </a>
            </div>
          );
        })}
      </div>

      {/* Module List by Track */}
      <div className="space-y-8" data-testid="module-list">
        {tracks.map((track) => {
          const trackModules = modulesByTrack[track.key];
          if (trackModules.length === 0) return null;

          const Icon = track.icon;
          return (
            <div key={track.key} data-testid={`modules-${track.key}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-1.5 rounded-md ${track.colorClasses}`}>
                  <Icon size={16} />
                </div>
                <h2 className="text-xl font-display font-medium text-ink">
                  {t(track.labelKey, track.fallbackLabel)}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackModules.map((mod) => {
                  const status = getModuleStatus(mod.id);
                  const pct = getProgressPct(mod);
                  const ModuleStatusIcon = statusIcons[status];
                  let statusColor = 'text-subtle';
                  if (status === 'completed') statusColor = 'text-leaf';
                  else if (status === 'in_progress') statusColor = 'text-teal';
                  else if (status === 'locked') statusColor = 'text-danger';

                  let levelColor = 'bg-recessed text-muted';
                  if (mod.level === 'beginner') levelColor = 'bg-recessed text-muted';
                  else if (mod.level === 'intermediate') levelColor = 'bg-gold/10 text-gold';
                  else if (mod.level === 'advanced') levelColor = 'bg-navy/10 text-navy';

                  return (
                    <div
                      key={mod.id}
                      data-testid={`module-card-${mod.id}`}
                      className="bg-surface border border-border rounded-lg p-4 shadow-e1 hover:shadow-e2 transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-semibold text-ink leading-tight">{mod.title}</h3>
                        <span className={`px-1.5 py-0.5 text-[9px] rounded-full font-sans font-bold uppercase ${levelColor}`}>
                          {mod.level}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted font-sans leading-relaxed mb-3 line-clamp-2">
                        {mod.description}
                      </p>

                      <div className="flex items-center gap-2 text-xs font-sans mb-2">
                        <ModuleStatusIcon size={12} className={statusColor} />
                        <span className={statusColor}>{getStatusText(status)}</span>
                        <span className="text-subtle">•</span>
                        <span className="text-subtle">{mod.lessons.length} lessons</span>
                      </div>

                      {status !== 'locked' && (
                        <div className="w-full h-1 bg-recessed rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-teal rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => handleModuleClick(track.key, mod.id)}
                        className={`w-full mt-2 px-3 py-1.5 rounded-md text-xs font-semibold font-sans transition-colors ${
                          status === 'locked'
                            ? 'bg-recessed text-muted cursor-not-allowed'
                            : 'bg-navy hover:bg-navy-800 text-white'
                        }`}
                        disabled={status === 'locked'}
                        data-testid={`module-link-${mod.id}`}
                      >
                        {pct > 0 && status !== 'completed'
                          ? `Continue (${pct}%)`
                          : status === 'completed'
                            ? 'Review'
                            : 'Start'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
