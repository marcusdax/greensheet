import type { Problem, Referral, ReferralCode, ReferralStats, RewardLedgerEntry } from '../../types/api';
import { api } from '../../api/client';

export interface ReferralsState {
  code: ReferralCode | null;
  referrals: Referral[];
  ledger: RewardLedgerEntry[];
  stats: ReferralStats | null;
  reviewQueue: Referral[];
  loading: boolean;
  error: Problem | null;
}

export const initialReferralsState: ReferralsState = {
  code: null,
  referrals: [],
  ledger: [],
  stats: null,
  reviewQueue: [],
  loading: false,
  error: null,
};

export interface ReferralsSlice extends ReferralsState {
  createCode: (accountId: string, requestedCode?: string) => Promise<void>;
  loadCode: (accountId: string) => Promise<void>;
  loadReferrals: (accountId: string) => Promise<void>;
  loadLedger: (accountId: string) => Promise<void>;
  loadStats: (accountId: string) => Promise<void>;
  loadReviewQueue: () => Promise<void>;
  recordClick: (code: string, channel?: string) => Promise<void>;
  qualify: (referralId: string) => Promise<void>;
  clawBack: (referralId: string) => Promise<void>;
  approveReview: (referralId: string) => Promise<void>;
  declineReview: (referralId: string) => Promise<void>;
}

export function createReferralsSlice(set: any): ReferralsSlice {
  const start = (action: string) =>
    set(
      (s: { referrals: ReferralsState }) => {
        s.referrals.loading = true;
        s.referrals.error = null;
      },
      false,
      `referrals/${action}/start`,
    );

  const done = (action: string) =>
    set(
      (s: { referrals: ReferralsState }) => {
        s.referrals.loading = false;
      },
      false,
      `referrals/${action}/done`,
    );

  const error = (action: string, problem: Problem) =>
    set(
      (s: { referrals: ReferralsState }) => {
        s.referrals.loading = false;
        s.referrals.error = problem;
      },
      false,
      `referrals/${action}/error`,
    );

  const mutateReferral = (referralId: string, patch: Partial<Referral>) =>
    set(
      (s: { referrals: ReferralsState }) => {
        const idx = s.referrals.referrals.findIndex((r) => r.id === referralId);
        if (idx >= 0) {
          s.referrals.referrals[idx] = { ...s.referrals.referrals[idx], ...patch };
        }
      },
      false,
      'referrals/mutate',
    );

  const slice: ReferralsSlice = {
    ...initialReferralsState,

    async createCode(accountId, requestedCode) {
      start('createCode');
      const res = await api.referrals.createCode(accountId, requestedCode);
      if ('problem' in res) {
        error('createCode', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.code = res.data.code;
        },
        false,
        'referrals/createCode/done',
      );
    },

    async loadCode(accountId) {
      start('loadCode');
      const res = await api.referrals.getCodeForAccount(accountId);
      if ('problem' in res) {
        error('loadCode', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.code = res.data.code;
        },
        false,
        'referrals/loadCode/done',
      );
    },

    async loadReferrals(accountId) {
      start('loadReferrals');
      const res = await api.referrals.listReferrals(accountId);
      if ('problem' in res) {
        error('loadReferrals', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.referrals = res.data.referrals;
        },
        false,
        'referrals/loadReferrals/done',
      );
    },

    async loadLedger(accountId) {
      start('loadLedger');
      const res = await api.referrals.listLedger(accountId);
      if ('problem' in res) {
        error('loadLedger', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.ledger = res.data.entries;
        },
        false,
        'referrals/loadLedger/done',
      );
    },

    async loadStats(accountId) {
      start('loadStats');
      const res = await api.referrals.getStats(accountId);
      if ('problem' in res) {
        error('loadStats', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.stats = res.data.stats;
        },
        false,
        'referrals/loadStats/done',
      );
    },

    async loadReviewQueue() {
      start('loadReviewQueue');
      const res = await api.referrals.listReferrals('');
      if ('problem' in res) {
        error('loadReviewQueue', res.problem);
        return;
      }
      const queue = res.data.referrals.filter((r) => r.reviewStatus === 'pending_review');
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.reviewQueue = queue;
        },
        false,
        'referrals/loadReviewQueue/done',
      );
    },

    async recordClick(code, channel = 'invite_link') {
      start('recordClick');
      const res = await api.referrals.recordClick(code, channel as any);
      if ('problem' in res) {
        error('recordClick', res.problem);
        return;
      }
      done('recordClick');
    },

    async qualify(referralId) {
      start('qualify');
      const res = await api.referrals.qualifyReferral(referralId);
      if ('problem' in res) {
        error('qualify', res.problem);
        return;
      }
      mutateReferral(referralId, res.data.referral);
      done('qualify');
    },

    async clawBack(referralId) {
      start('clawBack');
      const res = await api.referrals.clawBack(referralId);
      if ('problem' in res) {
        error('clawBack', res.problem);
        return;
      }
      mutateReferral(referralId, res.data.referral);
      done('clawBack');
    },

    async approveReview(referralId) {
      set(
        (s: { referrals: ReferralsState }) => {
          const idx = s.referrals.reviewQueue.findIndex((r) => r.id === referralId);
          if (idx >= 0) {
            s.referrals.reviewQueue[idx] = {
              ...s.referrals.reviewQueue[idx],
              reviewStatus: 'approved',
            };
          }
        },
        false,
        'referrals/approveReview',
      );
      await slice.qualify(referralId);
    },

    async declineReview(referralId) {
      set(
        (s: { referrals: ReferralsState }) => {
          const idx = s.referrals.reviewQueue.findIndex((r) => r.id === referralId);
          if (idx >= 0) {
            s.referrals.reviewQueue[idx] = {
              ...s.referrals.reviewQueue[idx],
              reviewStatus: 'declined',
            };
          }
        },
        false,
        'referrals/declineReview',
      );
      mutateReferral(referralId, { reviewStatus: 'declined' });
      done('declineReview');
    },
  };

  return slice;
}
