import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { db, resetDatabase } from '../../../api/db';
import { resetStore, useRootStore } from '../../root-store';
import type { Referral } from '../../../types/api';
import {
  useReferralCode,
  useReferralStats,
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
  it('useReferralCode returns the loaded referral code', async () => {
    await useRootStore.getState().referrals.loadCode('r_001');
    const { result } = renderHook(() => useReferralCode());

    expect(result.current).not.toBeNull();
    expect(result.current?.code).toBe('GS-RVR-001');
    expect(result.current?.accountId).toBe('r_001');
  });

  it('useReferralStats returns the loaded stats', async () => {
    await useRootStore.getState().referrals.loadStats('r_001');
    const stats = useRootStore.getState().referrals.stats;
    const { result } = renderHook(() => useReferralStats());

    expect(result.current).toEqual(stats);
  });

  describe('useReferralTier', () => {
    it('returns null when stats are not loaded', () => {
      const { result } = renderHook(() => useReferralTier());
      expect(result.current).toBeNull();
    });

    it.each([
      { qualified: 0, expected: 'Cupper' },
      { qualified: 2, expected: 'Cupper' },
      { qualified: 3, expected: 'Green Buyer' },
      { qualified: 6, expected: 'Compass Circle' },
    ])(
      'maps $qualified qualified referrals to the $expected tier',
      async ({ qualified, expected }) => {
        const now = new Date().toISOString();
        for (let i = 0; i < qualified; i++) {
          db.referrals.push({
            id: `ref_boundary_${qualified}_${i}`,
            referrerId: 'r_003',
            refCode: 'GS-BOUNDARY',
            status: 'qualified',
            channel: 'invite_link',
            createdAt: now,
            clickedAt: now,
            signedUpAt: now,
            kitRequestedAt: now,
            kitDeliveredAt: now,
            feedbackSubmittedAt: now,
            firstOrderDeliveredAt: now,
            qualifiedAt: now,
          } as Referral);
        }

        await useRootStore.getState().referrals.loadStats('r_003');
        const { result } = renderHook(() => useReferralTier());

        expect(result.current).not.toBeNull();
        expect(result.current?.name).toBe(expected);
        expect(result.current?.qualifiedCount).toBe(qualified);
      },
    );

    it('matches the seeded tier for r_001', async () => {
      await useRootStore.getState().referrals.loadStats('r_001');
      const stats = useRootStore.getState().referrals.stats;
      const { result } = renderHook(() => useReferralTier());

      expect(result.current?.name).toBe('Cupper');
      expect(result.current?.qualifiedCount).toBe(stats?.qualifiedReferrals);
    });
  });

  describe('useNetEarnedCents', () => {
    it('returns 0 when stats are null', () => {
      const { result } = renderHook(() => useNetEarnedCents());
      expect(result.current).toBe(0);
    });

    it('returns earned rewards minus clawed-back rewards for r_001', async () => {
      await useRootStore.getState().referrals.loadStats('r_001');
      const stats = useRootStore.getState().referrals.stats;
      const { result } = renderHook(() => useNetEarnedCents());

      expect(result.current).toBe(stats!.earnedRewardsCents - stats!.clawedBackRewardsCents);
      expect(result.current).toBeGreaterThan(0);
    });

    it('returns 0 when earned and clawed-back rewards cancel out', async () => {
      await useRootStore.getState().referrals.loadStats('r_002');
      const stats = useRootStore.getState().referrals.stats;
      const { result } = renderHook(() => useNetEarnedCents());

      expect(result.current).toBe(stats!.earnedRewardsCents - stats!.clawedBackRewardsCents);
      expect(result.current).toBe(0);
    });
  });

  describe('useFunnelCounts', () => {
    it('returns zeroed funnel counts when stats are null', () => {
      const { result } = renderHook(() => useFunnelCounts());

      expect(result.current).toEqual({
        invitesSent: 0,
        clicks: 0,
        signups: 0,
        kitRequests: 0,
        kitDeliveries: 0,
        feedbackSubmitted: 0,
        qualifiedReferrals: 0,
      });
    });

    it('returns funnel fields from loaded stats', async () => {
      await useRootStore.getState().referrals.loadStats('r_001');
      const stats = useRootStore.getState().referrals.stats;
      const { result } = renderHook(() => useFunnelCounts());

      expect(result.current).toEqual({
        invitesSent: stats!.invitesSent,
        clicks: stats!.clicks,
        signups: stats!.signups,
        kitRequests: stats!.kitRequests,
        kitDeliveries: stats!.kitDeliveries,
        feedbackSubmitted: stats!.feedbackSubmitted,
        qualifiedReferrals: stats!.qualifiedReferrals,
      });
    });
  });
});
