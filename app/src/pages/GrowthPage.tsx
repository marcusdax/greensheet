import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAnalytics } from '../stores/root-store';
import { useGrowthMetrics } from '../stores/selectors/analytics-selectors';
import {
  WtrChart,
  KitFunnelChart,
  CacByChannelChart,
  HazardHeatmap,
  KFactorGauge,
  CampaignLiftChart,
} from '../components/growth';

export const GrowthPage: React.FC = () => {
  const { t } = useTranslation(['growth', 'common', 'errors']);
  const { loadGrowthAll } = useAnalytics();
  const {
    wtrPoints,
    kitFunnel,
    cacByChannel,
    cacCeiling,
    hazardHeatmap,
    kFactor,
    campaignLift,
    loading,
    error,
  } = useGrowthMetrics();

  useEffect(() => {
    void loadGrowthAll();
  }, [loadGrowthAll]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('growth:overline')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('growth:title')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            {t('growth:subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadGrowthAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common:actions.refresh', 'Refresh')}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 p-4 rounded-md border border-cherry/30 bg-cherry/10 text-cherry"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-sm">{t('errors:title')}</p>
              <p className="text-sm">{t('errors:generic')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadGrowthAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-cherry hover:bg-cherry/90 disabled:opacity-50 text-white rounded-md text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-cherry"
          >
            {t('common:buttons.retry', 'Retry')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WtrChart
          data={wtrPoints}
          title={t('growth:wtr.title')}
          description={t('growth:wtr.description')}
        />
        <KitFunnelChart
          data={kitFunnel}
          title={t('growth:kitFunnel.title')}
          description={t('growth:kitFunnel.description')}
        />
        <CacByChannelChart
          data={cacByChannel}
          ceiling={cacCeiling}
          title={t('growth:cacByChannel.title')}
          description={t('growth:cacByChannel.description')}
        />
        <HazardHeatmap
          data={hazardHeatmap}
          title={t('growth:hazardHeatmap.title')}
          description={t('growth:hazardHeatmap.description')}
        />
        <KFactorGauge
          data={kFactor}
          title={t('growth:kFactor.title')}
          description={t('growth:kFactor.description')}
        />
        <CampaignLiftChart
          data={campaignLift}
          title={t('growth:campaignLift.title')}
          description={t('growth:campaignLift.description')}
        />
      </div>
    </div>
  );
};
