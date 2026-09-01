import type { CuppingCompetition, CuppingResult, BraveFewEntry } from '../../types/lotspace';
import { competitions } from '../../data/feed';
import { braveFewLeaderboard } from '../../data/spaces';

export interface ReputationState {
  competitions: CuppingCompetition[];
  braveFew: BraveFewEntry[];
  submittedScoreIds: Set<string>;
  loading: boolean;
  error: string | null;
}

export interface ReputationActions {
  loadCompetitions: () => void;
  loadBraveFew: () => void;
  submitScore: (competitionId: string, score: CuppingResult) => void;
  hasSubmittedScore: (competitionId: string) => boolean;
  getCompetitionById: (id: string) => CuppingCompetition | null;
}

export type ReputationSlice = ReputationState & ReputationActions;

export const initialReputationState: ReputationState = {
  competitions: [],
  braveFew: [],
  submittedScoreIds: new Set<string>(),
  loading: false,
  error: null,
};

export const createReputationSlice = (set: any, get: any) => ({
  ...initialReputationState,

  loadCompetitions: () => {
    set(
      (s: any) => { s.reputation.loading = true; },
      false,
      'reputation/loadCompetitions/start',
    );
    setTimeout(() => {
      set(
        (s: any) => {
          s.reputation.competitions = competitions;
          s.reputation.loading = false;
        },
        false,
        'reputation/loadCompetitions/done',
      );
    }, 200);
  },

  loadBraveFew: () => {
    set(
      (s: any) => {
        s.reputation.braveFew = braveFewLeaderboard;
      },
      false,
      'reputation/loadBraveFew',
    );
  },

  submitScore: (competitionId: string, score: CuppingResult) => {
    set(
      (s: any) => {
        const idx = s.reputation.competitions.findIndex((c: CuppingCompetition) => c.id === competitionId);
        if (idx >= 0) {
          s.reputation.competitions[idx].submittedScores = [
            ...s.reputation.competitions[idx].submittedScores,
            score,
          ];
        }
        s.reputation.submittedScoreIds = new Set([...s.reputation.submittedScoreIds, competitionId]);
      },
      false,
      'reputation/submitScore',
    );
  },

  hasSubmittedScore: (competitionId: string) => get().reputation.submittedScoreIds.has(competitionId),

  getCompetitionById: (id: string): CuppingCompetition | null => {
    return get().reputation.competitions.find((c: CuppingCompetition) => c.id === id) ?? null;
  },
});
