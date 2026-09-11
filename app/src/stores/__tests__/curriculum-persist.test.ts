import { describe, it, expect, beforeEach } from 'vitest';
import { useRootStore, resetStore } from '../root-store';
import type { CurriculumCatalog } from '../slices/curriculum-slice';
import { initialCurriculumState } from '../slices/curriculum-slice';

const STORAGE_KEY = 'greensheet-store';

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
      lessons: ['lesson_1', 'lesson_2'],
    },
  },
};

describe('curriculum persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('persists curriculum catalog and user progress under greensheet-store', () => {
    useRootStore.getState().curriculum.setCatalog(catalog);
    useRootStore.getState().curriculum.markLessonComplete('mod_1', 'lesson_1');

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!);
    expect(persisted.state.curriculum).toBeDefined();

    const { curriculum } = persisted.state;
    expect(curriculum.catalog).toEqual(catalog);
    expect(curriculum.userProgress['current:mod_1']).toBeDefined();
    expect(
      curriculum.userProgress['current:mod_1'].lessonsCompleted,
    ).toContain('lesson_1');
  });

  it('persisted curriculum matches initial shape when nothing is set', () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw!);
    expect(persisted.state.curriculum).toEqual(initialCurriculumState);
  });
});
