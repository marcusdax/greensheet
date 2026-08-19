# Growth Dashboard Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/growth` route with six hardcoded mock-analytics widgets that surface the metrics defined in `marketing/01-growth-architecture.md` §7.3.

**Architecture:** Extend the existing analytics API/slice/selector pattern with new growth-specific mock endpoints, then build a dedicated `GrowthPage` and reusable `components/growth/*` widgets. Keep all data mocked in `api/client.ts` so the page works without a backend. Follow the existing Tailwind/Recharts styling used on `AnalyticsPage`.

**Tech Stack:** React + TypeScript, Zustand (immer/devtools/persist), Recharts, react-i18next, Tailwind CSS, Vitest + React Testing Library.

## Global Constraints

- All new API shapes live in `app/src/types/api.ts` and are re-exported from `app/src/api/client.ts` mocks.
- Hardcoded mock values must match the exact figures from `marketing/01-growth-architecture.md` §7.3 and §11.2:
  - Kit funnel: `Kit Sent = 1000 → Delivered = 920 → Feedback = 414 → First Order = 166`.
  - CAC ceiling: `$500`.
  - K-factor: current `0.58`, target `0.6`.
- Widgets are read-only and do not mutate store state outside their own slice.
- New UI strings must be added to `localization/02-locale-files/en-US.json` under `growth.*`; sibling locale files (zh-CN, es-MX, pt-BR) receive English fallbacks via i18next.
- The new route uses the existing `/:locale/*` routing pattern and the sidebar is updated under the **INTELLIGENCE** group.
- `App.test.tsx` asserts the exact sidebar links; adding the new nav item requires updating that assertion.
- Each task ends with a commit and a green test run covering the changed code.

---

## File Map

| File | Responsibility |
|---|---|
| `app/src/types/api.ts` | New growth data types: `WtrPoint`, `KitFunnelStage`, `CacChannelRow`, `HazardHeatmapRow`, `KFactorMetric`, `CampaignLiftRow`. |
| `app/src/api/client.ts` | Six new mock analytics endpoints returning the shapes above. |
| `app/src/stores/slices/analytics-slice.ts` | State fields and loaders for the six new growth endpoints plus a `loadGrowthAll` aggregator. |
| `app/src/stores/selectors/analytics-selectors.ts` | `useGrowthMetrics()` hook deriving chart-ready objects from store state. |
| `app/src/components/growth/WtrChart.tsx` | Weekly Transacting Roasters timeseries with 4-week moving average. |
| `app/src/components/growth/KitFunnelChart.tsx` | Funnel bars for `Kit Sent → Delivered → Feedback → First Order`. |
| `app/src/components/growth/CacByChannelChart.tsx` | Stacked bar per channel with a `$500` reference line. |
| `app/src/components/growth/HazardHeatmap.tsx` | 3×3 grid: churn tier (T1/T2/T3) × segment (micro/boutique/commercial). |
| `app/src/components/growth/KFactorGauge.tsx` | Gauge showing `0.58` vs target `0.6`. |
| `app/src/components/growth/CampaignLiftChart.tsx` | Bar chart of per-campaign Bayesian posterior probability vs. control. |
| `app/src/components/growth/index.ts` | Barrel export for the six widget components. |
| `app/src/pages/GrowthPage.tsx` | Page shell, `useGrowthMetrics` consumer, six-widget grid. |
| `app/src/App.tsx` | Add `Route path="growth"`. |
| `app/src/components/AppLayout.tsx` | Add `growth` to INTELLIGENCE sidebar group. |
| `app/src/pages/__tests__/GrowthPage.test.tsx` | Page renders each widget title and loads data. |
| `localization/02-locale-files/en-US.json` | `common.nav.growth`, `growth.*` keys. |

---

## Task 1: Add API Types and Analytics Endpoints

**Files:**
- Modify: `app/src/types/api.ts`
- Modify: `app/src/api/client.ts`
- Test: existing `app/src/api/__tests__/client.test.ts` (if it exists; otherwise create `app/src/api/__tests__/analytics.test.ts`)

