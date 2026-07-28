import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('analytics slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
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
});
