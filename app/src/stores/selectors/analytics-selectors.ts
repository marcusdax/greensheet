import { useMemo } from 'react';
import { useAnalytics, useCampaigns, useCatalog, useCrm, useOrders } from '../root-store';
import type {
  CampaignLiftRow,
  CacChannelRow,
  CoffeeLot,
  FunnelStage,
  HazardHeatmapRow,
  KFactorMetric,
  KitFunnelStage,
  Order,
  Roaster,
  ViralReferral,
  WtrPoint,
} from '../../types/api';

export interface CohortRow {
  name: string;
  size: number;
  values: (number | null)[];
}

export interface ScatterPoint {
  cac: number;
  ltv: number;
  name: string;
}

export interface InventoryPoint {
  date: string;
  actual?: number;
  forecast?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
}

export interface SurvivalPoint {
  week: number;
  survival: number;
  ciLow: number;
  ciHigh: number;
}

export interface ViralPoint {
  period: string;
  k: number;
  referrals: number;
  conversions: number;
}

export interface FunnelPoint {
  stage: string;
  count: number;
  conversionRate: number;
}

const DEFAULT_COHORT_ROWS: CohortRow[] = [
  { name: 'Jan 2025', size: 42, values: [100, 92, 88, 85, 82, 80] },
  { name: 'Feb 2025', size: 38, values: [100, 90, 85, 82, 79, null] },
  { name: 'Mar 2025', size: 45, values: [100, 95, 91, 88, null, null] },
  { name: 'Apr 2025', size: 31, values: [100, 88, 82, null, null, null] },
  { name: 'May 2025', size: 52, values: [100, 96, null, null, null, null] },
  { name: 'Jun 2025', size: 40, values: [100, null, null, null, null, null] },
];

const DEFAULT_SCATTER_DATA: ScatterPoint[] = [
  { cac: 100, ltv: 3000, name: 'Micro A' },
  { cac: 150, ltv: 5000, name: 'Micro B' },
  { cac: 250, ltv: 12000, name: 'Boutique A' },
  { cac: 300, ltv: 18000, name: 'Boutique B' },
  { cac: 400, ltv: 24500, name: 'Coava' },
  { cac: 600, ltv: 55000, name: 'Commercial A' },
  { cac: 850, ltv: 124500, name: 'Blue Bottle' },
];

const DEFAULT_INVENTORY_DATA: InventoryPoint[] = [
  { date: '06-01', actual: 4500 },
  { date: '06-08', actual: 3800 },
  { date: '06-15', actual: 3200 },
  { date: '06-22', actual: 2600 },
  { date: '06-29', actual: 2100 },
  { date: '07-06', forecast: 1600, confidenceLow: 1200, confidenceHigh: 2000 },
  { date: '07-13', forecast: 1100, confidenceLow: 700, confidenceHigh: 1500 },
  { date: '07-20', forecast: 800, confidenceLow: 400, confidenceHigh: 1200 },
  { date: '07-27', forecast: 600, confidenceLow: 200, confidenceHigh: 1000 },
];

const DEFAULT_SURVIVAL_DATA: SurvivalPoint[] = [
  { week: 0, survival: 100, ciLow: 100, ciHigh: 100 },
  { week: 4, survival: 95, ciLow: 92, ciHigh: 98 },
  { week: 8, survival: 91, ciLow: 87, ciHigh: 95 },
  { week: 12, survival: 88, ciLow: 83, ciHigh: 92 },
  { week: 16, survival: 82, ciLow: 76, ciHigh: 88 },
  { week: 20, survival: 79, ciLow: 72, ciHigh: 85 },
  { week: 24, survival: 75, ciLow: 67, ciHigh: 82 },
];

const DEFAULT_VIRAL_DATA: ViralPoint[] = [
  { period: '2025-06', k: 0.33, referrals: 12, conversions: 4 },
];