**Interfaces:**
- Consumes: existing `ApiResult<T>`, `Problem`.
- Produces:
  - `WtrPoint { week: string; wtr: number; movingAverage?: number }`
  - `KitFunnelStage { stage: 'sent' | 'delivered' | 'feedback' | 'first_order'; count: number; conversionRate?: number }`
  - `CacChannelRow { channel: string; cac: number; spend: number; newAccounts: number }`
  - `HazardHeatmapRow { segment: Segment; tier: 'T1' | 'T2' | 'T3'; count: number; avgHazard: number }`
  - `KFactorMetric { current: number; target: number; period: string }`
  - `CampaignLiftRow { campaignId: string; campaignName: string; lift: number; probability: number; isSignificant: boolean }`

- [ ] **Step 1: Add types to `app/src/types/api.ts`**

Append after the existing analytics types (`Forecast`). Use exact property names and types.

```ts
export interface WtrPoint {
  week: string;
  wtr: number;
  movingAverage?: number;
}

export interface KitFunnelStage {
  stage: 'sent' | 'delivered' | 'feedback' | 'first_order';
  count: number;
  conversionRate?: number;
}

export interface CacChannelRow {
  channel: string;
  cac: number;
  spend: number;
  newAccounts: number;
}

export interface HazardHeatmapRow {
  segment: Segment;
  tier: 'T1' | 'T2' | 'T3';
  count: number;
  avgHazard: number;
}

export interface KFactorMetric {
  current: number;
  target: number;
  period: string;
}

export interface CampaignLiftRow {
  campaignId: string;
  campaignName: string;
  lift: number;
  probability: number;
  isSignificant: boolean;
}
```

- [ ] **Step 2: Add mock endpoints to `app/src/api/client.ts`**

Inside the existing `analytics:` object, add six functions. Use the hardcoded values below.

```ts
wtr: async (): Promise<ApiResult<{ points: WtrPoint[] }>> => {
  return {
    data: {
      points: [
        { week: '2025-W18', wtr: 142, movingAverage: 138 },
        { week: '2025-W19', wtr: 148, movingAverage: 142 },
        { week: '2025-W20', wtr: 155, movingAverage: 146 },
        { week: '2025-W21', wtr: 151, movingAverage: 150 },
        { week: '2025-W22', wtr: 162, movingAverage: 154 },
        { week: '2025-W23', wtr: 168, movingAverage: 160 },
        { week: '2025-W24', wtr: 175, movingAverage: 165 },
        { week: '2025-W25', wtr: 171, movingAverage: 169 },
      ],
    },
  };
},
kitFunnel: async (): Promise<ApiResult<{ stages: KitFunnelStage[] }>> => {
  return {
    data: {
      stages: [
        { stage: 'sent', count: 1000, conversionRate: 100 },
        { stage: 'delivered', count: 920, conversionRate: 92 },
        { stage: 'feedback', count: 414, conversionRate: 45 },
        { stage: 'first_order', count: 166, conversionRate: 40 },
      ],
    },
  };
},
cacByChannel: async (): Promise<ApiResult<{ channels: CacChannelRow[] }>> => {
  return {
    data: {
      channels: [
        { channel: 'Sample-kit program', cac: 210, spend: 126_000, newAccounts: 600 },
        { channel: 'Community & referral', cac: 95, spend: 19_000, newAccounts: 200 },
        { channel: 'Content/SEO + video', cac: 175, spend: 52_500, newAccounts: 300 },
        { channel: 'LinkedIn + trade pubs', cac: 380, spend: 57_000, newAccounts: 150 },
        { channel: 'Trade shows / events', cac: 420, spend: 42_000, newAccounts: 100 },
        { channel: 'Lifecycle / email-SMS', cac: 130, spend: 13_000, newAccounts: 100 },
        { channel: 'Partnerships', cac: 150, spend: 22_500, newAccounts: 150 },
      ],
    },
  };
},
hazardHeatmap: async (): Promise<ApiResult<{ rows: HazardHeatmapRow[] }>> => {
  return {
    data: {
      rows: [
        { segment: 'micro', tier: 'T1', count: 45, avgHazard: 0.22 },
        { segment: 'micro', tier: 'T2', count: 32, avgHazard: 0.51 },
        { segment: 'micro', tier: 'T3', count: 18, avgHazard: 0.78 },
        { segment: 'boutique', tier: 'T1', count: 28, avgHazard: 0.18 },
        { segment: 'boutique', tier: 'T2', count: 19, avgHazard: 0.47 },
        { segment: 'boutique', tier: 'T3', count: 8, avgHazard: 0.81 },
        { segment: 'commercial', tier: 'T1', count: 14, avgHazard: 0.15 },
        { segment: 'commercial', tier: 'T2', count: 9, avgHazard: 0.44 },
        { segment: 'commercial', tier: 'T3', count: 3, avgHazard: 0.73 },
      ],
    },
  };
},
kFactor: async (): Promise<ApiResult<{ metric: KFactorMetric }>> => {
  return {
    data: {
      metric: { current: 0.58, target: 0.6, period: '2025-06' },
    },
  };
},
campaignLift: async (): Promise<ApiResult<{ campaigns: CampaignLiftRow[] }>> => {
  return {
    data: {
      campaigns: [
        { campaignId: 'cof-001', campaignName: 'COF-001 Welcome', lift: 0.12, probability: 0.97, isSignificant: true },
        { campaignId: 'cof-002', campaignName: 'COF-002 Feedback', lift: 0.08, probability: 0.91, isSignificant: false },
        { campaignId: 'cof-003', campaignName: 'COF-003 First Order', lift: 0.18, probability: 0.99, isSignificant: true },
        { campaignId: 'cof-004', campaignName: 'COF-004 Reorder', lift: 0.05, probability: 0.88, isSignificant: false },
        { campaignId: 'cof-005', campaignName: 'COF-005 Win-back', lift: 0.22, probability: 0.96, isSignificant: true },
      ],
    },
  };
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`  
Expected: no errors.

