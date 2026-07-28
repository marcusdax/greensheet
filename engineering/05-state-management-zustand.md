# 05 — Frontend State Architecture: useReducer → Zustand Migration

> **Extends:** Base Doc §IV.4.2 (`EnhancedNavigator` with `useReducer` + `sourcingReducer`) and §I.3 ("Transition from useState to useReducer and Context API… adopt Zustand for cross-component state").
> **The problem this solves:** the Base Doc's `useReducer` lives inside one component tree. As soon as the Campaign Intelligence dashboard (§IV.4.4), the sample-kit tracker, and the Navigator need shared state (selected lot, goal profile, saved views), we face prop-drilling or Context re-render storms. This document defines the final architecture and a safe, incremental migration path.

---

## 1. State Ownership Split (the one rule)

| State class | Owner | Examples |
|---|---|---|
| **Server state** (async, cacheable, has a backend truth) | **React Query** | lots list, campaign performance, sample kits, LTV snapshots |
| **Client state** (synchronous UI/session state) | **Zustand** | filters/weights, sort order, selected lot, saved views, modal stack, optimistic overrides |
| **URL state** (shareable filters) | **search params** | `?goal=costOptimized&minCup=85` (synced from the sourcing slice, §6) |
| **Form state** | react-hook-form (local) | feedback submission, rule editor |

> Never mirror server data into Zustand. The only exception is **optimistic override layers** (§5), which are ephemeral and self-clearing.

## 2. Directory Layout

```
src/
  stores/
    root-store.ts          # combined store + middleware pipeline
    slices/
      sourcing-slice.ts    # Navigator filters/weights (replaces sourcingReducer)
      selection-slice.ts   # selected lot / compare tray
      campaign-slice.ts    # active sequence step, view mode (from CampaignIntelligence)
      sample-kit-slice.ts  # kit tracker UI state
      ui-slice.ts          # modals, toasts, feature-flag snapshot
    selectors/
      sourcing-selectors.ts
      campaign-selectors.ts
  queries/
    lots-queries.ts        # React Query options factories
    campaigns-queries.ts
    kits-queries.ts
    mutations/             # optimistic mutations (§5)
```

## 3. Migration Map: `sourcingReducer` → `createSourcingSlice`

Every action in the Base Doc reducer (§IV.4.2) maps 1:1 to a slice action — the state machine is preserved, so no behavioral regression:

| `useReducer` action (Base Doc) | Zustand action | Notes |
|---|---|---|
| `{ type: 'SET_GOAL', payload: { goal, weights } }` | `setGoal(goal)` | weights looked up from `GOAL_PROFILES` inside the slice (single source) |
| `{ type: 'SET_BUDGET', payload: n }` | `setBudgetCeiling(n)` | also resets `showOverBudget` when raised above max price |
| `{ type: 'TOGGLE_OVER_BUDGET' }` | `toggleOverBudget()` | — |
| `{ type: 'SET_SORT_ORDER', payload }` | `setSortOrder(o)` | — |
| `{ type: 'SET_SEARCH_QUERY', payload }` | `setSearchQuery(q)` | lowercased in slice (as in reducer) |
| `{ type: 'TOGGLE_ORIGIN', payload }` | `toggleOrigin(o)` | — |
| `{ type: 'TOGGLE_PROCESS', payload }` | `toggleProcess(p)` | — |
| `{ type: 'SET_MIN_CUP_SCORE', payload }` | `setMinCupScore(n)` | — |
| `{ type: 'RESET_FILTERS' }` | `resetFilters()` | — |
| `useLocalStorage('greensheet-navigator-view')` | `persist` middleware (partialize) | saved views now versioned, see §4.3 |
| `useMemo(rankedLots)` | **selector** `selectRankedLots` (memoized) | moves computation out of render, §4.4 |

**Migration steps (per component, zero big-bang):**

