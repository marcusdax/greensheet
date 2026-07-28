import { GOAL_PROFILES, type GoalKey, type SortOrder, type SourcingWeights } from '../../types/domain';

export interface SourcingState {
  goal: GoalKey;
  budgetCeiling: number;
  showOverBudget: boolean;
  weights: SourcingWeights;
  sortOrder: SortOrder;
  searchQuery: string;
  selectedOrigins: string[];
  selectedProcesses: string[];
  minCupScore: number;
}

export interface SourcingActions {
  setGoal: (goal: GoalKey) => void;
  setBudgetCeiling: (usdPerLb: number) => void;
  toggleOverBudget: () => void;
  setSortOrder: (order: SortOrder) => void;
  setSearchQuery: (q: string) => void;
  toggleOrigin: (origin: string) => void;
  toggleProcess: (process: string) => void;
  setMinCupScore: (score: number) => void;
  resetFilters: () => void;
  hydrateFromView: (view: Partial<SourcingState>) => void;
}

export type SourcingSlice = SourcingState & SourcingActions;

export const initialSourcingState: SourcingState = {
  goal: 'baseline',
  budgetCeiling: 12.0,
  showOverBudget: false,
  weights: GOAL_PROFILES.baseline.weights,
  sortOrder: 'weighted',
  searchQuery: '',
  selectedOrigins: [],
  selectedProcesses: [],
  minCupScore: 80,
};

export const createSourcingSlice = (set: any) => ({
  ...initialSourcingState,

  setGoal: (goal: GoalKey) =>
    set((s: any) => {
      s.sourcing.goal = goal;
      s.sourcing.weights = GOAL_PROFILES[goal].weights;
      s.sourcing.sortOrder = 'weighted';
    }, false, 'sourcing/setGoal'),

  setBudgetCeiling: (usdPerLb: number) =>
    set((s: any) => {
      s.sourcing.budgetCeiling = usdPerLb;
    }, false, 'sourcing/setBudgetCeiling'),

  toggleOverBudget: () =>
    set((s: any) => { s.sourcing.showOverBudget = !s.sourcing.showOverBudget; }, false, 'sourcing/toggleOverBudget'),

  setSortOrder: (order: SortOrder) =>
    set((s: any) => { s.sourcing.sortOrder = order; }, false, 'sourcing/setSortOrder'),

  setSearchQuery: (q: string) =>
    set((s: any) => { s.sourcing.searchQuery = q.toLowerCase(); }, false, 'sourcing/setSearchQuery'),

  toggleOrigin: (origin: string) =>
    set((s: any) => {
      const i = s.sourcing.selectedOrigins.indexOf(origin);
      if (i >= 0) s.sourcing.selectedOrigins.splice(i, 1);
      else s.sourcing.selectedOrigins.push(origin);
    }, false, 'sourcing/toggleOrigin'),

  toggleProcess: (process: string) =>
    set((s: any) => {
      const i = s.sourcing.selectedProcesses.indexOf(process);
      if (i >= 0) s.sourcing.selectedProcesses.splice(i, 1);
      else s.sourcing.selectedProcesses.push(process);
    }, false, 'sourcing/toggleProcess'),

  setMinCupScore: (score: number) =>
    set((s: any) => { s.sourcing.minCupScore = score; }, false, 'sourcing/setMinCupScore'),

  resetFilters: () => set((s: any) => {
    s.sourcing.goal = initialSourcingState.goal;
    s.sourcing.budgetCeiling = initialSourcingState.budgetCeiling;
    s.sourcing.showOverBudget = initialSourcingState.showOverBudget;
    s.sourcing.weights = initialSourcingState.weights;
    s.sourcing.sortOrder = initialSourcingState.sortOrder;
    s.sourcing.searchQuery = initialSourcingState.searchQuery;
    s.sourcing.selectedOrigins = [];
    s.sourcing.selectedProcesses = [];
    s.sourcing.minCupScore = initialSourcingState.minCupScore;
  }, false, 'sourcing/resetFilters'),

  hydrateFromView: (view: Partial<SourcingState>) =>
    set((s: any) => {
      Object.assign(s.sourcing, view, { searchQuery: '' });
    }, false, 'sourcing/hydrateFromView'),
});