- [ ] **Step 4: Add a minimal API test (if test file exists; otherwise create it)**

In `app/src/api/__tests__/client.test.ts` (create if missing):

```ts
import { describe, it, expect } from 'vitest';
import { api } from '../client';

describe('analytics growth endpoints', () => {
  it('returns kit funnel with 1000 sent and 166 first orders', async () => {
    const res = await api.analytics.kitFunnel();
    expect('data' in res).toBe(true);
    const stages = 'data' in res ? res.data.stages : [];
    expect(stages[0]).toMatchObject({ stage: 'sent', count: 1000 });
    expect(stages[3]).toMatchObject({ stage: 'first_order', count: 166 });
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd app && npm run test:run src/api/__tests__/client.test.ts`  
Expected: tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/types/api.ts app/src/api/client.ts app/src/api/__tests__/client.test.ts
git commit -m "feat(growth): add growth analytics types and mock endpoints"
```

---

## Task 2: Extend Analytics Slice with Growth Loaders

**Files:**
- Modify: `app/src/stores/slices/analytics-slice.ts`

**Interfaces:**
- Consumes: new types from Task 1, existing `api.analytics.*`.
- Produces: six new state fields and six new loader actions plus `loadGrowthAll`.

- [ ] **Step 1: Extend `AnalyticsState`**

Add after `forecast: Forecast[];`:

```ts
wtrPoints: WtrPoint[];
kitFunnelStages: KitFunnelStage[];
cacByChannel: CacChannelRow[];
hazardHeatmap: HazardHeatmapRow[];
kFactor: KFactorMetric | null;
campaignLift: CampaignLiftRow[];
```

- [ ] **Step 2: Extend `AnalyticsActions`**

Add after `loadAll`:

```ts
loadWtr: () => Promise<void>;
loadKitFunnel: () => Promise<void>;
loadCacByChannel: () => Promise<void>;
loadHazardHeatmap: () => Promise<void>;
loadKFactor: () => Promise<void>;
loadCampaignLift: () => Promise<void>;
loadGrowthAll: () => Promise<void>;
```

- [ ] **Step 3: Extend `initialAnalyticsState`**

Add default values:

```ts
wtrPoints: [],
kitFunnelStages: [],
cacByChannel: [],
hazardHeatmap: [],
kFactor: null,
campaignLift: [],
```

- [ ] **Step 4: Add loader actions and aggregator in `createAnalyticsSlice`**

Follow the existing `loadCohorts` pattern for each of:
- `loadWtr` → `api.analytics.wtr()` → `s.analytics.wtrPoints`
- `loadKitFunnel` → `api.analytics.kitFunnel()` → `s.analytics.kitFunnelStages`
- `loadCacByChannel` → `api.analytics.cacByChannel()` → `s.analytics.cacByChannel`
- `loadHazardHeatmap` → `api.analytics.hazardHeatmap()` → `s.analytics.hazardHeatmap`
- `loadKFactor` → `api.analytics.kFactor()` → `s.analytics.kFactor`
- `loadCampaignLift` → `api.analytics.campaignLift()` → `s.analytics.campaignLift`

`loadGrowthAll` calls all six endpoints in `Promise.all` and assigns the same way `loadAll` does.

- [ ] **Step 5: Run slice tests**

Run: `cd app && npm run test:run src/stores/slices/__tests__/analytics-slice.test.ts` (create the test file if it does not exist).  
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/stores/slices/analytics-slice.ts app/src/stores/slices/__tests__/analytics-slice.test.ts
git commit -m "feat(growth): extend analytics slice with growth loaders"
```