1. Install: `pnpm add zustand @tanstack/react-query immer` (+ `zustand/middleware/immer`).
2. Create the slice (below) alongside the existing reducer — feature-flag `new_navigator` (Base Doc §10.1 `FeatureFlag.NewNavigator`) already exists and gates the swap.
3. Replace `const [state, dispatch] = useReducer(...)` with `const s = useSourcingSlice()` in `EnhancedNavigator`.
4. Replace `dispatch({ type: 'SET_GOAL', payload: { goal: key, weights: profile.weights } })` with `s.setGoal(key)`.
5. Replace the `rankedLots` `useMemo` with `useRankedLots(lots)` (selector hook).
6. Delete the reducer + `goalProfiles` from the component file (they now live in the slice).
7. Keep the old code path for one release behind the flag; remove in cleanup PR.

---

## 4. Store Implementation (full TypeScript)

### 4.1 Types shared with the API contract (generated from `02-openapi-contract.md`)

```typescript
// src/types/domain.ts
export interface CoffeeLot {
  id: string;
  origin: string;
  varietal: string | null;
  processingMethod: 'washed' | 'natural' | 'honey' | 'anaerobic' | null;
  elevation: number | null;
  cupScore: number;
  pricePerLbCents: number;          // API field; UI converts: pricePerLb = cents / 100
  costPerLbCents: number;
  availableQuantityLbs: number;
  esgScore: number | null;
  logisticsScore: number | null;
  flavorNotes: string[];
  status: 'active' | 'retired';
}

export type SortOrder = 'weighted' | 'price' | 'cup' | 'esg';
export type GoalKey = 'baseline' | 'costOptimized' | 'qualityFirst' | 'sustainability' | 'supplyChain';

export interface SourcingWeights { cost: number; cup: number; esg: number; logistics: number; }

export interface GoalProfile {
  label: string;
  description: string;
  weights: SourcingWeights;
  icon: string;
}

export const GOAL_PROFILES: Record<GoalKey, GoalProfile> = {
  baseline:       { label: 'Balanced Sourcing',       description: 'Standard approach balancing quality, cost, and sustainability', weights: { cost: 0.25, cup: 0.35, esg: 0.25, logistics: 0.15 }, icon: '⚖️' },
  costOptimized:  { label: 'Cost Optimization',       description: 'Maximum margin expansion through aggressive pricing',           weights: { cost: 0.6,  cup: 0.2,  esg: 0.1,  logistics: 0.1  }, icon: '💰' },
  qualityFirst:   { label: 'Quality Focus',           description: 'Prioritize highest cup scores for premium product lines',       weights: { cost: 0.1,  cup: 0.7,  esg: 0.1,  logistics: 0.1  }, icon: '🌟' },
  sustainability: { label: 'ESG Champion',            description: 'Maximize sustainability and ethical sourcing metrics',          weights: { cost: 0.2,  cup: 0.2,  esg: 0.5,  logistics: 0.1  }, icon: '🌱' },
  supplyChain:    { label: 'Supply Chain Optimized',  description: 'Focus on logistics efficiency and predictable delivery',        weights: { cost: 0.2,  cup: 0.1,  esg: 0.2,  logistics: 0.5  }, icon: '🚢' },
};
```

### 4.2 Sourcing slice (reducer port)

