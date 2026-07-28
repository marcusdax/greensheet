import { api } from '../../api/client';
import type { Problem } from '../../types/api';

export interface AnalyticsState {
  cohorts: unknown[];
  ltvSnapshots: unknown[];
  churnRisks: unknown[];
  funnelStages: unknown[];
  viralReferrals: unknown[];
  forecast: unknown[];
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
}

export type AnalyticsSlice = AnalyticsState & AnalyticsActions;

export const initialAnalyticsState: AnalyticsState = {
  cohorts: [],
  ltvSnapshots: [],
  churnRisks: [],
  funnelStages: [],
  viralReferrals: [],
  forecast: [],
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
});
