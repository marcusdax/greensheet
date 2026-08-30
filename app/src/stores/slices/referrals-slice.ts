import type { ApiResult } from '../../api/client';
import type {
  Problem,
  Referral,
  ReferralChannel,
  ReferralCode,
  ReferralStats,
  RewardLedgerEntry,
} from '../../types/api';
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
  createCode: (accountId: string, requestedCode?: string) => Promise<ApiResult<{ code: ReferralCode }>>;
  loadCode: (accountId: string) => Promise<void>;
  loadReferrals: (accountId: string) => Promise<void>;
  loadLedger: (accountId: string) => Promise<void>;
  loadStats: (accountId: string) => Promise<void>;
  loadReviewQueue: () => Promise<void>;
  recordClick: (code: string, channel?: ReferralChannel) => Promise<void>;
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

  const error = (action: string, problem?: Problem) =>
    set(
      (s: { referrals: ReferralsState }) => {
        s.referrals.loading = false;
        s.referrals.error = problem ?? null;
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
        } else {
          s.referrals.referrals.push({ ...patch, id: referralId } as Referral);
        }
      },
      false,
      'referrals/mutate',
    );

  const mergeLedgerEntries = (entries: RewardLedgerEntry[]) =>
    set(
      (s: { referrals: ReferralsState }) => {
        for (const entry of entries) {
          const idx = s.referrals.ledger.findIndex((e) => e.id === entry.id);
          if (idx >= 0) {
            s.referrals.ledger[idx] = { ...s.referrals.ledger[idx], ...entry };
          } else {
            s.referrals.ledger.push({ ...entry });
          }
        }
      },
      false,
      'referrals/mergeLedger',
    );

  const refreshStats = async (referrerId: string) => {
    const statsRes = await api.referrals.getStats(referrerId);
    if (!('problem' in statsRes)) {
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.stats = statsRes.data.stats;
        },
        false,
        'referrals/refreshStats',
      );
    }
  };

  const qualifyById = async (
    referralId: string,
  ): Promise<ApiResult<{ referral: Referral; entries: RewardLedgerEntry[] }>> => {
    const res = await api.referrals.qualifyReferral(referralId);
    if ('problem' in res) return res;
    mutateReferral(referralId, res.data.referral);
    mergeLedgerEntries(res.data.entries);
    await refreshStats(res.data.referral.referrerId);
    return res;
  };

  const slice: ReferralsSlice = {
    ...initialReferralsState,

    async createCode(accountId, requestedCode): Promise<ApiResult<{ code: ReferralCode }>> {
      start('createCode');
      const res = await api.referrals.createCode(accountId, requestedCode);
      if ('problem' in res) {
        error('createCode', res.problem);
        return res;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.code = res.data.code;
          s.referrals.loading = false;
        },
        false,
        'referrals/createCode/done',
      );
      return res;
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
          s.referrals.loading = false;
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
          s.referrals.referrals = res.data.referrals.map((r) => ({ ...r }));
          s.referrals.loading = false;
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
          s.referrals.ledger = res.data.entries.map((e) => ({ ...e }));
          s.referrals.loading = false;
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
          s.referrals.loading = false;
        },
        false,
        'referrals/loadStats/done',
      );
    },

    async loadReviewQueue() {
      start('loadReviewQueue');
      const res = await api.referrals.getPendingReview();
      if ('problem' in res) {
        error('loadReviewQueue', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.reviewQueue = res.data.referrals.map((r) => ({ ...r }));
          s.referrals.loading = false;
        },
        false,
        'referrals/loadReviewQueue/done',
      );
    },

    async recordClick(code, channel = 'invite_link') {
      start('recordClick');
      const res = await api.referrals.recordClick(code, channel);
      if ('problem' in res) {
        error('recordClick', res.problem);
        return;
      }
      mutateReferral(res.data.referral.id, res.data.referral);
      done('recordClick');
    },

    async qualify(referralId) {
      start('qualify');
      const res = await qualifyById(referralId);
      if ('problem' in res) {
        error('qualify', res.problem);
        return;
      }
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
      mergeLedgerEntries(res.data.entries);
      await refreshStats(res.data.referral.referrerId);
      done('clawBack');
    },

    async approveReview(referralId) {
      start('approveReview');
      const res = await qualifyById(referralId);
      if ('problem' in res) {
        error('approveReview', res.problem);
        return;
      }
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.reviewQueue = s.referrals.reviewQueue.filter((r) => r.id !== referralId);
        },
        false,
        'referrals/approveReview/removeFromQueue',
      );
      done('approveReview');
    },

    async declineReview(referralId) {
      start('declineReview');
      const res = await api.referrals.declineReview(referralId);
      if ('problem' in res) {
        error('declineReview', res.problem);
        return;
      }
      mutateReferral(referralId, res.data.referral);
      set(
        (s: { referrals: ReferralsState }) => {
          s.referrals.reviewQueue = s.referrals.reviewQueue.filter((r) => r.id !== referralId);
        },
        false,
        'referrals/declineReview/removeFromQueue',
      );
      done('declineReview');
    },
  };

  return slice;
}
