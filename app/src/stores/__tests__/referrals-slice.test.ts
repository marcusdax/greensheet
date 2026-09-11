import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import { resetDatabase } from '../../api/db';

describe('referrals slice', () => {
  beforeEach(() => {
    resetDatabase();
    resetStore();
  });

  it('setCurrentAccount sets the current account', () => {
    const referrals = useRootStore.getState().referrals;
    expect(useRootStore.getState().referrals.currentAccountId).toBeNull();
    referrals.setCurrentAccount('r_001');
    expect(useRootStore.getState().referrals.currentAccountId).toBe('r_001');
  });

  it('returns early when currentAccountId is not set', async () => {
    const referrals = useRootStore.getState().referrals;
    await referrals.loadReferrals();
    expect(useRootStore.getState().referrals.referrals).toHaveLength(0);
    expect(useRootStore.getState().referrals.loading).toBe(false);
  });

  it('loads referrals for an account', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    await referrals.loadReferrals();
    const state = useRootStore.getState().referrals;
    // r_001 has 5 seeded referrals (ref_001..ref_005)
    expect(state.referrals).toHaveLength(5);
    // Loaded sorted by createdAt descending (newest first)
    expect(state.referrals[0].id).toBe('ref_005');
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('loads referral stats for an account', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    await referrals.loadReferralStats();
    const stats = useRootStore.getState().referrals.stats;
    expect(stats).not.toBeNull();
    expect(stats!.accountId).toBe('r_001');
    expect(stats!.invitesSent).toBe(5);
    expect(stats!.qualifiedReferrals).toBe(1);
    expect(stats!.kFactor).toBe(0.5);
    // 2 posted referrer credits of 15000 each; 2 pending of 15000 each
    expect(stats!.earnedRewardsCents).toBe(150_00);
    expect(stats!.pendingRewardsCents).toBe(300_00);
    expect(stats!.clawedBackRewardsCents).toBe(0);
  });

  it('loads the reward ledger for an account', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    await referrals.loadLedger();
    const state = useRootStore.getState().referrals;
    // r_001 has 3 ledger entries: rl_001 (posted), rl_003 (pending), rl_004 (pending)
    // Note: rl_002 belongs to r_003, not r_001
    expect(state.ledger).toHaveLength(3);
    // Sorted descending by createdAt
    expect(state.ledger[0].id).toBe('rl_003');
    expect(state.error).toBeNull();
  });

  it('ensures a referral code for an account', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    const code = await referrals.ensureReferralCode();
    expect(code).not.toBeNull();
    expect(code!.code).toBe('AL-RVR-001');

    const state = useRootStore.getState().referrals;
    expect(state.codes).toHaveLength(1);
    expect(state.codes[0].accountId).toBe('r_001');
    expect(state.codes[0].status).toBe('active');
  });

  it('creates a new referral code for an account without one', async () => {
    const referrals = useRootStore.getState().referrals;
    // r_003 has no pre-seeded referral code
    referrals.setCurrentAccount('r_003');
    const code = await referrals.ensureReferralCode();
    expect(code).not.toBeNull();
    expect(code!.accountId).toBe('r_003');
    expect(code!.status).toBe('active');
  });

  it('qualifyReferral returns existing ledger entries for an already-qualified referral', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    // ref_001 is already qualified — should return existing ledger entries
    const entries = await referrals.qualifyReferral('ref_001');
    expect(entries).not.toBeNull();
    // ref_001 has 2 existing ledger entries (rl_001, rl_002)
    expect(entries).toHaveLength(2);
  });

  it('clawBack changes referral status to clawed_back and updates ledger', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    // Load initial state so the slice has referrals and ledger entries to update
    await referrals.loadReferrals();
    await referrals.loadLedger();
    expect(useRootStore.getState().referrals.ledger.filter((e) => e.status === 'posted')).toHaveLength(1);

    const entries = await referrals.clawBack('ref_001');
    expect(entries).not.toBeNull();
    // ref_001 has 2 posted ledger entries for this referral: rl_001 (r_001) and rl_002 (r_003)
    expect(entries).toHaveLength(2);
    expect(entries![0].status).toBe('clawed_back');
    expect(entries![1].status).toBe('clawed_back');

    const state = useRootStore.getState().referrals;
    // The referral itself should be updated to clawed_back
    const updatedRef = state.referrals.find((r) => r.id === 'ref_001');
    expect(updatedRef).toBeTruthy();
    expect(updatedRef!.status).toBe('clawed_back');
    // The posted ledger entry for r_001 (rl_001) should now be clawed_back
    // Note: rl_002 belongs to r_003 and is not in this account's loaded ledger,
    // but it is returned in the API's affected entries above
    const updatedEntry1 = state.ledger.find((e) => e.id === 'rl_001');
    expect(updatedEntry1).toBeTruthy();
    expect(updatedEntry1!.status).toBe('clawed_back');
    expect(updatedEntry1!.clawedBackAt).toBeTruthy();
  });

  it('qualifyReferral returns null for a non-existent referral', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    const entries = await referrals.qualifyReferral('does_not_exist');
    expect(entries).toBeNull();
    const error = useRootStore.getState().referrals.error;
    expect(error).not.toBeNull();
    expect(error!.code).toBe('AL-REF-1003');
  });

  it('clawBack returns null for a non-qualified referral', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    // ref_005 is 'invited' — not qualified, cannot claw back
    const entries = await referrals.clawBack('ref_005');
    expect(entries).toBeNull();
    const error = useRootStore.getState().referrals.error;
    expect(error).not.toBeNull();
    expect(error!.code).toBe('AL-REF-1004');
  });

	it('loads the review queue for an account', async () => {
		const referrals = useRootStore.getState().referrals;
		referrals.setCurrentAccount('r_002');
		// Manually inject a pending_review referral into the db
		const db = await import('../../api/db');
    db.db.referrals.push({
      id: 'ref_review_1',
      referrerId: 'r_002',
      refereeId: 'r_004',
      refCode: 'AL-RVR-002',
      status: 'feedback_submitted',
      channel: 'invite_link',
      reviewStatus: 'pending_review',
      createdAt: '2025-07-01T00:00:00.000Z',
      updatedAt: '2025-07-01T00:00:00.000Z',
    });

    await referrals.loadReviewQueue();
    const state = useRootStore.getState().referrals;
    expect(state.reviewQueue).toHaveLength(1);
    expect(state.reviewQueue[0].id).toBe('ref_review_1');
  });

  it('approveReview qualifies a referral and sets reviewStatus to approved', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_002');

    // Seed a pending_review referral with a qualifying order
    const db = await import('../../api/db');
    db.db.referrals.push({
      id: 'ref_approve_1',
      referrerId: 'r_002',
      refereeId: 'r_003',
      refCode: 'AL-RVR-002',
      status: 'first_order_delivered',
      channel: 'invite_link',
      reviewStatus: 'pending_review',
      createdAt: '2025-05-15T00:00:00.000Z',
      updatedAt: '2025-07-15T00:00:00.000Z',
    });
    // ref_006 (r_002 → r_003) is already qualified with an order; use r_004 instead
    // but r_004 is 'trial'. Let's seed an order for r_003 that is 31+ days old.
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    db.db.orders.push({
      id: 'ord_approve_1',
      accountId: 'r_003',
      status: 'delivered',
      lineItems: [],
      finalTotalCents: 250_00,
      createdAt: thirtyOneDaysAgo,
      updatedAt: thirtyOneDaysAgo,
    });
    // Patch r_003 (referee) to pass reseller screening (business registration + tax ID)
    const r003Idx = db.db.roasters.findIndex((r) => r.id === 'r_003');
    db.db.roasters[r003Idx] = { ...db.db.roasters[r003Idx], businessRegistration: 'BR-003', taxId: 'TAX-003' };

    // Load referrals so the slice has the seeded referrals in its array
    await referrals.loadReferrals();

    const result = await referrals.approveReview('ref_approve_1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('qualified');
    expect(result!.reviewStatus).toBe('approved');

    const state = useRootStore.getState().referrals;
    const approved = state.referrals.find((r) => r.id === 'ref_approve_1');
    expect(approved).toBeTruthy();
    expect(approved!.status).toBe('qualified');
    expect(approved!.reviewStatus).toBe('approved');
    expect(state.reviewQueue).not.toContain(expect.objectContaining({ id: 'ref_approve_1' }));
  });

  it('declineReview sets referral status to declined', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_002');

    const db = await import('../../api/db');
    db.db.referrals.push({
      id: 'ref_decline_1',
      referrerId: 'r_002',
      refereeId: 'r_004',
      refCode: 'AL-RVR-002',
      status: 'kit_delivered',
      channel: 'invite_link',
      reviewStatus: 'pending_review',
      createdAt: '2025-07-01T00:00:00.000Z',
      updatedAt: '2025-07-01T00:00:00.000Z',
    });

    const result = await referrals.declineReview('ref_decline_1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('declined');
    expect(result!.reviewStatus).toBe('declined');
  });

  it('approveReview returns error when referral not in review queue', async () => {
    const referrals = useRootStore.getState().referrals;
    referrals.setCurrentAccount('r_001');
    // ref_001 is already qualified, not in review
    await referrals.approveReview('ref_001');
    const error = useRootStore.getState().referrals.error;
    expect(error).not.toBeNull();
    expect(error!.code).toBe('AL-REF-1008');
  });
});
