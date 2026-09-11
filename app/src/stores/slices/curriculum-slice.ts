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
        if (progress.status === 'locked') {
          progress.status = 'in_progress';
        }
        if (!progress.lessonsCompleted.includes(lessonId)) {
          progress.lessonsCompleted.push(lessonId);
        }
        if (progress.status === 'available' || progress.status === 'in_progress') {
          progress.status = 'in_progress';
        }
        const moduleData = s.curriculum.catalog?.modules[moduleId];
        if (moduleData && progress.lessonsCompleted.length >= moduleData.lessons.length) {
          progress.status = 'completed';
          progress.trustScoreBoost = (progress.trustScoreBoost ?? 0) + 10;
        }
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
        const progress = ensureProgress(s.curriculum, userId, moduleId);
        progress.status = 'completed';
        const moduleData = s.curriculum.catalog?.modules[moduleId];
        if (moduleData && progress.lessonsCompleted.length < moduleData.lessons.length) {
          moduleData.lessons.forEach((lessonId: string) => {
            if (!progress.lessonsCompleted.includes(lessonId)) {
              progress.lessonsCompleted.push(lessonId);
            }
          });
        }
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
    return progress?.status ?? 'available';
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
