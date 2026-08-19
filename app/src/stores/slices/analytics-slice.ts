import { api } from '../../api/client';
import type {
  CampaignLiftRow,
  CacChannelRow,
  ChurnRisk,
  Cohort,
  Forecast,
  FunnelStage,
  HazardHeatmapRow,
  KFactorMetric,
  KitFunnelStage,
  LtvSnapshot,
  Problem,
  ViralReferral,
  WtrPoint,
} from '../../types/api';

export interface AnalyticsState {
  cohorts: Cohort[];
  ltvSnapshots: LtvSnapshot[];
  churnRisks: ChurnRisk[];
  funnelStages: FunnelStage[];
  viralReferrals: ViralReferral[];
  forecast: Forecast[];
  wtrPoints: WtrPoint[];
  kitFunnelStages: KitFunnelStage[];
  cacByChannel: CacChannelRow[];
  hazardHeatmap: HazardHeatmapRow[];
  kFactor: KFactorMetric | null;
  campaignLift: CampaignLiftRow[];
  loading: boolean;
  error: Problem | null;
}

export interface AnalyticsActions {
  loadCohorts: () => Promise<void>;
  loadLtv: () => Promise<void>;
  loadChurn: () => Promise<void>;
  loadFunnel: () => Promise<void>;
  loadViral: () => Promise<void>;
  loadForecast: () => Promise<void>;
  loadAll: () => Promise<void>;
  loadWtr: () => Promise<void>;
  loadKitFunnel: () => Promise<void>;
  loadCacByChannel: () => Promise<void>;
  loadHazardHeatmap: () => Promise<void>;
  loadKFactor: () => Promise<void>;
  loadCampaignLift: () => Promise<void>;
  loadGrowthAll: () => Promise<void>;
}

export type AnalyticsSlice = AnalyticsState & AnalyticsActions;

export const initialAnalyticsState: AnalyticsState = {
  cohorts: [],
  ltvSnapshots: [],
  churnRisks: [],
  funnelStages: [],
  viralReferrals: [],
  forecast: [],
  wtrPoints: [],
  kitFunnelStages: [],
  cacByChannel: [],
  hazardHeatmap: [],
  kFactor: null,
  campaignLift: [],
  loading: false,
  error: null,
};

