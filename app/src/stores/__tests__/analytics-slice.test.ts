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
    expect(useRootStore.getState().analytics.cohorts).toEqual([]);
    expect(useRootStore.getState().analytics.loading).toBe(false);
  });

  it('loads LTV snapshots', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadLtv();
    expect(useRootStore.getState().analytics.ltvSnapshots).toEqual([]);
  });

  it('loads churn risks', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadChurn();
    expect(useRootStore.getState().analytics.churnRisks).toEqual([]);
  });

  it('loads funnel, viral, and forecast data', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadFunnel();
    await analytics.loadViral();
    await analytics.loadForecast();
    expect(useRootStore.getState().analytics.funnelStages).toEqual([]);
    expect(useRootStore.getState().analytics.viralReferrals).toEqual([]);
    expect(useRootStore.getState().analytics.forecast).toEqual([]);
  });

  it('loads all analytics in one call', async () => {
    const analytics = useRootStore.getState().analytics;
    await analytics.loadAll();
    expect(useRootStore.getState().analytics.loading).toBe(false);
    expect(useRootStore.getState().analytics.cohorts).toEqual([]);
    expect(useRootStore.getState().analytics.ltvSnapshots).toEqual([]);
    expect(useRootStore.getState().analytics.churnRisks).toEqual([]);
    expect(useRootStore.getState().analytics.funnelStages).toEqual([]);
    expect(useRootStore.getState().analytics.viralReferrals).toEqual([]);
    expect(useRootStore.getState().analytics.forecast).toEqual([]);
  });
});
