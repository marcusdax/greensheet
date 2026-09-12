import type { UserCurriculumProgress, ModuleStatus } from '../../types/ledger';

export interface CurriculumCatalog {
  modules: Record<string, CurriculumModuleData>;
}

export interface CurriculumModuleData {
  id: string;
  title: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  regionCode: string;
  track: 'quality' | 'compliance' | 'finance' | 'logistics';
  lessons: string[];
}

export type TabName = 'overview' | 'lessons' | 'progress';

export interface CurriculumState {
  userProgress: Record<string, UserCurriculumProgress>;
  catalog: CurriculumCatalog | null;
}

export interface CurriculumActions {
  setCatalog: (catalog: CurriculumCatalog) => void;
  markLessonComplete: (moduleId: string, lessonId: string) => void;
  completeModule: (moduleId: string) => void;
  getModuleProgress: (moduleId: string) => UserCurriculumProgress | undefined;
  getCompletedLessonCount: (moduleId: string) => number;
  getModuleStatus: (moduleId: string) => ModuleStatus;
  loadProgress: () => void;
}

export type CurriculumSlice = CurriculumState & CurriculumActions;

export const initialCurriculumState: CurriculumState = {
  userProgress: {},
  catalog: null,
};

function nowISO(): string {
  return new Date().toISOString();
}

function ensureProgress(state: CurriculumState, userId: string, moduleId: string): UserCurriculumProgress {
  const key = `${userId}:${moduleId}`;
  if (!state.userProgress[key]) {
    state.userProgress[key] = {
      userId,
      moduleId,
      status: 'available',
      lessonsCompleted: [],
      lastUpdated: nowISO(),
    };
  }
  return state.userProgress[key];
}

const STORAGE_KEY = 'auctum-curriculum-progress';

export function saveProgressToLocalStorage(userProgress: Record<string, UserCurriculumProgress>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userProgress));
  } catch (err) {
    console.error('Failed to persist curriculum progress to localStorage', err);
  }
}

export function loadProgressFromLocalStorage(): Record<string, UserCurriculumProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, UserCurriculumProgress>;
  } catch (err) {
    console.error('Failed to load curriculum progress from localStorage', err);
    return {};
  }
}

export const createCurriculumSlice = (set: any, get?: any) => ({
  ...initialCurriculumState,

  reset: () => {
    set(
      (s: any) => {
        s.curriculum.userProgress = {};
        s.curriculum.catalog = null;
      },
      false,
      'curriculum/reset',
    );
  },

  setCatalog: (catalog: CurriculumCatalog) => {
    set(
      (s: any) => {
        s.curriculum.catalog = catalog;
      },
      false,
      'curriculum/setCatalog',
    );
  },

  markLessonComplete: (moduleId: string, lessonId: string) => {
    set(
      (s: any) => {
        const userId = 'current';
        const progress = ensureProgress(s.curriculum, userId, moduleId);

        // Unlock a locked module to in_progress when a lesson is marked.
        if (progress.status === 'locked') {
          progress.status = 'in_progress';
        }

        if (!progress.lessonsCompleted.includes(lessonId)) {
          progress.lessonsCompleted.push(lessonId);
        }

        // Move available to in_progress
        if (progress.status === 'available') {
          progress.status = 'in_progress';
        }

        // Do NOT auto-complete module here.
        // Do NOT grant +10 trust score here.

        progress.lastUpdated = nowISO();
        saveProgressToLocalStorage(get().curriculum.userProgress);
      },
      false,
      'curriculum/markLessonComplete',
    );
  },

  completeModule: (moduleId: string) => {
    set(
      (s: any) => {
        const userId = 'current';
        const moduleData = s.curriculum.catalog?.modules[moduleId];
        // Reject unknown modules — do not create progress records for them.
        if (!moduleData) return;

        const progress = ensureProgress(s.curriculum, userId, moduleId);

        // Reject locked modules — prerequisites must be completed first.
        const isLocked = moduleData.prerequisites.some(
          (prereq: string) => {
            const prereqProgress = s.curriculum.getModuleProgress(prereq);
            return !prereqProgress || prereqProgress.status !== 'completed';
          },
        );
        if (isLocked) return;

        // Idempotent: already completed modules do not receive additional points.
        if (progress.status === 'completed') return;

        progress.status = 'completed';
        // Do NOT auto-fill missing lessons — completion is a manual action.
        progress.trustScoreBoost = (progress.trustScoreBoost ?? 0) + 50;
        progress.lastUpdated = nowISO();
        saveProgressToLocalStorage(get().curriculum.userProgress);
      },
      false,
      'curriculum/completeModule',
    );
  },

  getModuleProgress: (moduleId: string) => {
    const { userProgress } = get().curriculum;
    const userId = 'current';
    const key = `${userId}:${moduleId}`;
    return userProgress[key];
  },

  getCompletedLessonCount: (moduleId: string) => {
    const progress = get().curriculum.getModuleProgress(moduleId);
    return progress?.lessonsCompleted.length ?? 0;
  },

  getModuleStatus: (moduleId: string) => {
    const progress = get().curriculum.getModuleProgress(moduleId);
    if (progress) {
      return progress.status;
    }
    // Derive lock status from prerequisites when no progress record exists yet.
    const moduleData = get().curriculum.catalog?.modules[moduleId];
    if (moduleData?.prerequisites.length) {
      const hasUnmetPrereq = moduleData.prerequisites.some(
        (prereq: string) => !get().curriculum.getModuleProgress(prereq) ||
          get().curriculum.getModuleProgress(prereq)!.status !== 'completed',
      );
      if (hasUnmetPrereq) return 'locked';
    }
    return 'available';
  },

  loadProgress: () => {
    set(
      (s: any) => {
        s.curriculum.userProgress = loadProgressFromLocalStorage();
      },
      false,
      'curriculum/loadProgress',
    );
  },
});
