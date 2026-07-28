import { api } from '../../api/client';
import type { AutomationRule, AutomationRuleCreate, AutomationRulePatch, Problem } from '../../types/api';

export interface RulesState {
  rules: AutomationRule[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
}

export interface RulesActions {
  loadRules: (params?: { cursor?: string; campaignId?: string; status?: AutomationRule['status'][] }) => Promise<void>;
  createRule: (input: AutomationRuleCreate, idempotencyKey?: string) => Promise<AutomationRule | null>;
  updateRule: (id: string, patch: AutomationRulePatch) => Promise<AutomationRule | null>;
  deleteRule: (id: string) => Promise<boolean>;
}

export type RulesSlice = RulesState & RulesActions;

export const initialRulesState: RulesState = {
  rules: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
};

export const createRulesSlice = (set: any) => ({
  ...initialRulesState,
  loadRules: async (params: { cursor?: string; campaignId?: string; status?: AutomationRule['status'][] } = {}) => {
    set((s: any) => { s.rules.loading = true; s.rules.error = null; }, false, 'rules/loadRules/start');
    const res = await api.rules.list(params);
    if ('problem' in res) {
      set((s: any) => { s.rules.error = res.problem; s.rules.loading = false; }, false, 'rules/loadRules/error');
    } else {
      set((s: any) => {
        s.rules.rules = params.cursor ? [...s.rules.rules, ...res.data.data.map((r: AutomationRule) => ({ ...r }))] : res.data.data.map((r: AutomationRule) => ({ ...r }));
        s.rules.cursor = res.data.page.nextCursor;
        s.rules.hasMore = res.data.page.hasMore;
        s.rules.loading = false;
      }, false, 'rules/loadRules/done');
    }
  },
  createRule: async (input: AutomationRuleCreate, idempotencyKey?: string) => {
    const res = await api.rules.create(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.rules.error = res.problem; }, false, 'rules/createRule/error');
      return null;
    }
    set((s: any) => { s.rules.rules.unshift({ ...res.data }); }, false, 'rules/createRule/done');
    return res.data;
  },
  updateRule: async (id: string, patch: AutomationRulePatch) => {
    const res = await api.rules.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.rules.error = res.problem; }, false, 'rules/updateRule/error');
      return null;
    }
    set((s: any) => {
      const idx = s.rules.rules.findIndex((r: AutomationRule) => r.id === id);
      if (idx >= 0) s.rules.rules[idx] = res.data;
    }, false, 'rules/updateRule/done');
    return res.data;
  },
  deleteRule: async (id: string) => {
    const res = await api.rules.delete(id);
    if ('problem' in res) {
      set((s: any) => { s.rules.error = res.problem; }, false, 'rules/deleteRule/error');
      return false;
    }
    set((s: any) => {
      s.rules.rules = s.rules.rules.filter((r: AutomationRule) => r.id !== id);
    }, false, 'rules/deleteRule/done');
    return true;
  },
});
