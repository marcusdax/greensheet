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
      { name: 'CurriculumTestStore' },
    ),
  );
}

const catalog: CurriculumCatalog = {
  modules: {
    mod_1: {
      id: 'mod_1',
      title: 'Quality Foundations',
      description: 'Intro to quality standards',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'VN-DKL',
      track: 'quality',
      lessons: ['lesson_1', 'lesson_2', 'lesson_3'],
    },
    mod_2: {
      id: 'mod_2',
      title: 'EUDR Compliance',
      description: 'EUDR rules and traceability',
      level: 'intermediate',
      prerequisites: ['mod_1'],
      regionCode: 'ET-ORO',
      track: 'compliance',
      lessons: ['lesson_4', 'lesson_5'],
    },
  },
};

describe('curriculum slice', () => {
  let store: ReturnType<typeof buildStore>;

  beforeEach(() => {
    store = buildStore();
    store.getState().curriculum.setCatalog(catalog);
  });

  it('initializes with empty progress and null catalog', () => {
    const freshStore = buildStore();
    const state = freshStore.getState().curriculum;
    expect(state.userProgress).toEqual({});
    expect(state.catalog).toBeNull();
  });

  it('setCatalog stores the catalog', () => {
    const state = store.getState().curriculum;
    expect(state.catalog).not.toBeNull();
    expect(Object.keys(state.catalog!.modules)).toEqual(['mod_1', 'mod_2']);
  });

  it('markLessonComplete creates progress and advances status', () => {
    const { markLessonComplete, getModuleProgress } = store.getState().curriculum;
    markLessonComplete('mod_1', 'lesson_1');

    const progress = getModuleProgress('mod_1');
    expect(progress).toBeDefined();
    expect(progress!.lessonsCompleted).toContain('lesson_1');
    expect(progress!.status).toBe('in_progress');
  });

  it('markLessonComplete completes a module when all lessons are done', () => {
    const { markLessonComplete, getModuleStatus } = store.getState().curriculum;
    markLessonComplete('mod_1', 'lesson_1');
    markLessonComplete('mod_1', 'lesson_2');
    markLessonComplete('mod_1', 'lesson_3');

    expect(getModuleStatus('mod_1')).toBe('completed');
    const progress = store.getState().curriculum.getModuleProgress('mod_1');
    expect(progress!.trustScoreBoost).toBe(10);
  });

  it('markLessonComplete does not duplicate completed lessons', () => {
    const { markLessonComplete } = store.getState().curriculum;
    markLessonComplete('mod_1', 'lesson_1');
    markLessonComplete('mod_1', 'lesson_1');

    const progress = store.getState().curriculum.getModuleProgress('mod_1');
    expect(progress!.lessonsCompleted).toEqual(['lesson_1']);
  });

  it('completeModule marks status completed and boosts trust score', () => {
    const { completeModule, getModuleStatus } = store.getState().curriculum;
    completeModule('mod_2');

    expect(getModuleStatus('mod_2')).toBe('completed');
    const progress = store.getState().curriculum.getModuleProgress('mod_2');
    expect(progress!.lessonsCompleted).toEqual(['lesson_4', 'lesson_5']);
    expect(progress!.trustScoreBoost).toBe(50);
  });

  it('getCompletedLessonCount returns 0 for unknown module', () => {
    store.getState().curriculum.markLessonComplete('mod_1', 'lesson_1');
    expect(store.getState().curriculum.getCompletedLessonCount('mod_1')).toBe(1);
    expect(store.getState().curriculum.getCompletedLessonCount('unknown')).toBe(0);
  });

  it('getModuleStatus returns available for untouched modules', () => {
    const { getModuleStatus } = store.getState().curriculum;
    expect(getModuleStatus('mod_1')).toBe('available');
  });

  it('markLessonComplete unlocks a locked module to in_progress', () => {
    store.getState().curriculum.setCatalog(catalog);
    const userId = 'current';
    // Manually set status to locked to simulate a locked module via setState
    store.setState((s: TestStore) => {
      s.curriculum.userProgress[`${userId}:mod_1`] = {
        userId,
        moduleId: 'mod_1',
        status: 'locked',
        lessonsCompleted: [],
        lastUpdated: '2025-01-01T00:00:00.000Z',
      };
    });

    store.getState().curriculum.markLessonComplete('mod_1', 'lesson_1');
    const updated = store.getState().curriculum.getModuleProgress('mod_1');
    expect(updated!.status).toBe('in_progress');
    expect(updated!.lessonsCompleted).toContain('lesson_1');
  });

  it('completeModule preserves already-completed lessons and does not duplicate', () => {
    store.getState().curriculum.markLessonComplete('mod_2', 'lesson_4');
    store.getState().curriculum.completeModule('mod_2');
    const progress = store.getState().curriculum.getModuleProgress('mod_2');
    expect(progress!.status).toBe('completed');
    expect(progress!.lessonsCompleted).toEqual(['lesson_4', 'lesson_5']);
    expect(progress!.trustScoreBoost).toBe(50);
  });

  it('getCompletedLessonCount returns count of completed lessons for a module', () => {
    store.getState().curriculum.markLessonComplete('mod_1', 'lesson_1');
    store.getState().curriculum.markLessonComplete('mod_1', 'lesson_2');
    expect(store.getState().curriculum.getCompletedLessonCount('mod_1')).toBe(2);
  });
});