---

## Task 3: Add `useGrowthMetrics` Hook

**Files:**
- Modify: `app/src/stores/selectors/analytics-selectors.ts`
- Test: `app/src/stores/selectors/__tests__/analytics-selectors.test.ts` (create if missing)

**Interfaces:**
- Consumes: `useAnalytics()` store state fields from Task 2.
- Produces: chart-ready arrays and the `loading` flag.

- [ ] **Step 1: Add derived interfaces**

Append to `analytics-selectors.ts`:

```ts
export interface GrowthFunnelPoint {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface GrowthKFactorPoint {
  current: number;
  target: number;
  gap: number;
}

export interface GrowthCampaignLiftPoint {
  campaignName: string;
  lift: number;
  probability: number;
  isSignificant: boolean;
}
```

- [ ] **Step 2: Add `deriveGrowthFunnel`, `deriveKFactor`, `deriveCampaignLift`**

```ts
export function deriveGrowthFunnel(stages: KitFunnelStage[]): GrowthFunnelPoint[] {
  if (stages.length === 0) {
    return [
      { stage: 'Kit Sent', count: 1000, conversionRate: 100 },
      { stage: 'Delivered', count: 920, conversionRate: 92 },
      { stage: 'Feedback', count: 414, conversionRate: 45 },
      { stage: 'First Order', count: 166, conversionRate: 40 },
    ];
  }
  return stages.map((s, i) => ({
    stage: s.stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    count: s.count,
    conversionRate: s.conversionRate ?? (i === 0 ? 100 : Math.round((s.count / stages[i - 1].count) * 1000) / 10),
  }));
}

export function deriveKFactor(metric: KFactorMetric | null): GrowthKFactorPoint {
  if (!metric) return { current: 0.58, target: 0.6, gap: 0.02 };
  return {
    current: metric.current,
    target: metric.target,
    gap: Math.round((metric.target - metric.current) * 100) / 100,
  };
}

export function deriveCampaignLift(campaigns: CampaignLiftRow[]): GrowthCampaignLiftPoint[] {
  if (campaigns.length === 0) {
    return [
      { campaignName: 'COF-001 Welcome', lift: 0.12, probability: 0.97, isSignificant: true },
      { campaignName: 'COF-002 Feedback', lift: 0.08, probability: 0.91, isSignificant: false },
      { campaignName: 'COF-003 First Order', lift: 0.18, probability: 0.99, isSignificant: true },
      { campaignName: 'COF-004 Reorder', lift: 0.05, probability: 0.88, isSignificant: false },
      { campaignName: 'COF-005 Win-back', lift: 0.22, probability: 0.96, isSignificant: true },
    ];
  }
  return campaigns;
}
```

