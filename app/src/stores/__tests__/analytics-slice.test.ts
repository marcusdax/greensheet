import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';
import { api } from '../../api/client';

const mockProblem = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  code: 'GS-ANL-1000',
  detail: 'Mocked analytics failure',
};

describe('analytics slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads cohorts', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadCohorts();
    expect(useRootStore.getState().analytics.cohorts.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.cohorts[0]).toHaveProperty('cohort');
    expect(useRootStore.getState().analytics.cohorts[0]).toHaveProperty('roasters');
    expect(useRootStore.getState().analytics.loading).toBe(false);
  });

  it('loads LTV snapshots', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadLtv();
    expect(useRootStore.getState().analytics.ltvSnapshots.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.ltvSnapshots[0]).toHaveProperty('ltvCents');
  });

  it('loads churn risks', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadChurn();
    expect(useRootStore.getState().analytics.churnRisks.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.churnRisks[0]).toHaveProperty('riskScore');
  });

  it('loads funnel, viral, and forecast data', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadFunnel();
    await analytics.loadViral();
    await analytics.loadForecast();
    expect(useRootStore.getState().analytics.funnelStages.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.funnelStages[0]).toHaveProperty('stage');
    expect(useRootStore.getState().analytics.viralReferrals.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.viralReferrals[0]).toHaveProperty('referrals');
    expect(useRootStore.getState().analytics.forecast.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.forecast[0]).toHaveProperty('period');
  });

  it('loads all analytics in one call', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadAll();
    expect(useRootStore.getState().analytics.loading).toBe(false);
    expect(useRootStore.getState().analytics.cohorts.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.ltvSnapshots.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.churnRisks.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.funnelStages.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.viralReferrals.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.forecast.length).toBeGreaterThan(0);
  });

  it('loads WTR points', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadWtr();
    expect(useRootStore.getState().analytics.wtrPoints.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.wtrPoints[0]).toHaveProperty('week');
    expect(useRootStore.getState().analytics.wtrPoints[0]).toHaveProperty('wtr');
    expect(useRootStore.getState().analytics.loading).toBe(false);
  });

  it('loads kit funnel stages', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadKitFunnel();
    const stages = useRootStore.getState().analytics.kitFunnelStages;
    expect(stages.length).toBe(4);
    expect(stages[0]).toMatchObject({ stage: 'sent', count: 1000 });
    expect(stages[3]).toMatchObject({ stage: 'first_order', count: 166 });
  });

  it('loads CAC by channel', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadCacByChannel();
    expect(useRootStore.getState().analytics.cacByChannel.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.cacByChannel[0]).toHaveProperty('channel');
    expect(useRootStore.getState().analytics.cacByChannel[0]).toHaveProperty('cac');
    expect(useRootStore.getState().analytics.cacCeiling).toBe(500);
  });

  it('loads hazard heatmap rows', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadHazardHeatmap();
    expect(useRootStore.getState().analytics.hazardHeatmap.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.hazardHeatmap[0]).toHaveProperty('segment');
    expect(useRootStore.getState().analytics.hazardHeatmap[0]).toHaveProperty('tier');
  });

  it('loads k-factor metric', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadKFactor();
    expect(useRootStore.getState().analytics.kFactor).toMatchObject({
      current: 0.58,
      target: 0.6,
    });
  });

  it('loads campaign lift rows', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadCampaignLift();
    expect(useRootStore.getState().analytics.campaignLift.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.campaignLift[0]).toHaveProperty('campaignId');
    expect(useRootStore.getState().analytics.campaignLift[0]).toHaveProperty('lift');
  });

  it('loads all growth analytics in one call', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadGrowthAll();
    expect(useRootStore.getState().analytics.loading).toBe(false);
    expect(useRootStore.getState().analytics.wtrPoints.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.kitFunnelStages.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.cacByChannel.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.cacCeiling).toBe(500);
    expect(useRootStore.getState().analytics.hazardHeatmap.length).toBeGreaterThan(0);
    expect(useRootStore.getState().analytics.kFactor).not.toBeNull();
    expect(useRootStore.getState().analytics.campaignLift.length).toBeGreaterThan(0);
  });

  it('captures a problem from an individual growth loader', async () => {
    vi.spyOn(api.analytics, 'cacByChannel').mockResolvedValueOnce({ problem: mockProblem });
    const analytics = useRootStore.getState().analytics;
    await analytics.loadCacByChannel();
    expect(useRootStore.getState().analytics.loading).toBe(false);
    expect(useRootStore.getState().analytics.error).toMatchObject({ code: 'GS-ANL-1000' });
  });

  it('captures a problem from loadGrowthAll', async () => {
    vi.spyOn(api.analytics, 'cacByChannel').mockResolvedValueOnce({ problem: mockProblem });
    const analytics = useRootStore.getState().analytics;
    await analytics.loadGrowthAll();
    expect(useRootStore.getState().analytics.loading).toBe(false);
    expect(useRootStore.getState().analytics.error).toMatchObject({ code: 'GS-ANL-1000' });
    expect(useRootStore.getState().analytics.cacByChannel).toHaveLength(0);
    expect(useRootStore.getState().analytics.wtrPoints.length).toBeGreaterThan(0);
  });
});
