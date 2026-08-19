import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabase } from '../../../api/db';
import { resetStore, useRootStore } from '../../root-store';

beforeEach(() => {
  localStorage.clear();
  resetDatabase();
  resetStore();
});

describe('referrals slice', () => {
  it('loads a referral code', async () => {
    await useRootStore.getState().referrals.loadCode('r_001');
    expect(useRootStore.getState().referrals.code).not.toBeNull();
    expect(useRootStore.getState().referrals.code?.accountId).toBe('r_001');
  });

  it('loads referrals', async () => {
    await useRootStore.getState().referrals.loadReferrals('r_001');
    expect(useRootStore.getState().referrals.referrals.length).toBeGreaterThan(0);
  });

  it('loads ledger', async () => {
    await useRootStore.getState().referrals.loadLedger('r_001');
    expect(useRootStore.getState().referrals.ledger.length).toBeGreaterThan(0);
  });

  it('loads stats', async () => {
    await useRootStore.getState().referrals.loadStats('r_001');
    expect(useRootStore.getState().referrals.stats).not.toBeNull();
    expect(useRootStore.getState().referrals.stats?.accountId).toBe('r_001');
  });
});