- [ ] **Step 3: Add `useGrowthMetrics` hook**

```ts
export function useGrowthMetrics() {
  const analytics = useAnalytics();

  return useMemo(
    () => ({
      wtrPoints: analytics.wtrPoints,
      kitFunnel: deriveGrowthFunnel(analytics.kitFunnelStages),
      cacByChannel: analytics.cacByChannel,
      hazardHeatmap: analytics.hazardHeatmap,
      kFactor: deriveKFactor(analytics.kFactor),
      campaignLift: deriveCampaignLift(analytics.campaignLift),
      loading: analytics.loading,
    }),
    [analytics],
  );
}
```

- [ ] **Step 4: Add selector tests**

Create/update `app/src/stores/selectors/__tests__/analytics-selectors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveGrowthFunnel, deriveKFactor, deriveCampaignLift } from '../analytics-selectors';

describe('growth selectors', () => {
  it('formats kit funnel stages', () => {
    const stages = [
      { stage: 'sent' as const, count: 1000, conversionRate: 100 },
      { stage: 'delivered' as const, count: 920, conversionRate: 92 },
      { stage: 'feedback' as const, count: 414, conversionRate: 45 },
      { stage: 'first_order' as const, count: 166, conversionRate: 40 },
    ];
    const result = deriveGrowthFunnel(stages);
    expect(result[3].stage).toBe('First Order');
    expect(result[3].count).toBe(166);
  });

  it('falls back to hardcoded k-factor when metric is null', () => {
    expect(deriveKFactor(null)).toEqual({ current: 0.58, target: 0.6, gap: 0.02 });
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd app && npm run test:run src/stores/selectors/__tests__/analytics-selectors.test.ts`  
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/stores/selectors/analytics-selectors.ts app/src/stores/selectors/__tests__/analytics-selectors.test.ts
git commit -m "feat(growth): add useGrowthMetrics selector hook"
```

---

## Task 4: Create Growth Widget Components

**Files:**
- Create: `app/src/components/growth/WtrChart.tsx`
- Create: `app/src/components/growth/KitFunnelChart.tsx`
- Create: `app/src/components/growth/CacByChannelChart.tsx`
- Create: `app/src/components/growth/HazardHeatmap.tsx`
- Create: `app/src/components/growth/KFactorGauge.tsx`
- Create: `app/src/components/growth/CampaignLiftChart.tsx`
- Create: `app/src/components/growth/index.ts`
- Test: `app/src/components/growth/__tests__/growth-widgets.test.tsx`

**Interfaces:**
- Consumes: chart-ready objects from `useGrowthMetrics` (Task 3).
- Produces: six reusable widgets that accept props only from the derived data.

- [ ] **Step 1: Create `WtrChart.tsx`**

Use `ComposedChart` with two `Line` elements: `wtr` (teal) and `movingAverage` (gold dashed). X-axis `week`, Y-axis begins at 0.

- [ ] **Step 2: Create `KitFunnelChart.tsx`**

Use `BarChart` with one `Bar` colored by stage. Display conversion rate labels above bars.

- [ ] **Step 3: Create `CacByChannelChart.tsx`**

Use a simple horizontal `BarChart` (`layout="vertical"`) with channel names on the Y-axis. Add a `ReferenceLine` driven by a `ceiling` prop (defaulting to `500`) labeled with the current ceiling value. Note: the source marketing spec `marketing/01-growth-architecture.md` §7.3 calls this a "stacked bar", but the mock data shape does not define meaningful stack segments, so the MVP deliberately ships a simple horizontal bar.

- [ ] **Step 4: Create `HazardHeatmap.tsx`**

Render a 3×3 HTML table: rows = tiers (T3, T2, T1), columns = segments (micro, boutique, commercial). Color intensity from `avgHazard`. Use thresholds: `< 0.3` leaf green, `< 0.7` gold, `≥ 0.7` danger red.

- [ ] **Step 5: Create `KFactorGauge.tsx`**

Render a radial progress indicator or a simple labeled bar showing `current / target`. Display `0.58` with target `0.6` and gap.

- [ ] **Step 6: Create `CampaignLiftChart.tsx`**

Use `BarChart` with campaign names on X-axis and `probability` on Y-axis. Color bars by `isSignificant` (gold = significant, gray = not). Add `ReferenceLine` at `y={0.95}` for the 95% threshold.

- [ ] **Step 7: Create barrel `index.ts`**

```ts
export { WtrChart } from './WtrChart';
export { KitFunnelChart } from './KitFunnelChart';
export { CacByChannelChart } from './CacByChannelChart';
export { HazardHeatmap } from './HazardHeatmap';
export { KFactorGauge } from './KFactorGauge';
export { CampaignLiftChart } from './CampaignLiftChart';
```

- [ ] **Step 8: Add widget tests**

Test that each widget renders its title and the hardcoded key value. Use React Testing Library.

- [ ] **Step 9: Run tests**

Run: `cd app && npm run test:run src/components/growth/__tests__/growth-widgets.test.tsx`  
Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add app/src/components/growth
git commit -m "feat(growth): add six growth dashboard widgets"
```

