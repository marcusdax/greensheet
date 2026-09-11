import { api } from '../../api/client';
import type { Referral, ReferralCode, ReferralStats, RewardLedgerEntry, Problem } from '../../types/api';

export interface ReferralsState {
  referrals: Referral[];
  codes: ReferralCode[];
  stats: ReferralStats | null;
  ledger: RewardLedgerEntry[];
  reviewQueue: any[];
  loading: boolean;
  error: Problem | null;
  currentAccountId: string | null;
}

export interface ReferralsActions {
  setCurrentAccount: (accountId: string | null) => void;
  loadReferrals: () => Promise<void>;
  loadReferralStats: () => Promise<void>;
  loadLedger: () => Promise<void>;
  ensureReferralCode: () => Promise<ReferralCode | null>;
  qualifyReferral: (referralId: string) => Promise<RewardLedgerEntry[] | null>;
  clawBack: (referralId: string) => Promise<RewardLedgerEntry[] | null>;
  loadReviewQueue: () => Promise<void>;
  approveReview: (reviewId: string) => Promise<Referral | null>;
  declineReview: (reviewId: string) => Promise<Referral | null>;
}

export type ReferralsSlice = ReferralsState & ReferralsActions;

export const initialReferralsState: ReferralsState = {
  referrals: [],
  codes: [],
  stats: null,
  ledger: [],
  reviewQueue: [],
  loading: false,
  error: null,
  currentAccountId: null,
};

export const createReferralsSlice = (set: any, get: any) => ({
  ...initialReferralsState,

  setCurrentAccount: (accountId: string | null) => {
    set(
      (s: any) => { s.referrals.currentAccountId = accountId; },
      false,
      'referrals/setCurrentAccount',
    );
  },

  loadReferrals: async () => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/loadReferrals/start');
    const res = await api.referrals.listReferrals(accountId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/loadReferrals/error');
    } else {
      set((s: any) => {
        s.referrals.referrals = res.data.referrals.map((r: Referral) => ({ ...r }));
        s.referrals.loading = false;
      }, false, 'referrals/loadReferrals/done');
    }
  },

  loadReferralStats: async () => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/loadReferralStats/start');
    const res = await api.referrals.getStats(accountId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/loadReferralStats/error');
    } else {
      set((s: any) => {
        s.referrals.stats = res.data.stats;
        s.referrals.loading = false;
      }, false, 'referrals/loadReferralStats/done');
    }
  },

  loadLedger: async () => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/loadLedger/start');
    const res = await api.referrals.listLedger(accountId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/loadLedger/error');
    } else {
      set((s: any) => {
        s.referrals.ledger = res.data.entries.map((e: RewardLedgerEntry) => ({ ...e }));
        s.referrals.loading = false;
      }, false, 'referrals/loadLedger/done');
    }
  },

  ensureReferralCode: async () => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return null;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/ensureReferralCode/start');
    const res = await api.referrals.getCodeForAccount(accountId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/ensureReferralCode/error');
      return null;
    }
    set((s: any) => {
      const idx = s.referrals.codes.findIndex((c: ReferralCode) => c.accountId === accountId);
      if (idx >= 0) {
        s.referrals.codes[idx] = res.data.code;
      } else {
        s.referrals.codes.push(res.data.code);
      }
      s.referrals.loading = false;
    }, false, 'referrals/ensureReferralCode/done');
    return res.data.code;
  },

  qualifyReferral: async (referralId: string) => {
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/qualifyReferral/start');
    const res = await api.referrals.qualifyReferral(referralId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/qualifyReferral/error');
      return null;
    }
    set((s: any) => {
      const idx = s.referrals.referrals.findIndex((r: Referral) => r.id === referralId);
      if (idx >= 0) {
        s.referrals.referrals[idx] = res.data.referral;
      }
      s.referrals.ledger = [...s.referrals.ledger, ...res.data.entries.map((e: RewardLedgerEntry) => ({ ...e }))];
      s.referrals.loading = false;
    }, false, 'referrals/qualifyReferral/done');
    return res.data.entries;
  },

  clawBack: async (referralId: string) => {
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/clawBack/start');
    const res = await api.referrals.clawBack(referralId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/clawBack/error');
      return null;
    }
    set((s: any) => {
      const idx = s.referrals.referrals.findIndex((r: Referral) => r.id === referralId);
      if (idx >= 0) {
        s.referrals.referrals[idx] = res.data.referral;
      }
      s.referrals.ledger = s.referrals.ledger.map((e: RewardLedgerEntry) => {
        const updated = res.data.entries.find((r: RewardLedgerEntry) => r.id === e.id);
        return updated ? { ...updated } : e;
      });
      s.referrals.loading = false;
    }, false, 'referrals/clawBack/done');
    return res.data.entries;
  },

  loadReviewQueue: async () => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/loadReviewQueue/start');
    const res = await api.referrals.listPendingReview(accountId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/loadReviewQueue/error');
    } else {
      set((s: any) => {
        s.referrals.reviewQueue = res.data.referrals;
        s.referrals.loading = false;
      }, false, 'referrals/loadReviewQueue/done');
    }
  },

  approveReview: async (reviewId: string): Promise<Referral | null> => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return null;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/approveReview/start');
    const res = await api.referrals.approveReview(reviewId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/approveReview/error');
      return null;
    }
    set((s: any) => {
      const idx = s.referrals.referrals.findIndex((r: Referral) => r.id === reviewId);
      if (idx >= 0) {
        s.referrals.referrals[idx] = res.data.referral;
      }
      s.referrals.reviewQueue = s.referrals.reviewQueue.filter((r: any) => r.id !== reviewId);
      if (res.data.entries?.length) {
        s.referrals.ledger = [...s.referrals.ledger, ...res.data.entries.map((e: RewardLedgerEntry) => ({ ...e }))];
      }
      s.referrals.loading = false;
    }, false, 'referrals/approveReview/done');
    return res.data.referral;
  },

  declineReview: async (reviewId: string): Promise<Referral | null> => {
    const accountId = get().referrals.currentAccountId;
    if (!accountId) return null;
    set((s: any) => { s.referrals.loading = true; s.referrals.error = null; }, false, 'referrals/declineReview/start');
    const res = await api.referrals.declineReview(reviewId);
    if ('problem' in res) {
      set((s: any) => { s.referrals.error = res.problem; s.referrals.loading = false; }, false, 'referrals/declineReview/error');
      return null;
    }
    set((s: any) => {
      const idx = s.referrals.referrals.findIndex((r: Referral) => r.id === reviewId);
      if (idx >= 0) {
        s.referrals.referrals[idx] = res.data.referral;
      }
      s.referrals.reviewQueue = s.referrals.reviewQueue.filter((r: any) => r.id !== reviewId);
      s.referrals.loading = false;
    }, false, 'referrals/declineReview/done');
    return res.data.referral;
  },
});