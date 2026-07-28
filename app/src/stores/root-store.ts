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
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => ({
          sourcing: createSourcingSlice(set),
          selection: createSelectionSlice(set),
          campaign: createCampaignSlice(set),
          ui: createUiSlice(set),
        })),
      ),
      {
        name: 'greensheet-store',
        version: 4,
        partialize: (s) => ({
          sourcing: {
            goal: s.sourcing.goal,
            budgetCeiling: s.sourcing.budgetCeiling,
            weights: s.sourcing.weights,
            sortOrder: s.sourcing.sortOrder,
            minCupScore: s.sourcing.minCupScore,
            showOverBudget: s.sourcing.showOverBudget,
          },
          ui: {
            theme: s.ui.theme,
          }
        }),
        merge: (persistedState: any, currentState: RootStore) => ({
          ...currentState,
          sourcing: {
            ...currentState.sourcing,
            ...(persistedState?.sourcing || {}),
          },
          ui: {
            ...currentState.ui,
            ...(persistedState?.ui || {}),
          },
        }),
      },
    ),
    { name: 'GreensheetStore' },
  ),
);

// Slice hooks (components never touch useRootStore directly)
export const useSourcing = () => useRootStore((s) => s.sourcing);
export const useSelection = () => useRootStore((s) => s.selection);
export const useCampaign = () => useRootStore((s) => s.campaign);
export const useUi = () => useRootStore((s) => s.ui);