const DEFAULT_FUNNEL_DATA: FunnelPoint[] = [
  { stage: 'Awareness', count: 5000, conversionRate: 100 },
  { stage: 'Consideration', count: 1250, conversionRate: 25 },
  { stage: 'Purchase', count: 150, conversionRate: 12 },
];

function formatMonthDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function round(value: number): number {
  return Math.max(0, Math.round(value));
}

function cohortLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function deriveCohortRows(orders: Order[]): CohortRow[] {
  if (orders.length === 0) return DEFAULT_COHORT_ROWS;

  const accountHistory = new Map<
    string,
    { first: Date; orders: Date[] }
  >();

  for (const order of orders) {
    const date = new Date(order.createdAt);
    const history = accountHistory.get(order.accountId) ?? {
      first: date,
      orders: [],
    };
    if (date < history.first) history.first = date;
    history.orders.push(date);
    accountHistory.set(order.accountId, history);
  }

  type Cohort = {
    start: Date;
    label: string;
    size: number;
    weeklyActive: Map<number, Set<string>>;
  };

  const cohortMap = new Map<string, Cohort>();

  for (const [accountId, { first, orders: dates }] of accountHistory) {
    const start = new Date(first.getFullYear(), first.getMonth(), 1);
    const label = cohortLabel(start);
    const cohort = cohortMap.get(label) ?? {
      start,
      label,
      size: 0,
      weeklyActive: new Map(),
    };
    cohort.size += 1;

    for (const date of dates) {
      const days = Math.floor(
        (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      const week = Math.floor(days / 7);
      const active = cohort.weeklyActive.get(week) ?? new Set<string>();
      active.add(accountId);
      cohort.weeklyActive.set(week, active);
    }

    cohortMap.set(label, cohort);
  }

  const cohorts = Array.from(cohortMap.values()).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  return cohorts.slice(-6).map((cohort) => {
    const values: (number | null)[] = [100];
    for (let week = 1; week < 6; week++) {
      const active = cohort.weeklyActive.get(week);
      if (!active || active.size === 0) {
        values.push(null);
      } else {
        values.push(round((active.size / cohort.size) * 100));
      }
    }
    return { name: cohort.label, size: cohort.size, values };
  });
}

export function deriveScatterData(roasters: Roaster[]): ScatterPoint[] {
  const valid = roasters.filter(
    (r) =>
      r.cacCents != null &&
      r.cacCents > 0 &&
      r.ltvCents != null &&
      r.ltvCents > 0,
  );

  if (valid.length === 0) return DEFAULT_SCATTER_DATA;

  return valid
    .map((r) => ({
      cac: r.cacCents! / 100,
      ltv: r.ltvCents! / 100,
      name: r.roasterName,
    }))
    .sort((a, b) => a.cac - b.cac);
}

export function deriveSurvivalCurve(riskScores: number[]): SurvivalPoint[] {
  const valid = riskScores.filter((s) => s >= 0 && s <= 1);
  if (valid.length === 0) return DEFAULT_SURVIVAL_DATA;

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const min = Math.min(...valid);
  const max = Math.max(...valid);

  const points: SurvivalPoint[] = [];
  for (let week = 0; week <= 24; week += 4) {
    const survival = 100 * Math.pow(1 - mean, week / 52);
    const ciLow = 100 * Math.pow(1 - max, week / 52);
    const ciHigh = 100 * Math.pow(1 - min, week / 52);
    points.push({
      week,
      survival: round(survival),
      ciLow: round(ciLow),
      ciHigh: round(ciHigh),
    });
  }
  return points;
}

export function deriveInventoryForecast(
  lots: CoffeeLot[],
  referenceDate?: Date,
): InventoryPoint[] {
  if (lots.length === 0) return DEFAULT_INVENTORY_DATA;

  const now = referenceDate ?? new Date();
  const available = lots.reduce((sum, lot) => sum + lot.availableQuantityLbs, 0);
  const production = lots.reduce((sum, lot) => sum + lot.totalProductionLbs, 0);
  const consumed = Math.max(0, production - available);
  const weeklyDepletion = consumed > 0 ? consumed / 5 : available * 0.05;
  const startInventory = Math.min(production, available + 5 * weeklyDepletion);

  const points: InventoryPoint[] = [];

  for (let i = 0; i < 5; i++) {
    const value = round(
      startInventory - (i * (startInventory - available)) / 4,
    );
    points.push({
      date: formatMonthDay(addDays(now, (i - 5) * 7)),
      actual: value,
    });
  }

  for (let i = 1; i <= 4; i++) {
    const base = available - weeklyDepletion * i;
    points.push({
      date: formatMonthDay(addDays(now, i * 7)),
      forecast: round(base),
      confidenceLow: round(base - weeklyDepletion * i * 0.3),
      confidenceHigh: round(base + weeklyDepletion * i * 0.3),
    });
  }

  return points;
}

export function deriveViralCoefficient(
  referrals: ViralReferral[],
): ViralPoint[] {
  if (referrals.length === 0) return DEFAULT_VIRAL_DATA;

  return referrals
    .map((r) => {
      const count = r.referrals ?? 0;
      const conversions = r.conversions ?? 0;
      return {
        period: r.period ?? 'unknown',
        k: count > 0 ? Math.round((conversions / count) * 100) / 100 : 0,
        referrals: count,
        conversions,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

export function deriveCampaignFunnel(
  funnelStages: FunnelStage[],
): FunnelPoint[] {
  if (funnelStages.length === 0) return DEFAULT_FUNNEL_DATA;

  const stages = funnelStages.map((stage) => ({
    stage: stage.stage,
    count: stage.count ?? 0,
  }));

  return stages.map((stage, index) => {
    const previous = index > 0 ? stages[index - 1].count : stage.count;
    const rate =
      previous > 0 ? Math.round((stage.count / previous) * 1000) / 10 : 0;
    return {
      stage: stage.stage,
      count: stage.count,
      conversionRate: rate,
    };
  });
}

export function useAnalyticsCharts() {
  const analytics = useAnalytics();
  const crm = useCrm();
  const orders = useOrders();
  const campaigns = useCampaigns();
  const catalog = useCatalog();

  return useMemo(
    () => ({
      cohortRows: deriveCohortRows(orders.orders),
      scatterData: deriveScatterData(crm.roasters),
      survivalData: deriveSurvivalCurve(
        crm.roasters
          .map((r) => r.churnRiskScore)
          .filter((score): score is number => score != null),
      ),
      inventoryData: deriveInventoryForecast(catalog.lots),
      viralData: deriveViralCoefficient(analytics.viralReferrals),
      funnelData: deriveCampaignFunnel(analytics.funnelStages),
      loading:
        analytics.loading ||
        crm.loading ||
        orders.loading ||
        campaigns.loading ||
        catalog.loading,
    }),
    [analytics, crm, orders, campaigns, catalog],
  );
}

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

export interface GrowthMetrics {
  wtrPoints: WtrPoint[];
  kitFunnel: GrowthFunnelPoint[];
  cacByChannel: CacChannelRow[];
  cacCeiling: number;
  hazardHeatmap: HazardHeatmapRow[];
  kFactor: GrowthKFactorPoint;
  campaignLift: GrowthCampaignLiftPoint[];
  loading: boolean;
}

export function useGrowthMetrics(): GrowthMetrics {
  const analytics = useAnalytics();

  return useMemo(
    () => ({
      wtrPoints: analytics.wtrPoints,
      kitFunnel: deriveGrowthFunnel(analytics.kitFunnelStages),
      cacByChannel: analytics.cacByChannel,
      cacCeiling: analytics.cacCeiling,
      hazardHeatmap: analytics.hazardHeatmap,
      kFactor: deriveKFactor(analytics.kFactor),
      campaignLift: deriveCampaignLift(analytics.campaignLift),
      loading: analytics.loading,
    }),
    [analytics],
  );
}
