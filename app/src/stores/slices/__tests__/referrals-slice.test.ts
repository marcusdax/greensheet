import { describe, it, expect, beforeEach } from 'vitest';
import type { Referral, ReferralStatus, ReferralChannel } from '../../../types/api';
import { db, resetDatabase } from '../../../api/db';
import { resetStore, useRootStore } from '../../root-store';

beforeEach(() => {
  localStorage.clear();
  resetDatabase();
  resetStore();
});

function seedPendingReviewReferral(
  id: string,
  referrerId: string,
  refCode: string,
  status: ReferralStatus,
  rest: Partial<Referral> = {},
) {
  db.referrals.push({
    id,
    referrerId,
    refCode,
    status,
    channel: 'invite_link' as ReferralChannel,
    reviewStatus: 'pending_review',
    createdAt: '2025-08-01T00:00:00.000Z',
    ...rest,
  });
}

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

  it('createCode succeeds and caches the code', async () => {
    const res = await useRootStore.getState().referrals.createCode('r_001');
    expect('data' in res).toBe(true);
    expect(useRootStore.getState().referrals.code).not.toBeNull();
    expect(useRootStore.getState().referrals.code?.accountId).toBe('r_001');
  });

  it('createCode handles a duplicate custom code gracefully', async () => {
    const res = await useRootStore.getState().referrals.createCode('r_003', 'GS-RVR-001');
    expect('problem' in res).toBe(true);
    if ('problem' in res) {
      expect(res.problem.code).toBe('GS-REF-1001');
    }
    expect(useRootStore.getState().referrals.error).not.toBeNull();
    expect(useRootStore.getState().referrals.error?.code).toBe('GS-REF-1001');
  });

  it('recordClick creates/updates a referral in the list', async () => {
    await useRootStore.getState().referrals.recordClick('GS-RVR-001');
    const list = useRootStore.getState().referrals.referrals;
    expect(list.length).toBe(1);
    expect(list[0].status).toBe('clicked');
    expect(list[0].refCode).toBe('GS-RVR-001');
  });

  it('qualify updates the referral, ledger, and stats', async () => {
    await useRootStore.getState().referrals.loadReferrals('r_001');
    await useRootStore.getState().referrals.loadStats('r_001');
    const beforeStats = useRootStore.getState().referrals.stats;
    expect(beforeStats).not.toBeNull();

    await useRootStore.getState().referrals.qualify('ref_004');

    const referral = useRootStore.getState().referrals.referrals.find((r) => r.id === 'ref_004');
    expect(referral?.status).toBe('qualified');
    expect(useRootStore.getState().referrals.ledger.some((e) => e.referralId === 'ref_004' && e.status === 'posted')).toBe(
      true,
    );
    expect(useRootStore.getState().referrals.stats?.qualifiedReferrals).toBe(
      (beforeStats?.qualifiedReferrals ?? 0) + 1,
    );
  });

  it('clawBack updates the referral, ledger, and stats', async () => {
    await useRootStore.getState().referrals.loadReferrals('r_001');
    await useRootStore.getState().referrals.loadStats('r_001');
    const beforeStats = useRootStore.getState().referrals.stats;
    expect(beforeStats).not.toBeNull();

    await useRootStore.getState().referrals.clawBack('ref_001');

    const referral = useRootStore.getState().referrals.referrals.find((r) => r.id === 'ref_001');
    expect(referral?.status).toBe('clawed_back');
    expect(
      useRootStore.getState().referrals.ledger.some((e) => e.referralId === 'ref_001' && e.status === 'clawed_back'),
    ).toBe(true);
    expect(useRootStore.getState().referrals.stats?.qualifiedReferrals).toBe(
      (beforeStats?.qualifiedReferrals ?? 0) - 1,
    );
  });

  it('loadReviewQueue loads only pending-review referrals', async () => {
    seedPendingReviewReferral('ref_pending_001', 'r_001', 'GS-RVR-001', 'invited');
    await useRootStore.getState().referrals.loadReviewQueue();
    const queue = useRootStore.getState().referrals.reviewQueue;
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('ref_pending_001');
    expect(queue[0].reviewStatus).toBe('pending_review');
  });

  it('approveReview removes the referral from the review queue and updates stats/ledger', async () => {
    seedPendingReviewReferral('ref_review_001', 'r_001', 'GS-RVR-001', 'feedback_submitted', {
      refereeId: 'r_005',
      clickedAt: '2025-08-01T00:05:00.000Z',
      signedUpAt: '2025-08-01T00:30:00.000Z',
      kitRequestedAt: '2025-08-02T00:00:00.000Z',
      kitDeliveredAt: '2025-08-06T00:00:00.000Z',
      feedbackSubmittedAt: '2025-08-08T00:00:00.000Z',
    });

    await useRootStore.getState().referrals.loadReviewQueue();
    expect(useRootStore.getState().referrals.reviewQueue.some((r) => r.id === 'ref_review_001')).toBe(true);

    await useRootStore.getState().referrals.approveReview('ref_review_001');

    expect(useRootStore.getState().referrals.reviewQueue.some((r) => r.id === 'ref_review_001')).toBe(false);
    const referral = useRootStore.getState().referrals.referrals.find((r) => r.id === 'ref_review_001');
    expect(referral?.status).toBe('qualified');
    expect(useRootStore.getState().referrals.ledger.some((e) => e.referralId === 'ref_review_001')).toBe(true);
    expect(useRootStore.getState().referrals.stats).not.toBeNull();
  });

  it('declineReview removes the referral from the review queue but does not change the referrer ledger', async () => {
    seedPendingReviewReferral('ref_review_002', 'r_001', 'GS-RVR-001', 'feedback_submitted', {
      refereeId: 'r_005',
    });

    await useRootStore.getState().referrals.loadLedger('r_001');
    const beforeLedger = [...useRootStore.getState().referrals.ledger];

    await useRootStore.getState().referrals.loadReviewQueue();
    expect(useRootStore.getState().referrals.reviewQueue.some((r) => r.id === 'ref_review_002')).toBe(true);

    await useRootStore.getState().referrals.declineReview('ref_review_002');

    expect(useRootStore.getState().referrals.reviewQueue.some((r) => r.id === 'ref_review_002')).toBe(false);
    const referral = useRootStore.getState().referrals.referrals.find((r) => r.id === 'ref_review_002');
    expect(referral?.reviewStatus).toBe('declined');
    expect(useRootStore.getState().referrals.ledger).toEqual(beforeLedger);
  });
});