```typescript
// src/stores/slices/sourcing-slice.ts
import type { StateCreator } from 'zustand';
import { GOAL_PROFILES, type GoalKey, type SortOrder, type SourcingWeights } from '../../types/domain';

export interface SourcingState {
  goal: GoalKey;
  budgetCeiling: number;           // USD/lb (presentation unit — Base Doc uses dollars in UI)
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
  hydrateFromView: (view: Partial<SourcingState>) => void;  // saved-view restore
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

export const createSourcingSlice: StateCreator<
  SourcingSlice,
  [['zustand/immer', never], ['zustand/devtools', never]]
> = (set) => ({
  ...initialSourcingState,

  setGoal: (goal) =>
    set((s) => {
      s.goal = goal;
      s.weights = GOAL_PROFILES[goal].weights;
      s.sortOrder = 'weighted';           // reducer parity: goal change resets sort
    }, false, 'sourcing/setGoal'),

  setBudgetCeiling: (usdPerLb) =>
    set((s) => {
      s.budgetCeiling = usdPerLb;
    }, false, 'sourcing/setBudgetCeiling'),

  toggleOverBudget: () =>
    set((s) => { s.showOverBudget = !s.showOverBudget; }, false, 'sourcing/toggleOverBudget'),

  setSortOrder: (order) =>
    set((s) => { s.sortOrder = order; }, false, 'sourcing/setSortOrder'),

  setSearchQuery: (q) =>
    set((s) => { s.searchQuery = q.toLowerCase(); }, false, 'sourcing/setSearchQuery'),

  toggleOrigin: (origin) =>
    set((s) => {
      const i = s.selectedOrigins.indexOf(origin);
      if (i >= 0) s.selectedOrigins.splice(i, 1);
      else s.selectedOrigins.push(origin);
    }, false, 'sourcing/toggleOrigin'),

  toggleProcess: (process) =>
    set((s) => {
      const i = s.selectedProcesses.indexOf(process);
      if (i >= 0) s.selectedProcesses.splice(i, 1);
      else s.selectedProcesses.push(process);
    }, false, 'sourcing/toggleProcess'),

  setMinCupScore: (score) =>
    set((s) => { s.minCupScore = score; }, false, 'sourcing/setMinCupScore'),

  resetFilters: () => set(() => ({ ...initialSourcingState }), false, 'sourcing/resetFilters'),

  hydrateFromView: (view) =>
    set((s) => Object.assign(s, view, { searchQuery: '' }), false, 'sourcing/hydrateFromView'),
});
```

### 4.3 Selection + campaign + UI slices

```typescript
// src/stores/slices/selection-slice.ts
import type { StateCreator } from 'zustand';

export interface SelectionSlice {
  selectedLotId: string | null;
  compareTray: string[];                     // up to 3 lot ids
  selectLot: (id: string | null) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
}

export const createSelectionSlice: StateCreator<SelectionSlice, [['zustand/immer', never]]> = (set) => ({
  selectedLotId: null,
  compareTray: [],
  selectLot: (id) => set((s) => { s.selectedLotId = id; }, false, 'selection/selectLot'),
  toggleCompare: (id) =>
    set((s) => {
      const i = s.compareTray.indexOf(id);
      if (i >= 0) s.compareTray.splice(i, 1);
      else if (s.compareTray.length < 3) s.compareTray.push(id);
    }, false, 'selection/toggleCompare'),
  clearCompare: () => set((s) => { s.compareTray = []; }, false, 'selection/clearCompare'),
});
```

```typescript
// src/stores/slices/campaign-slice.ts — ports useState from CampaignIntelligence (§IV.4.4)
import type { StateCreator } from 'zustand';

export interface CampaignSlice {
  activeStep: number;
  viewMode: 'detailed' | 'summary';
  setActiveStep: (i: number) => void;
  toggleViewMode: () => void;
}

export const createCampaignSlice: StateCreator<CampaignSlice, [['zustand/immer', never]]> = (set) => ({
  activeStep: 0,
  viewMode: 'detailed',
  setActiveStep: (i) => set((s) => { s.activeStep = i; }, false, 'campaign/setActiveStep'),
  toggleViewMode: () =>
    set((s) => { s.viewMode = s.viewMode === 'detailed' ? 'summary' : 'detailed'; },
        false, 'campaign/toggleViewMode'),
});
```

```typescript
// src/stores/slices/ui-slice.ts
import type { StateCreator } from 'zustand';

export interface Toast { id: string; kind: 'success' | 'error' | 'info'; message: string; }

export interface UiSlice {
  toasts: Toast[];
  featureFlags: Record<string, boolean>;    // snapshot from /v1/feature-flags at boot
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setFeatureFlags: (flags: Record<string, boolean>) => void;
}

export const createUiSlice: StateCreator<UiSlice, [['zustand/immer', never]]> = (set) => ({
  toasts: [],
  featureFlags: {},
  pushToast: (t) =>
    set((s) => { s.toasts.push({ ...t, id: crypto.randomUUID() }); }, false, 'ui/pushToast'),
  dismissToast: (id) =>
    set((s) => { s.toasts = s.toasts.filter((x) => x.id !== id); }, false, 'ui/dismissToast'),
  setFeatureFlags: (flags) =>
    set((s) => { s.featureFlags = flags; }, false, 'ui/setFeatureFlags'),
});
```