export const createAnalyticsSlice = (set: any) => ({
  ...initialAnalyticsState,
  loadCohorts: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadCohorts/start');
    const res = await api.analytics.cohorts();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadCohorts/error');
    } else {
      set((s: any) => { s.analytics.cohorts = res.data.cohorts; s.analytics.loading = false; }, false, 'analytics/loadCohorts/done');
    }
  },
  loadLtv: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadLtv/start');
    const res = await api.analytics.ltv();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadLtv/error');
    } else {
      set((s: any) => { s.analytics.ltvSnapshots = res.data.snapshots; s.analytics.loading = false; }, false, 'analytics/loadLtv/done');
    }
  },
  loadChurn: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadChurn/start');
    const res = await api.analytics.churn();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadChurn/error');
    } else {
      set((s: any) => { s.analytics.churnRisks = res.data.risks; s.analytics.loading = false; }, false, 'analytics/loadChurn/done');
    }
  },
  loadFunnel: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadFunnel/start');
    const res = await api.analytics.funnel();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadFunnel/error');
    } else {
      set((s: any) => { s.analytics.funnelStages = res.data.stages; s.analytics.loading = false; }, false, 'analytics/loadFunnel/done');
    }
  },
  loadViral: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadViral/start');
    const res = await api.analytics.viral();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadViral/error');
    } else {
      set((s: any) => { s.analytics.viralReferrals = res.data.referrals; s.analytics.loading = false; }, false, 'analytics/loadViral/done');
    }
  },
  loadForecast: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadForecast/start');
    const res = await api.analytics.forecast();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadForecast/error');
    } else {
      set((s: any) => { s.analytics.forecast = res.data.forecast; s.analytics.loading = false; }, false, 'analytics/loadForecast/done');
    }
  },
  loadAll: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadAll/start');
    const [cohorts, ltv, churn, funnel, viral, forecast] = await Promise.all([
      api.analytics.cohorts(),
      api.analytics.ltv(),
      api.analytics.churn(),
      api.analytics.funnel(),
      api.analytics.viral(),
      api.analytics.forecast(),
    ]);
    set((s: any) => {
      if ('problem' in cohorts) s.analytics.error = cohorts.problem;
      else s.analytics.cohorts = cohorts.data.cohorts;
      if ('problem' in ltv) s.analytics.error = ltv.problem;
      else s.analytics.ltvSnapshots = ltv.data.snapshots;
      if ('problem' in churn) s.analytics.error = churn.problem;
      else s.analytics.churnRisks = churn.data.risks;
      if ('problem' in funnel) s.analytics.error = funnel.problem;
      else s.analytics.funnelStages = funnel.data.stages;
      if ('problem' in viral) s.analytics.error = viral.problem;
      else s.analytics.viralReferrals = viral.data.referrals;
      if ('problem' in forecast) s.analytics.error = forecast.problem;
      else s.analytics.forecast = forecast.data.forecast;
      s.analytics.loading = false;
    }, false, 'analytics/loadAll/done');
  },
  loadWtr: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadWtr/start');
    const res = await api.analytics.wtr();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadWtr/error');
    } else {
      set((s: any) => { s.analytics.wtrPoints = res.data.points; s.analytics.loading = false; }, false, 'analytics/loadWtr/done');
    }
  },
  loadKitFunnel: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadKitFunnel/start');
    const res = await api.analytics.kitFunnel();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadKitFunnel/error');
    } else {
      set((s: any) => { s.analytics.kitFunnelStages = res.data.stages; s.analytics.loading = false; }, false, 'analytics/loadKitFunnel/done');
    }
  },
  loadCacByChannel: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadCacByChannel/start');
    const res = await api.analytics.cacByChannel();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadCacByChannel/error');
    } else {
      set((s: any) => { s.analytics.cacByChannel = res.data.channels; s.analytics.loading = false; }, false, 'analytics/loadCacByChannel/done');
    }
  },
  loadHazardHeatmap: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadHazardHeatmap/start');
    const res = await api.analytics.hazardHeatmap();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadHazardHeatmap/error');
    } else {
      set((s: any) => { s.analytics.hazardHeatmap = res.data.rows; s.analytics.loading = false; }, false, 'analytics/loadHazardHeatmap/done');
    }
  },
  loadKFactor: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadKFactor/start');
    const res = await api.analytics.kFactor();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadKFactor/error');
    } else {
      set((s: any) => { s.analytics.kFactor = res.data.metric; s.analytics.loading = false; }, false, 'analytics/loadKFactor/done');
    }
  },
  loadCampaignLift: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadCampaignLift/start');
    const res = await api.analytics.campaignLift();
    if ('problem' in res) {
      set((s: any) => { s.analytics.error = res.problem; s.analytics.loading = false; }, false, 'analytics/loadCampaignLift/error');
    } else {
      set((s: any) => { s.analytics.campaignLift = res.data.campaigns; s.analytics.loading = false; }, false, 'analytics/loadCampaignLift/done');
    }
  },
  loadGrowthAll: async () => {
    set((s: any) => { s.analytics.loading = true; s.analytics.error = null; }, false, 'analytics/loadGrowthAll/start');
    const [wtr, kitFunnel, cacByChannel, hazardHeatmap, kFactor, campaignLift] = await Promise.all([
      api.analytics.wtr(),
      api.analytics.kitFunnel(),
      api.analytics.cacByChannel(),
      api.analytics.hazardHeatmap(),
      api.analytics.kFactor(),
      api.analytics.campaignLift(),
    ]);
    set((s: any) => {
      if ('problem' in wtr) s.analytics.error = wtr.problem;
      else s.analytics.wtrPoints = wtr.data.points;
      if ('problem' in kitFunnel) s.analytics.error = kitFunnel.problem;
      else s.analytics.kitFunnelStages = kitFunnel.data.stages;
      if ('problem' in cacByChannel) s.analytics.error = cacByChannel.problem;
      else s.analytics.cacByChannel = cacByChannel.data.channels;
      if ('problem' in hazardHeatmap) s.analytics.error = hazardHeatmap.problem;
      else s.analytics.hazardHeatmap = hazardHeatmap.data.rows;
      if ('problem' in kFactor) s.analytics.error = kFactor.problem;
      else s.analytics.kFactor = kFactor.data.metric;
      if ('problem' in campaignLift) s.analytics.error = campaignLift.problem;
      else s.analytics.campaignLift = campaignLift.data.campaigns;
      s.analytics.loading = false;
    }, false, 'analytics/loadGrowthAll/done');
  },
});
