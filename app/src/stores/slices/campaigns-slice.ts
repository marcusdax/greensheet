import { api } from '../../api/client';
import type { Campaign, CampaignCreate, CampaignPatch, CampaignPerformance, Problem } from '../../types/api';

export interface CampaignsState {
  campaigns: Campaign[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
  performance: CampaignPerformance | null;
}

export interface CampaignsActions {
  loadCampaigns: (params?: { cursor?: string; status?: Campaign['status'][] }) => Promise<void>;
  createCampaign: (input: CampaignCreate) => Promise<Campaign | null>;
  updateCampaign: (id: string, patch: CampaignPatch) => Promise<Campaign | null>;
  activateCampaign: (id: string) => Promise<Campaign | null>;
  pauseCampaign: (id: string) => Promise<Campaign | null>;
  retireCampaign: (id: string) => Promise<Campaign | null>;
  loadPerformance: (id: string) => Promise<CampaignPerformance | null>;
}

export type CampaignsSlice = CampaignsState & CampaignsActions;

export const initialCampaignsState: CampaignsState = {
  campaigns: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
  performance: null,
};

export const createCampaignsSlice = (set: any) => ({
  ...initialCampaignsState,
  loadCampaigns: async (params: { cursor?: string; status?: Campaign['status'][] } = {}) => {
    set((s: any) => { s.campaigns.loading = true; s.campaigns.error = null; }, false, 'campaigns/loadCampaigns/start');
    const res = await api.campaigns.list(params);
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; s.campaigns.loading = false; }, false, 'campaigns/loadCampaigns/error');
    } else {
      set((s: any) => {
        s.campaigns.campaigns = params.cursor ? [...s.campaigns.campaigns, ...res.data.data.map((c: Campaign) => ({ ...c }))] : res.data.data.map((c: Campaign) => ({ ...c }));
        s.campaigns.cursor = res.data.page.nextCursor;
        s.campaigns.hasMore = res.data.page.hasMore;
        s.campaigns.loading = false;
      }, false, 'campaigns/loadCampaigns/done');
    }
  },
  createCampaign: async (input: CampaignCreate) => {
    const res = await api.campaigns.create(input, crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/createCampaign/error');
      return null;
    }
    set((s: any) => { s.campaigns.campaigns.unshift({ ...res.data }); }, false, 'campaigns/createCampaign/done');
    return res.data;
  },
  updateCampaign: async (id: string, patch: CampaignPatch) => {
    const res = await api.campaigns.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/updateCampaign/error');
      return null;
    }
    set((s: any) => {
      const idx = s.campaigns.campaigns.findIndex((c: Campaign) => c.id === id);
      if (idx >= 0) s.campaigns.campaigns[idx] = res.data;
    }, false, 'campaigns/updateCampaign/done');
    return res.data;
  },
  activateCampaign: async (id: string) => {
    const res = await api.campaigns.patch(id, { status: 'active' });
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/activateCampaign/error');
      return null;
    }
    set((s: any) => {
      const idx = s.campaigns.campaigns.findIndex((c: Campaign) => c.id === id);
      if (idx >= 0) s.campaigns.campaigns[idx] = res.data;
    }, false, 'campaigns/activateCampaign/done');
    return res.data;
  },
  pauseCampaign: async (id: string) => {
    const res = await api.campaigns.halt(id);
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/pauseCampaign/error');
      return null;
    }
    set((s: any) => {
      const idx = s.campaigns.campaigns.findIndex((c: Campaign) => c.id === id);
      if (idx >= 0) s.campaigns.campaigns[idx] = res.data;
    }, false, 'campaigns/pauseCampaign/done');
    return res.data;
  },
  retireCampaign: async (id: string) => {
    const res = await api.campaigns.patch(id, { status: 'retired' });
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/retireCampaign/error');
      return null;
    }
    set((s: any) => {
      const idx = s.campaigns.campaigns.findIndex((c: Campaign) => c.id === id);
      if (idx >= 0) s.campaigns.campaigns[idx] = res.data;
    }, false, 'campaigns/retireCampaign/done');
    return res.data;
  },
  loadPerformance: async (id: string) => {
    const res = await api.campaigns.performance(id);
    if ('problem' in res) {
      set((s: any) => { s.campaigns.error = res.problem; }, false, 'campaigns/loadPerformance/error');
      return null;
    }
    set((s: any) => { s.campaigns.performance = res.data; }, false, 'campaigns/loadPerformance/done');
    return res.data;
  },
});