### 4.4 Root store with middleware pipeline

```typescript
// src/stores/root-store.ts
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSourcingSlice, type SourcingSlice } from './slices/sourcing-slice';
import { createSelectionSlice, type SelectionSlice } from './slices/selection-slice';
import { createCampaignSlice, type CampaignSlice } from './slices/campaign-slice';
import { createUiSlice, type UiSlice } from './slices/ui-slice';

export type RootStore = {
  sourcing: SourcingSlice;
  selection: SelectionSlice;
  campaign: CampaignSlice;
  ui: UiSlice;
};

export const useRootStore = create<RootStore>()(
  devtools(                                  // Redux DevTools time-travel (action names above)
    persist(
      subscribeWithSelector(                 // enables fine-grained subscriptions (§6 URL sync)
        immer((...a) => ({
          sourcing: createSourcingSlice(...a as never),
          selection: createSelectionSlice(...a as never),
          campaign: createCampaignSlice(...a as never),
          ui: createUiSlice(...a as never),
        })),
      ),
      {
        name: 'greensheet-store',
        version: 3,
        // Persist ONLY the durable bits — never server data, never toasts.
        partialize: (s) => ({
          sourcing: {
            goal: s.sourcing.goal,
            budgetCeiling: s.sourcing.budgetCeiling,
            weights: s.sourcing.weights,
            sortOrder: s.sourcing.sortOrder,
            minCupScore: s.sourcing.minCupScore,
            showOverBudget: s.sourcing.showOverBudget,
          },
        }),
        migrate: (persisted: any, version) => {
          if (version < 3 && persisted?.sourcing?.weights == null) {
            persisted.sourcing = { ...persisted.sourcing, weights: { cost: 0.25, cup: 0.35, esg: 0.25, logistics: 0.15 } };
          }
          return persisted;
        },
      },
    ),
    { name: 'GreensheetStore' },
  ),
);

// Slice hooks (components never touch useRootStore directly — stable references)
export const useSourcing = () => useRootStore((s) => s.sourcing);
export const useSelection = () => useRootStore((s) => s.selection);
export const useCampaign = () => useRootStore((s) => s.campaign);
export const useUi = () => useRootStore((s) => s.ui);
```

### 4.5 Memoized selectors — the ranking algorithm as a pure selector

The Base Doc's `rankedLots` `useMemo` becomes a **selector factory** with structural sharing, so 50 simultaneously mounted `LotCard`s never recompute:

