import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  deriveCampaignFunnel,
  deriveCampaignLift,
  deriveCohortRows,
  deriveGrowthFunnel,
  deriveInventoryForecast,
  deriveKFactor,
  deriveScatterData,
  deriveSurvivalCurve,
  deriveViralCoefficient,
  useGrowthMetrics,
} from '../analytics-selectors';
import { resetStore, useRootStore } from '../../root-store';
import type {
  CampaignLiftRow,
  CoffeeLot,
  FunnelStage,
  KFactorMetric,
  KitFunnelStage,
  Order,
  Roaster,
  ViralReferral,
} from '../../../types/api';

describe('analytics selectors', () => {
  it('derives non-empty cohort rows from orders', () => {
    const orders: Order[] = [
      {
        id: 'o_1',
        accountId: 'a_1',
        status: 'delivered',
        lineItems: [],
        finalTotalCents: 100_000,
        createdAt: '2025-01-05T00:00:00Z',
        updatedAt: '2025-01-05T00:00:00Z',
      },
      {
        id: 'o_2',
        accountId: 'a_1',
        status: 'delivered',
        lineItems: [],
        finalTotalCents: 50_000,
        createdAt: '2025-01-20T00:00:00Z',
        updatedAt: '2025-01-20T00:00:00Z',
      },
      {
        id: 'o_3',
        accountId: 'a_2',
        status: 'delivered',
        lineItems: [],
        finalTotalCents: 75_000,
        createdAt: '2025-01-12T00:00:00Z',
        updatedAt: '2025-01-12T00:00:00Z',
      },
      {
        id: 'o_4',
        accountId: 'a_3',
        status: 'delivered',
        lineItems: [],
        finalTotalCents: 30_000,
        createdAt: '2025-02-02T00:00:00Z',
        updatedAt: '2025-02-02T00:00:00Z',
      },
    ];

    const rows = deriveCohortRows(orders);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].values[0]).toBe(100);
    expect(rows[0].values.some((v) => v !== null)).toBe(true);
  });

  it('derives LTV:CAC scatter points from roasters', () => {
    const roasters: Roaster[] = [
      {
        id: 'r_1',
        roasterName: 'Blue Bottle',
        segment: 'commercial',
        status: 'active',
        churnRiskScore: 0.1,
        ltvCents: 1_000_000,
        cacCents: 50_000,
        paybackMonths: 4,
        daysSinceLastOrder: 5,
        totalRevenueCents: 1_000_000,
        totalOrders: 10,
        lastActivityAt: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        primaryContact: {
          fullName: 'A',
          email: 'a@example.com',
          marketingOptIn: true,
        },
        interventions: [],
      },
      {
        id: 'r_2',
        roasterName: 'Heart',
        segment: 'boutique',
        status: 'active',
        churnRiskScore: 0.3,
        ltvCents: 500_000,
        cacCents: 25_000,
        paybackMonths: 6,
        daysSinceLastOrder: 12,
        totalRevenueCents: 500_000,
        totalOrders: 5,
        lastActivityAt: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        primaryContact: {
          fullName: 'B',
          email: 'b@example.com',
          marketingOptIn: true,
        },
        interventions: [],
      },
    ];

    const points = deriveScatterData(roasters);

    expect(points.length).toBe(2);
    expect(points[0]).toMatchObject({ cac: 250, ltv: 5000, name: 'Heart' });
    expect(points[1]).toMatchObject({ cac: 500, ltv: 10000, name: 'Blue Bottle' });
  });

  it('derives churn survival curve from risk scores', () => {
    const curve = deriveSurvivalCurve([0.1, 0.3, 0.5]);

    expect(curve.length).toBeGreaterThan(0);
    expect(curve[0]).toMatchObject({ week: 0, survival: 100 });
    expect(curve[curve.length - 1].survival).toBeLessThan(100);
  });

  it('derives inventory forecast from lots', () => {
    const lots: CoffeeLot[] = [
      {
        id: 'lot_a',
        origin: 'Huila, Colombia',
        varietal: 'Pink Bourbon',
        processingMethod: 'washed',
        elevation: 1750,
        cupScore: 88,
        pricePerLbCents: 600,
        costPerLbCents: 400,
        availableQuantityLbs: 2000,
        totalProductionLbs: 5000,
        esgScore: 0.8,
        logisticsScore: 0.8,
        certifications: { fairTrade: false, organic: true, rainforestAlliance: false },
        flavorNotes: ['jasmine'],
        sensoryProfile: { acidity: 8, body: 7, sweetness: 8 },
        portOfOrigin: 'Buenaventura',
        estimatedArrival: '2025-07-12',
        status: 'active',
        lastUpdatedAt: '2025-01-01T00:00:00Z',
      },
    ];

    const forecast = deriveInventoryForecast(lots, new Date('2025-07-01T00:00:00Z'));

    expect(forecast.length).toBeGreaterThan(0);
    expect(forecast.some((p) => p.actual != null)).toBe(true);
    expect(forecast.some((p) => p.forecast != null)).toBe(true);
  });

  it('derives viral coefficient from referrals', () => {
    const referrals: ViralReferral[] = [
      { referrerId: 'r_1', referrals: 10, conversions: 3, revenueCents: 100_000, period: '2025-06' },
      { referrerId: 'r_2', referrals: 20, conversions: 8, revenueCents: 250_000, period: '2025-07' },
    ];

    const points = deriveViralCoefficient(referrals);

    expect(points.length).toBe(2);
    expect(points[0]).toMatchObject({ period: '2025-06', k: 0.3, referrals: 10, conversions: 3 });
    expect(points[1]).toMatchObject({ period: '2025-07', k: 0.4, referrals: 20, conversions: 8 });
  });

  it('derives campaign funnel from execution-stage data', () => {
    const stages: FunnelStage[] = [
      { stage: 'sent', count: 1000, conversionRate: 1 },
      { stage: 'opened', count: 400, conversionRate: 0.4 },
      { stage: 'clicked', count: 120, conversionRate: 0.3 },
      { stage: 'ordered', count: 36, conversionRate: 0.3 },
    ];

    const funnel = deriveCampaignFunnel(stages);

    expect(funnel.length).toBe(4);
    expect(funnel[0]).toMatchObject({ stage: 'sent', count: 1000, conversionRate: 100 });
    expect(funnel[3]).toMatchObject({ stage: 'ordered', count: 36 });
  });
});

