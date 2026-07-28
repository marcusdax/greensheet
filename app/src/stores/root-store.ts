import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createSourcingSlice, type SourcingSlice } from './slices/sourcing-slice';
import { createSelectionSlice, type SelectionSlice } from './slices/selection-slice';
import { createCampaignSlice, type CampaignSlice } from './slices/campaign-slice';
import { createUiSlice, type UiSlice } from './slices/ui-slice';
import { createCrmSlice, type CrmSlice, initialCrmState } from './slices/crm-slice';
import { createCampaignsSlice, type CampaignsSlice, initialCampaignsState } from './slices/campaigns-slice';
import { createCatalogSlice, type CatalogSlice, initialCatalogState } from './slices/catalog-slice';
import { createSamplesSlice, type SamplesSlice, initialSamplesState } from './slices/samples-slice';
import { createOrdersSlice, type OrdersSlice, initialOrdersState } from './slices/orders-slice';
import { createRulesSlice, type RulesSlice, initialRulesState } from './slices/rules-slice';
import { createWebhooksSlice, type WebhooksSlice, initialWebhooksState } from './slices/webhooks-slice';
import { createAnalyticsSlice, type AnalyticsSlice, initialAnalyticsState } from './slices/analytics-slice';

export type RootStore = {
  sourcing: SourcingSlice;
  selection: SelectionSlice;
  campaign: CampaignSlice;
  ui: UiSlice;
  crm: CrmSlice;
  campaigns: CampaignsSlice;
  catalog: CatalogSlice;
  samples: SamplesSlice;
  orders: OrdersSlice;
  rules: RulesSlice;
  webhooks: WebhooksSlice;
  analytics: AnalyticsSlice;
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
          crm: createCrmSlice(set),
          campaigns: createCampaignsSlice(set),
          catalog: createCatalogSlice(set),
          samples: createSamplesSlice(set),
          orders: createOrdersSlice(set),
          rules: createRulesSlice(set),
          webhooks: createWebhooksSlice(set),
          analytics: createAnalyticsSlice(set),
        })),
      ),
      {
        name: 'greensheet-store',
        version: 5,
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
          },
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
export const useCrm = () => useRootStore((s) => s.crm);
export const useCampaigns = () => useRootStore((s) => s.campaigns);
export const useCatalog = () => useRootStore((s) => s.catalog);
export const useSamples = () => useRootStore((s) => s.samples);
export const useOrders = () => useRootStore((s) => s.orders);
export const useRules = () => useRootStore((s) => s.rules);
export const useWebhooks = () => useRootStore((s) => s.webhooks);
export const useAnalytics = () => useRootStore((s) => s.analytics);

export function resetStore() {
  useRootStore.setState((state) => ({
    crm: { ...state.crm, ...initialCrmState },
    campaigns: { ...state.campaigns, ...initialCampaignsState },
    catalog: { ...state.catalog, ...initialCatalogState },
    samples: { ...state.samples, ...initialSamplesState },
    orders: { ...state.orders, ...initialOrdersState },
    rules: { ...state.rules, ...initialRulesState },
    webhooks: { ...state.webhooks, ...initialWebhooksState },
    analytics: { ...state.analytics, ...initialAnalyticsState },
  }));
}