```typescript
// src/stores/selectors/sourcing-selectors.ts
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSourcing } from '../root-store';
import type { CoffeeLot } from '../../types/domain';

export interface ScoredLot extends CoffeeLot {
  metrics: {
    costNorm: number; cupNorm: number; esgNorm: number; logisticsNorm: number;
    weightedScore: number; isOverBudget: boolean;
  };
}

/** Pure function — exported for Vitest (see 06-testing-chaos-ci.md §3). */
export function rankLots(lots: CoffeeLot[], s: {
  weights: { cost: number; cup: number; esg: number; logistics: number };
  budgetCeiling: number; showOverBudget: boolean; searchQuery: string;
  selectedOrigins: string[]; selectedProcesses: string[]; minCupScore: number;
  sortOrder: 'weighted' | 'price' | 'cup' | 'esg';
}): ScoredLot[] {
  let filtered = lots;

  if (s.searchQuery) {
    filtered = filtered.filter((l) =>
      l.origin.toLowerCase().includes(s.searchQuery) ||
      l.varietal?.toLowerCase().includes(s.searchQuery) ||
      l.flavorNotes.some((n) => n.toLowerCase().includes(s.searchQuery)));
  }
  if (s.selectedOrigins.length)   filtered = filtered.filter((l) => s.selectedOrigins.includes(l.origin));
  if (s.selectedProcesses.length) filtered = filtered.filter((l) => l.processingMethod && s.selectedProcesses.includes(l.processingMethod));
  if (!s.showOverBudget)          filtered = filtered.filter((l) => l.pricePerLbCents / 100 <= s.budgetCeiling);
  filtered = filtered.filter((l) => l.cupScore >= s.minCupScore);

  const prices = lots.map((l) => l.pricePerLbCents);
  const maxP = Math.max(...prices), minP = Math.min(...prices);

  const scored = filtered.map((lot): ScoredLot => {
    const costNorm      = maxP > minP ? clamp100(((maxP - lot.pricePerLbCents) / (maxP - minP)) * 100) : 50;
    const cupNorm       = clamp100(((lot.cupScore - 75) / 20) * 100);
    const esgNorm       = lot.esgScore != null ? lot.esgScore * 100 : 50;
    const logisticsNorm = lot.logisticsScore != null ? lot.logisticsScore * 100 : 50;
    const weightedScore =
      costNorm * s.weights.cost + cupNorm * s.weights.cup +
      esgNorm * s.weights.esg + logisticsNorm * s.weights.logistics;
    return {
      ...lot,
      metrics: {
        costNorm: Math.round(costNorm), cupNorm: Math.round(cupNorm),
        esgNorm: Math.round(esgNorm),   logisticsNorm: Math.round(logisticsNorm),
        weightedScore: Math.round(weightedScore * 100) / 100,
        isOverBudget: lot.pricePerLbCents / 100 > s.budgetCeiling,
      },
    };
  });

  switch (s.sortOrder) {
    case 'price': return scored.sort((a, b) => a.pricePerLbCents - b.pricePerLbCents);
    case 'cup':   return scored.sort((a, b) => b.cupScore - a.cupScore);
    case 'esg':   return scored.sort((a, b) => (b.esgScore ?? 0) - (a.esgScore ?? 0));
    default:      return scored.sort((a, b) => b.metrics.weightedScore - a.metrics.weightedScore);
  }
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

/** Hook: subscribes to exactly the 8 filter fields, not the whole slice. */
export function useRankedLots(lots: CoffeeLot[]): ScoredLot[] {
  const filters = useSourcing();   // slice object is stable (single immer draft per action)
  const slice = useShallowFilters();
  return useMemo(() => rankLots(lots, slice), [lots, slice]);
}

function useShallowFilters() {
  const s = useSourcing();
  return useShallowObject({
    weights: s.weights, budgetCeiling: s.budgetCeiling, showOverBudget: s.showOverBudget,
    searchQuery: s.searchQuery, selectedOrigins: s.selectedOrigins,
    selectedProcesses: s.selectedProcesses, minCupScore: s.minCupScore, sortOrder: s.sortOrder,
  });
}

// tiny stable-object helper (equivalent to useShallow from zustand/react/shallow for objects)
import { useRef } from 'react';
function useShallowObject<T extends Record<string, unknown>>(obj: T): T {
  const ref = useRef(obj);
  if (Object.keys(obj).some((k) => !Object.is(obj[k], (ref.current as any)[k]))) ref.current = obj;
  return ref.current;
}
```

---

## 5. React Query Integration & Optimistic Updates

### 5.1 Query factories (server state)

```typescript
// src/queries/lots-queries.ts
import { queryOptions } from '@tanstack/react-query';
import type { CoffeeLot } from '../types/domain';
import { api } from '../lib/api-client';          // fetch wrapper w/ OIDC token (07 doc §1)

export const lotsKeys = {
  all: ['lots'] as const,
  list: (filters: Record<string, unknown>) => [...lotsKeys.all, 'list', filters] as const,
  detail: (id: string) => [...lotsKeys.all, 'detail', id] as const,
};

export function lotsListQuery(params: {
  origins?: string[]; minCupScore?: number; maxPricePerLb?: number; limit?: number; cursor?: string;
}) {
  return queryOptions({
    queryKey: lotsKeys.list(params),
    queryFn: async ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (params.origins?.length) qs.set('origins', params.origins.join(','));
      if (params.minCupScore) qs.set('minCupScore', String(params.minCupScore));
      if (params.maxPricePerLb) qs.set('maxPricePerLb', String(params.maxPricePerLb));
      qs.set('limit', String(params.limit ?? 50));
      if (pageParam) qs.set('cursor', pageParam as string);
      const res = await api.get<{ data: CoffeeLot[]; page: { nextCursor: string | null; hasMore: boolean } }>(
        `/v1/catalog/lots?${qs}`);
      return res;
    },
    initialPageParam: '',
    getNextPageParam: (last) => (last.page.hasMore ? last.page.nextCursor : undefined),
    staleTime: 60_000,                               // lots change rarely intraday
    gcTime: 5 * 60_000,
  });
}

// Usage: const q = useInfiniteQuery(lotsListQuery({ origins: s.selectedOrigins, ... }));
// The server pre-filters (02-openapi-contract.md §5 /v1/catalog/lots); Zustand filters
// refine client-side for instant slider feedback — two-stage filtering, no staleness.
```

