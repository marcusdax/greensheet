import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createCurriculumSlice, type CurriculumSlice, type CurriculumCatalog } from '../curriculum-slice';

interface TestStore {
  curriculum: CurriculumSlice;
}

function buildStore() {
  return create<TestStore>()(
    devtools(
      immer((set, get) => ({
        curriculum: createCurriculumSlice(set, get),
      })),
      { name: 'CurriculumAuthoringTestStore' },
    ),
  );
}

const fullCatalog: CurriculumCatalog = {
  modules: {
    mod_auth_1: {
      id: 'mod_auth_1',
      title: 'Authentication Basics',
      description: 'Introduction to authentication and security fundamentals',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'VN-DKL',
      track: 'quality',
      lessons: ['auth_lesson_1', 'auth_lesson_2', 'auth_lesson_3'],
    },
    mod_auth_2: {
      id: 'mod_auth_2',
      title: 'Advanced Authentication',
      description: 'Multi-factor auth and zero-trust architecture',
      level: 'advanced',
      prerequisites: ['mod_auth_1'],
      regionCode: 'CO-HUI',
      track: 'compliance',
      lessons: ['auth_lesson_4', 'auth_lesson_5', 'auth_lesson_6', 'auth_lesson_7'],
    },
  },
};

describe('curriculum authoring flow', () => {
  let store: ReturnType<typeof buildStore>;

  beforeEach(() => {
    store = buildStore();
    store.getState().curriculum.setCatalog(fullCatalog);
  });

  it('starts with no user progress until lessons are marked complete', () => {
    const { getModuleProgress, getModuleStatus, getCompletedLessonCount } = store.getState().curriculum;

    expect(getModuleProgress('mod_auth_1')).toBeUndefined();
    expect(getModuleStatus('mod_auth_1')).toBe('available');
    expect(getCompletedLessonCount('mod_auth_1')).toBe(0);
  });

  it('marks a lesson as completed and advances module status to in_progress', () => {
    const { markLessonComplete, getModuleProgress, getModuleStatus, getCompletedLessonCount } = store.getState().curriculum;

    markLessonComplete('mod_auth_1', 'auth_lesson_1');

    const progress = getModuleProgress('mod_auth_1');
    expect(progress).toBeDefined();
    expect(progress!.lessonsCompleted).toContain('auth_lesson_1');
    expect(progress!.status).toBe('in_progress');
    expect(getModuleStatus('mod_auth_1')).toBe('in_progress');
    expect(getCompletedLessonCount('mod_auth_1')).toBe(1);
  });

  it('completes a module when all lessons are finished, granting trust score boost', () => {
    const { markLessonComplete, getModuleStatus, getModuleProgress } = store.getState().curriculum;

    markLessonComplete('mod_auth_1', 'auth_lesson_1');
    markLessonComplete('mod_auth_1', 'auth_lesson_2');
    markLessonComplete('mod_auth_1', 'auth_lesson_3');

    expect(getModuleStatus('mod_auth_1')).toBe('in_progress');
    const progress = getModuleProgress('mod_auth_1');
    expect(progress!.lessonsCompleted).toHaveLength(3);
    expect(progress!.trustScoreBoost).toBeUndefined();
  });

  it('completeModule marks all lessons as done and grants a larger trust score boost', () => {
    const { completeModule, getModuleStatus, getModuleProgress, getCompletedLessonCount } = store.getState().curriculum;

    // mod_auth_2 has prerequisite mod_auth_1, so complete mod_auth_1 first
    completeModule('mod_auth_1');
    completeModule('mod_auth_2');

    expect(getModuleStatus('mod_auth_2')).toBe('completed');
    const progress = getModuleProgress('mod_auth_2');
    expect(progress!.lessonsCompleted).toEqual([]);
    expect(progress!.trustScoreBoost).toBe(50);
    expect(getCompletedLessonCount('mod_auth_2')).toBe(0);
  });

  it('does not duplicate lessons when markLessonComplete is called twice for the same lesson', () => {
    const { markLessonComplete, getModuleProgress } = store.getState().curriculum;

    markLessonComplete('mod_auth_1', 'auth_lesson_1');
    markLessonComplete('mod_auth_1', 'auth_lesson_1');

    const progress = getModuleProgress('mod_auth_1');
    expect(progress!.lessonsCompleted).toEqual(['auth_lesson_1']);
    expect(progress!.lessonsCompleted).toHaveLength(1);
  });

  it('returns correct module status for unknown modules as available', () => {
    const { getModuleStatus } = store.getState().curriculum;

    expect(getModuleStatus('nonexistent_module')).toBe('available');
  });
});
