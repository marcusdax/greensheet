import { api } from '../../api/client';
import type { Roaster, RoasterCreate, Problem } from '../../types/api';

export interface CrmState {
  roasters: Roaster[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
}

export interface CrmActions {
  loadRoasters: (params?: { cursor?: string; status?: Roaster['status'][]; segment?: Roaster['segment'][]; minChurnRisk?: number }) => Promise<void>;
  createRoaster: (input: RoasterCreate & { status?: Roaster['status']; segment?: Roaster['segment'] }) => Promise<Roaster | null>;
  updateRoaster: (id: string, patch: Partial<Roaster>) => Promise<Roaster | null>;
  logIntervention: (roasterId: string, intervention: Omit<Roaster['interventions'][number], 'id'>) => Promise<void>;
  anonymizeRoaster: (id: string) => Promise<void>;
}

export type CrmSlice = CrmState & CrmActions;

export const initialCrmState: CrmState = {
  roasters: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
};

export const createCrmSlice = (set: any) => ({
  ...initialCrmState,
  loadRoasters: async (params: { cursor?: string; status?: Roaster['status'][]; segment?: Roaster['segment'][]; minChurnRisk?: number } = {}) => {
    set((s: any) => { s.crm.loading = true; s.crm.error = null; }, false, 'crm/loadRoasters/start');
    const res = await api.roasters.list(params);
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; s.crm.loading = false; }, false, 'crm/loadRoasters/error');
    } else {
      set((s: any) => {
        s.crm.roasters = params.cursor ? [...s.crm.roasters, ...res.data.data.map((r: Roaster) => ({ ...r }))] : res.data.data.map((r: Roaster) => ({ ...r }));
        s.crm.cursor = res.data.page.nextCursor;
        s.crm.hasMore = res.data.page.hasMore;
        s.crm.loading = false;
      }, false, 'crm/loadRoasters/done');
    }
  },
  createRoaster: async (input: RoasterCreate & { status?: Roaster['status']; segment?: Roaster['segment'] }) => {
    const res = await api.roasters.create(input, crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/createRoaster/error');
      return null;
    }
    set((s: any) => { s.crm.roasters.unshift({ ...res.data }); }, false, 'crm/createRoaster/done');
    return res.data;
  },
  updateRoaster: async (id: string, patch: Partial<Roaster>) => {
    const res = await api.roasters.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/updateRoaster/error');
      return null;
    }
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === id);
      if (idx >= 0) s.crm.roasters[idx] = res.data;
    }, false, 'crm/updateRoaster/done');
    return res.data;
  },
  logIntervention: async (roasterId: string, intervention: Omit<Roaster['interventions'][number], 'id'>) => {
    const full = { ...intervention, id: crypto.randomUUID() };
    const existing = await api.roasters.get(roasterId);
    if ('problem' in existing) {
      set((s: any) => { s.crm.error = existing.problem; }, false, 'crm/logIntervention/error');
      return;
    }
    const interventions = [...existing.data.interventions, full];
    const res = await api.roasters.patch(roasterId, { interventions });
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/logIntervention/error');
    } else {
      set((s: any) => {
        const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === roasterId);
        if (idx >= 0) s.crm.roasters[idx] = res.data;
      }, false, 'crm/logIntervention/done');
    }
  },
  anonymizeRoaster: async (id: string) => {
    await api.roasters.patch(id, {
      roasterName: '[redacted]',
      primaryContact: { fullName: '[redacted]', email: 'redacted@example.com', marketingOptIn: false },
    });
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === id);
      if (idx >= 0) s.crm.roasters[idx].primaryContact = { fullName: '[redacted]', email: 'redacted@example.com', marketingOptIn: false };
    }, false, 'crm/anonymize/done');
  },
});