### 5.2 Optimistic mutation — reserve a lot ("Source This Lot" button in `LotCard`)

```typescript
// src/queries/mutations/use-reserve-lot.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { useRootStore } from '../../stores/root-store';
import { lotsKeys } from '../lots-queries';
import type { CoffeeLot } from '../../types/domain';

interface ReserveInput { lotId: string; quantityLbs: number; orderId: string; }

export function useReserveLot() {
  const qc = useQueryClient();

  return useMutation({
    mutationKey: ['reserve-lot'],
    mutationFn: (input: ReserveInput) =>
      api.post<{ id: string }>(
        `/v1/catalog/lots/${input.lotId}/reservations`,
        { quantityLbs: input.quantityLbs, orderId: input.orderId },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },   // contract §02-2
      ),

    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: lotsKeys.all });
      const snapshots = qc.getQueriesData({ queryKey: lotsKeys.all });

      // Optimistic: decrement availableQuantityLbs everywhere the lot appears
      qc.setQueriesData({ queryKey: lotsKeys.all }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => ({
            ...p,
            data: p.data.map((l: CoffeeLot) =>
              l.id === input.lotId
                ? { ...l, availableQuantityLbs: Math.max(0, l.availableQuantityLbs - input.quantityLbs) }
                : l),
          })),
        };
      });

      useRootStore.getState().ui.pushToast({ kind: 'info', message: 'Reserving inventory…' });
      return { snapshots };
    },

    onError: (err, input, ctx) => {
      // Rollback to snapshots (Base Doc §I.3 idempotency means a replay is safe)
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
      useRootStore.getState().ui.pushToast({
        kind: 'error',
        message: isProblem(err, 'GS-CAT-1001')
          ? 'Not enough inventory available.'
          : 'Reservation failed — please retry.',
      });
    },

    onSuccess: () => {
      useRootStore.getState().ui.pushToast({ kind: 'success', message: 'Lot reserved for 30 minutes.' });
    },

    onSettled: (_d, _e, input) => {
      qc.invalidateQueries({ queryKey: lotsKeys.detail(input.lotId) });
    },
  });
}

const isProblem = (e: unknown, code: string) =>
  typeof e === 'object' && e !== null && (e as any).problem?.code === code;
```

### 5.3 Optimistic campaign variant switch (CampaignIntelligence)

```typescript
// src/queries/mutations/use-select-variant.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

export function useSelectVariant(campaignId: string) {
  const qc = useQueryClient();
  const key = ['campaigns', 'performance', campaignId];

  return useMutation({
    mutationFn: (variantName: string) =>
      api.post(`/v1/campaigns/${campaignId}/variants/${variantName}/activate`, {},
        { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    onMutate: async (variantName) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => old && ({
        ...old,
        variants: old.variants.map((v: any) => ({ ...v, isActive: v.variantName === variantName })),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```

### 5.4 Boot-time wiring

```typescript
// src/app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => count < 2 && err?.problem?.status !== 400, // RFC9457-aware
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

**WebSocket/Kafka-push invalidation (optional Phase 2):** a `notifications-cg` consumer pushes `catalog.price_changed` over SSE; the client handler does `queryClient.invalidateQueries({ queryKey: lotsKeys.detail(lotId) })` — keeping React Query as the only server-state cache even in real-time mode.

---

## 6. URL Synchronization (shareable Navigator views)

```typescript
// src/stores/sync-url.ts — two-way sync using subscribeWithSelector
import { useRootStore } from './root-store';