---

## Task 5: Create GrowthPage, Route, and Navigation

**Files:**
- Create: `app/src/pages/GrowthPage.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/AppLayout.tsx`
- Modify: `localization/02-locale-files/en-US.json`
- Test: `app/src/pages/__tests__/GrowthPage.test.tsx`
- Test: update `app/src/App.test.tsx`

**Interfaces:**
- Consumes: `useGrowthMetrics()` from Task 3 and the six widget components from Task 4.
- Produces: a new `/growth` route and sidebar nav item.

- [ ] **Step 1: Add locale strings**

In `localization/02-locale-files/en-US.json`:

```json
{
  "common": {
    "nav": {
      "growth": "Growth"
    }
  },
  "growth": {
    "overline": "GROWTH INTELLIGENCE",
    "title": "Growth Dashboard",
    "subtitle": "Weekly transacting roasters, kit funnel, CAC by channel, churn hazard, K-factor, and campaign lift.",
    "wtr": { "title": "Weekly Transacting Roasters", "description": "Trailing 7-day active roasters with 4-week moving average" },
    "kitFunnel": { "title": "Kit Funnel", "description": "Kit Sent → Delivered → Feedback → First Order" },
    "cacByChannel": { "title": "CAC by Channel", "description": "Blended customer acquisition cost vs. $500 ceiling" },
    "hazardHeatmap": { "title": "Churn Hazard Heatmap", "description": "Accounts by churn tier and segment" },
    "kFactor": { "title": "K-Factor", "description": "Viral referral coefficient vs. 0.6 target" },
    "campaignLift": { "title": "Campaign Lift", "description": "Bayesian posterior probability vs. control" }
  }
}
```

Merge carefully into existing JSON structure.

- [ ] **Step 2: Update `AppLayout.tsx` sidebar**

Add `{ path: 'growth', label: t('nav.growth', 'Growth'), icon: TrendingUp }` to the INTELLIGENCE group. Import `TrendingUp` from `lucide-react`.

- [ ] **Step 3: Update `App.tsx`**

Import `GrowthPage` and add `<Route path="growth" element={<GrowthPage />} />` before the fallback routes.

- [ ] **Step 4: Create `GrowthPage.tsx`**

Structure:

