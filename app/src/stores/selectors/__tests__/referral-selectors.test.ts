import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { resetDatabase } from '../../../api/db';
import { resetStore, useRootStore } from '../../root-store';
import {
  useReferralTier,
  useNetEarnedCents,
  useFunnelCounts,
} from '../referral-selectors';

beforeEach(() => {
  localStorage.clear();
  resetDatabase();
  resetStore();
});

describe('referral selectors', () => {
  it('returns a tier when stats are loaded', async () => {
    await useRootStore.getState().referrals.loadStats('r_001');
    const { result } = renderHook(() => useReferralTier());
    expect(result.current).not.toBeNull();
    expect(['Cupper', 'Green Buyer', 'Compass Circle']).toContain(result.current?.name);
  });

  it('computes net earned cents', async () => {
    await useRootStore.getState().referrals.loadStats('r_001');
    const { result } = renderHook(() => useNetEarnedCents());
    expect(result.current).toBeGreaterThanOrEqual(0);
  });

  it('returns zeroed funnel when stats are null', () => {
    const { result } = renderHook(() => useFunnelCounts());
    expect(result.current.invitesSent).toBe(0);
  });
});