const PARAMS = ['goal', 'maxPrice', 'minCup', 'sort', 'origins', 'processes'] as const;

export function startUrlSync() {
  // store → URL (replaceState, no history spam)
  const unsub = useRootStore.subscribe(
    (s) => s.sourcing,
    (s) => {
      const p = new URLSearchParams(window.location.search);
      p.set('goal', s.goal);
      p.set('maxPrice', String(s.budgetCeiling));
      p.set('minCup', String(s.minCupScore));
      p.set('sort', s.sortOrder);
      s.selectedOrigins.length ? p.set('origins', s.selectedOrigins.join(',')) : p.delete('origins');
      s.selectedProcesses.length ? p.set('processes', s.selectedProcesses.join(',')) : p.delete('processes');
      window.history.replaceState(null, '', `?${p.toString()}`);
    },
    { equalityFn: (a, b) => a.goal === b.goal && a.budgetCeiling === b.budgetCeiling
        && a.minCupScore === b.minCupScore && a.sortOrder === b.sortOrder
        && a.selectedOrigins === b.selectedOrigins && a.selectedProcesses === b.selectedProcesses },
  );

  // URL → store (on first load)
  const p = new URLSearchParams(window.location.search);
  if ([...p.keys()].some((k) => (PARAMS as readonly string[]).includes(k))) {
    useRootStore.getState().sourcing.hydrateFromView({
      goal: (p.get('goal') as any) ?? undefined,
      budgetCeiling: p.get('maxPrice') ? Number(p.get('maxPrice')) : undefined,
      minCupScore: p.get('minCup') ? Number(p.get('minCup')) : undefined,
      sortOrder: (p.get('sort') as any) ?? undefined,
      selectedOrigins: p.get('origins')?.split(',') ?? [],
      selectedProcesses: p.get('processes')?.split(',') ?? [],
    });
  }
  return unsub;
}
```

---

## 7. Component Integration (diff against Base Doc §IV.4.2)

```tsx
// components/Navigator/EnhancedNavigator.tsx — AFTER migration (excerpt)
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSourcing, useSelection } from '../../stores/root-store';
import { useRankedLots } from '../../stores/selectors/sourcing-selectors';
import { lotsListQuery } from '../../queries/lots-queries';
import { useReserveLot } from '../../queries/mutations/use-reserve-lot';
import { GOAL_PROFILES, type GoalKey } from '../../types/domain';

export function EnhancedNavigator() {
  const s = useSourcing();
  const sel = useSelection();

  // Server state — pre-filtered page stream
  const lotsQ = useInfiniteQuery(lotsListQuery({
    origins: s.selectedOrigins,
    minCupScore: s.minCupScore,
    maxPricePerLb: s.showOverBudget ? undefined : s.budgetCeiling,
  }));
  const lots = lotsQ.data?.pages.flatMap((p) => p.data) ?? [];

  // Client-side ranked refinement (instant slider response, no network)
  const rankedLots = useRankedLots(lots);

  const reserve = useReserveLot();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.entries(GOAL_PROFILES) as [GoalKey, typeof GOAL_PROFILES[GoalKey]][]).map(([key, profile]) => (
          <button
            key={key}
            onClick={() => s.setGoal(key)}
            className={s.goal === key ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}
          >
            {profile.icon} {profile.label}
          </button>
        ))}
      </div>

      <input
        type="range" min={3} max={45} step={0.5}
        value={s.budgetCeiling}
        onChange={(e) => s.setBudgetCeiling(Number(e.target.value))}
        aria-label="Budget ceiling slider"
      />

      {rankedLots.map((lot, i) => (
        <LotCard
          key={lot.id}
          lot={lot}
          rank={i + 1}
          budgetCeiling={s.budgetCeiling}
          onSelect={() => {
            sel.selectLot(lot.id);
            reserve.mutate({ lotId: lot.id, quantityLbs: 100, orderId: crypto.randomUUID() });
          }}
        />
      ))}

      {lotsQ.hasNextPage && (
        <button onClick={() => lotsQ.fetchNextPage()} disabled={lotsQ.isFetchingNextPage}>
          {lotsQ.isFetchingNextPage ? 'Loading…' : 'Load more lots'}
        </button>
      )}
    </div>
  );
}
```

**What was deleted from the Base Doc component:** `useReducer`, `sourcingReducer`, `initialState`, `goalProfiles`, the `useLocalStorage` saved-view hook (replaced by `persist`), and the 80-line `rankedLots` `useMemo` (replaced by `useRankedLots`). Component drops from ~500 to ~120 lines.

---

## 8. Testing the Store (Vitest)

```typescript
// src/stores/__tests__/sourcing-slice.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore } from '../root-store';
import { rankLots } from '../selectors/sourcing-selectors';
import { GOAL_PROFILES } from '../../types/domain';