```tsx
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { useAnalytics } from '../stores/root-store';
import { useGrowthMetrics } from '../stores/selectors/analytics-selectors';
import {
  WtrChart,
  KitFunnelChart,
  CacByChannelChart,
  HazardHeatmap,
  KFactorGauge,
  CampaignLiftChart,
} from '../components/growth';

export const GrowthPage: React.FC = () => {
  const { t } = useTranslation(['growth', 'common']);
  const { loadGrowthAll } = useAnalytics();
  const { wtrPoints, kitFunnel, cacByChannel, hazardHeatmap, kFactor, campaignLift, loading } = useGrowthMetrics();

  useEffect(() => {
    void loadGrowthAll();
  }, [loadGrowthAll]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <span className="overline text-xs text-muted tracking-wider">{t('growth:overline')}</span>
          <h1 className="text-3xl font-display font-medium text-ink">{t('growth:title')}</h1>
          <p className="text-sm text-muted font-sans max-w-2xl">{t('growth:subtitle')}</p>
        </div>
        <button onClick={() => void loadGrowthAll()} disabled={loading} className="...">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common:actions.refresh')}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WtrChart data={wtrPoints} title={t('growth:wtr.title')} description={t('growth:wtr.description')} />
        <KitFunnelChart data={kitFunnel} title={t('growth:kitFunnel.title')} description={t('growth:kitFunnel.description')} />
        <CacByChannelChart data={cacByChannel} title={t('growth:cacByChannel.title')} description={t('growth:cacByChannel.description')} />
        <HazardHeatmap data={hazardHeatmap} title={t('growth:hazardHeatmap.title')} description={t('growth:hazardHeatmap.description')} />
        <KFactorGauge data={kFactor} title={t('growth:kFactor.title')} description={t('growth:kFactor.description')} />
        <CampaignLiftChart data={campaignLift} title={t('growth:campaignLift.title')} description={t('growth:campaignLift.description')} />
      </div>
    </div>
  );
};
```

Use card wrapper styles matching `AnalyticsPage` (`bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4`).

- [ ] **Step 5: Update `App.test.tsx`**

Find the assertion that lists nav links and add `'Growth'` to the expected list.

- [ ] **Step 6: Add `GrowthPage.test.tsx`**

Render `GrowthPage` inside the test providers (wrap with `MemoryRouter` initial entry `en-US/growth` and i18n). Assert:
- The page title "Growth Dashboard" appears.
- Each widget title appears.
- The refresh button is present.

- [ ] **Step 7: Run tests**

Run: `cd app && npm run test:run src/pages/__tests__/GrowthPage.test.tsx src/App.test.tsx`  
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add app/src/pages/GrowthPage.tsx app/src/App.tsx app/src/components/AppLayout.tsx localization/02-locale-files/en-US.json app/src/pages/__tests__/GrowthPage.test.tsx app/src/App.test.tsx
git commit -m "feat(growth): add GrowthPage, route, nav, and tests"
```

---

## Task 6: Add Tests

This task is a quality sweep rather than a new file. It catches any coverage gaps after integration.

- [ ] **Step 1: Run the full test suite**

Run: `cd app && npm run test:run`  
Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run: `cd app && npm run lint`  
Expected: no errors.

- [ ] **Step 3: Run TypeScript check**

Run: `cd app && npx tsc --noEmit`  
Expected: no errors.

- [ ] **Step 4: Fix any failures**

If failures exist, dispatch a fix subagent or fix inline. Re-run the failing command until green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(growth): full test suite green for growth dashboard"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run full verification command**

Run:

```bash
cd app && npm run test:run && npm run lint && npx tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify the route renders in dev**

Run: `cd app && npm run docker:dev` (or `npm run dev` if Docker is not running).  
Open `http://localhost:5173/en-US/growth` and confirm all six widgets render with the hardcoded values.

- [ ] **Step 3: Commit any last fixes**

If no fixes, skip.

---

## Self-Review

1. **Spec coverage:** §7.3 widgets (a)–(f) map 1:1 to Tasks 4–5. §11.2 mock values are hardcoded in Task 1. Navigation under INTELLIGENCE is Task 5. Pricing and strategy pages are intentionally out of scope for this sub-project.
2. **Placeholder scan:** No TBD/TODO placeholders. Mock values are explicit.
3. **Type consistency:** Types defined in Task 1 are used by Task 2 state and Task 3 selectors with identical property names.
4. **Testability:** Each task has a dedicated test step.
5. **Review gates:** Each task ends with a commit; per-task review via `superpowers:subagent-driven-development` is required.
