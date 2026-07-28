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
  createRoaster: (input: RoasterCreate & { status?: Roaster['status']; segment?: Roaster['segment'] }, idempotencyKey?: string) => Promise<Roaster | null>;
  updateRoaster: (id: string, patch: Partial<Roaster>) => Promise<Roaster | null>;
  logIntervention: (roasterId: string, intervention: Omit<Roaster['interventions'][number], 'id'>, idempotencyKey?: string) => Promise<Roaster | null>;
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
  createRoaster: async (input: RoasterCreate & { status?: Roaster['status']; segment?: Roaster['segment'] }, idempotencyKey?: string) => {
    const res = await api.roasters.create(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/createRoaster/error');
      return null;
    }
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === res.data.id);
      if (idx >= 0) s.crm.roasters[idx] = { ...res.data };
      else s.crm.roasters.unshift({ ...res.data });
    }, false, 'crm/createRoaster/done');
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
  logIntervention: async (roasterId: string, intervention: Omit<Roaster['interventions'][number], 'id'>, idempotencyKey?: string) => {
    const key = idempotencyKey ?? crypto.randomUUID();
    const res = await api.roasters.logIntervention(roasterId, { idempotencyKey: key, intervention });
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/logIntervention/error');
      return null;
    }
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === res.data.id);
      if (idx >= 0) s.crm.roasters[idx] = res.data;
    }, false, 'crm/logIntervention/done');
    return res.data;
  },
  anonymizeRoaster: async (id: string) => {
    const res = await api.roasters.patch(id, {
      roasterName: '[redacted]',
      primaryContact: { fullName: '[redacted]', email: 'redacted@example.com', marketingOptIn: false },
    });
    if ('problem' in res) {
      set((s: any) => { s.crm.error = res.problem; }, false, 'crm/anonymize/error');
      return;
    }
    set((s: any) => {
      const idx = s.crm.roasters.findIndex((r: Roaster) => r.id === id);
      if (idx >= 0) s.crm.roasters[idx] = res.data;
    }, false, 'crm/anonymize/done');
  },
});
