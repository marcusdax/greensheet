import { useMemo } from 'react';
import { useReferrals } from '../root-store';
import type { ReferralStats } from '../../types/api';

export function useReferralCode() {
  const referrals = useReferrals();
  return referrals.code;
}

export function useReferralStats() {
  const referrals = useReferrals();
  return referrals.stats;
}

export interface ReferralTier {
  name: string;
  qualifiedCount: number;
  perks: string;
}

export function useReferralTier(): ReferralTier | null {
  const stats = useReferralStats();
  return useMemo(() => {
    if (!stats) return null;
    const count = stats.qualifiedReferrals;
    if (count >= 6) {
      return {
        name: 'Compass Circle',
        qualifiedCount: count,
        perks: 'Early access to micro-lot drops, origin-trip raffle seat, priority support.',
      };
    }
    if (count >= 3) {
      return {
        name: 'Green Buyer',
        qualifiedCount: count,
        perks: 'Quarterly origin report, invite-only cupping events.',
      };
    }
    return {
      name: 'Cupper',
      qualifiedCount: count,
      perks: 'Newsletter, referral dashboard access.',
    };
  }, [stats]);
}

export function useNetEarnedCents(): number {
  const stats = useReferralStats();
  return useMemo(() => {
    if (!stats) return 0;
    return stats.earnedRewardsCents - stats.clawedBackRewardsCents;
  }, [stats]);
}

export function useFunnelCounts(): Omit<
  ReferralStats,
  'accountId' | 'pendingRewardsCents' | 'earnedRewardsCents' | 'clawedBackRewardsCents' | 'kFactor'
> {
  const stats = useReferralStats();
  return useMemo(() => {
    if (!stats) {
      return {
        invitesSent: 0,
        clicks: 0,
        signups: 0,
        kitRequests: 0,
        kitDeliveries: 0,
        feedbackSubmitted: 0,
        qualifiedReferrals: 0,
      };
    }
    return {
      invitesSent: stats.invitesSent,
      clicks: stats.clicks,
      signups: stats.signups,
      kitRequests: stats.kitRequests,
      kitDeliveries: stats.kitDeliveries,
      feedbackSubmitted: stats.feedbackSubmitted,
      qualifiedReferrals: stats.qualifiedReferrals,
    };
  }, [stats]);
}