const reset = () => useRootStore.getState().sourcing.resetFilters();

describe('sourcing slice (reducer parity)', () => {
  beforeEach(reset);

  it('setGoal applies profile weights and resets sortOrder', () => {
    const st = useRootStore.getState().sourcing;
    st.setSortOrder('price');
    st.setGoal('costOptimized');
    const after = useRootStore.getState().sourcing;
    expect(after.weights).toEqual(GOAL_PROFILES.costOptimized.weights);
    expect(after.sortOrder).toBe('weighted');
  });

  it('toggleOrigin adds and removes', () => {
    const st = useRootStore.getState().sourcing;
    st.toggleOrigin('Ethiopia');
    expect(useRootStore.getState().sourcing.selectedOrigins).toContain('Ethiopia');
    st.toggleOrigin('Ethiopia');
    expect(useRootStore.getState().sourcing.selectedOrigins).not.toContain('Ethiopia');
  });

  it('setSearchQuery lowercases input', () => {
    useRootStore.getState().sourcing.setSearchQuery('GEISHA');
    expect(useRootStore.getState().sourcing.searchQuery).toBe('geisha');
  });
});

describe('rankLots', () => {
  const lot = (id: string, priceCents: number, cup: number) => ({
    id, origin: 'Ethiopia', varietal: null, processingMethod: 'washed' as const,
    elevation: null, cupScore: cup, pricePerLbCents: priceCents, costPerLbCents: 300,
    availableQuantityLbs: 1000, esgScore: 0.8, logisticsScore: 0.9, flavorNotes: [], status: 'active' as const,
  });

  it('excludes over-budget lots unless showOverBudget', () => {
    const lots = [lot('a', 500, 90), lot('b', 2000, 86)];
    const base = {
      weights: GOAL_PROFILES.baseline.weights, budgetCeiling: 12, showOverBudget: false,
      searchQuery: '', selectedOrigins: [], selectedProcesses: [], minCupScore: 80, sortOrder: 'weighted' as const,
    };
    expect(rankLots(lots, base).map((l) => l.id)).toEqual(['a']);
    expect(rankLots(lots, { ...base, showOverBudget: true })).toHaveLength(2);
  });

  it('sorts by weighted score descending by default', () => {
    const lots = [lot('cheap', 400, 82), lot('premium', 1500, 94)];
    const r = rankLots(lots, {
      weights: GOAL_PROFILES.qualityFirst.weights, budgetCeiling: 45, showOverBudget: true,
      searchQuery: '', selectedOrigins: [], selectedProcesses: [], minCupScore: 80, sortOrder: 'weighted',
    });
    expect(r[0].id).toBe('premium');
  });
});
```

---

## 9. Migration Checklist & Rollback

| # | Step | Gate |
|---|---|---|
| 1 | Add Zustand store + slices alongside reducer | unit tests green (§8) |
| 2 | Port `EnhancedNavigator` behind `new_navigator` flag | visual regression (Playwright §06) |
| 3 | Port `CampaignIntelligence` `useState` → `campaign-slice` | e2e campaign dashboard spec |
| 4 | Move server data to React Query factories | MSW contract tests vs OpenAPI (§02) |
| 5 | Enable URL sync | share-link e2e test |
| 6 | Delete reducer/localStorage paths; bump `persist` version | cleanup PR + migrate fn tested |

**Rollback:** the flag `new_navigator` (Base Doc §10.1) flips back to the reducer path; persisted Zustand state is additive-only, so old UI ignores it safely. No data migration is required in either direction.