describe('growth selectors', () => {
  it('formats kit funnel stages', () => {
    const stages: KitFunnelStage[] = [
      { stage: 'sent', count: 1000, conversionRate: 100 },
      { stage: 'delivered', count: 920, conversionRate: 92 },
      { stage: 'feedback', count: 414, conversionRate: 45 },
      { stage: 'first_order', count: 166, conversionRate: 40 },
    ];
    const result = deriveGrowthFunnel(stages);
    expect(result[3].stage).toBe('First Order');
    expect(result[3].count).toBe(166);
  });

  it('falls back to hardcoded kit funnel when stages are empty', () => {
    const result = deriveGrowthFunnel([]);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ stage: 'Kit Sent', count: 1000, conversionRate: 100 });
    expect(result[3]).toMatchObject({ stage: 'First Order', count: 166, conversionRate: 40 });
  });

  it('guards funnel conversion rate against a previous stage count of zero', () => {
    const stages: KitFunnelStage[] = [
      { stage: 'sent', count: 0, conversionRate: 100 },
      { stage: 'delivered', count: 0 },
      { stage: 'feedback', count: 5 },
    ];

    const result = deriveGrowthFunnel(stages);

    expect(result[1].conversionRate).toBe(0);
    expect(result[2].conversionRate).toBe(0);
  });

  it('falls back to hardcoded k-factor when metric is null', () => {
    expect(deriveKFactor(null)).toEqual({ current: 0.58, target: 0.6, gap: 0.02 });
  });

  it('derives k-factor gap from metric', () => {
    const metric: KFactorMetric = { current: 0.55, target: 0.6, period: '2025-06' };
    expect(deriveKFactor(metric)).toEqual({ current: 0.55, target: 0.6, gap: 0.05 });
  });

  it('falls back to hardcoded campaign lift when campaigns are empty', () => {
    const result = deriveCampaignLift([]);
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({ campaignName: 'COF-001 Welcome', lift: 0.12, probability: 0.97, isSignificant: true });
  });

  it('passes through campaign lift rows', () => {
    const campaigns: CampaignLiftRow[] = [
      { campaignId: 'cof-001', campaignName: 'Test', lift: 0.1, probability: 0.95, isSignificant: true },
    ];
    const result = deriveCampaignLift(campaigns);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ campaignName: 'Test', lift: 0.1, probability: 0.95, isSignificant: true });
  });
});

describe('useGrowthMetrics', () => {
  beforeEach(() => {
    resetStore();
  });

  it('wires every growth metric field from the analytics store state', () => {
    const analytics = useRootStore.getState().analytics;
    const wtrPoints: WtrPoint[] = [{ week: '2025-W01', wtr: 1.2, movingAverage: 1.1 }];
    const kitFunnelStages: KitFunnelStage[] = [
      { stage: 'sent', count: 1000, conversionRate: 100 },
      { stage: 'delivered', count: 920, conversionRate: 92 },
    ];
    const cacByChannel: CacChannelRow[] = [
      { channel: 'organic', cac: 50, spend: 1000, newAccounts: 20 },
    ];
    const hazardHeatmap: HazardHeatmapRow[] = [
      { segment: 'micro', tier: 'T1', count: 10, avgHazard: 0.2 },
    ];
    const kFactor: KFactorMetric = { current: 0.55, target: 0.6, period: '2025-06' };
    const campaignLift: CampaignLiftRow[] = [
      { campaignId: 'c1', campaignName: 'Test', lift: 0.1, probability: 0.95, isSignificant: true },
    ];

    useRootStore.setState({
      analytics: {
        ...analytics,
        wtrPoints,
        kitFunnelStages,
        cacByChannel,
        cacCeiling: 750,
        hazardHeatmap,
        kFactor,
        campaignLift,
        loading: true,
      },
    });

    const { result } = renderHook(() => useGrowthMetrics());

    expect(result.current.wtrPoints).toBe(wtrPoints);
    expect(result.current.kitFunnel).toEqual([
      { stage: 'Sent', count: 1000, conversionRate: 100 },
      { stage: 'Delivered', count: 920, conversionRate: 92 },
    ]);
    expect(result.current.cacByChannel).toBe(cacByChannel);
    expect(result.current.cacCeiling).toBe(750);
    expect(result.current.hazardHeatmap).toBe(hazardHeatmap);
    expect(result.current.kFactor).toEqual({ current: 0.55, target: 0.6, gap: 0.05 });
    expect(result.current.campaignLift).toBe(campaignLift);
    expect(result.current.loading).toBe(true);
  });
});
