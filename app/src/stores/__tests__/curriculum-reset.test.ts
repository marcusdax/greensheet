import { resetStore } from '../root-store';
import { useRootStore } from '../root-store';
import { initialCurriculumState } from '../slices/curriculum-slice';

describe('resetStore() curriculum reset', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset store to clean state
    resetStore();
  });

  it('should reset curriculum slice to initial state when called', () => {
    // Get initial state — check state portion matches initialCurriculumState
    const initialState = useRootStore.getState().curriculum;
    expect(initialState.userProgress).toEqual(initialCurriculumState.userProgress);
    expect(initialState.catalog).toBe(initialCurriculumState.catalog);

    // Modify curriculum state
    useRootStore.setState((state) => {
      state.curriculum.catalog = {
        modules: {
          'test-module': {
            id: 'test-module',
            title: 'Test Module',
            description: 'Test Description',
            level: 'beginner',
            prerequisites: [],
            regionCode: 'US',
            track: 'quality',
            author: 'Test Author',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };
      state.curriculum.userProgress = {
        'current:test-module': {
          userId: 'current',
          moduleId: 'test-module',
          status: 'completed',
          lessonsCompleted: ['lesson_1'],
          lastUpdated: new Date().toISOString(),
          trustScoreBoost: 50,
        },
      };
    });

    // Verify state was modified
    const modifiedState = useRootStore.getState().curriculum;
    expect(modifiedState.catalog).not.toBeNull();
    expect(modifiedState.catalog?.modules['test-module']).toBeDefined();
    expect(modifiedState.userProgress['current:test-module']).toBeDefined();

    // Call resetStore
    resetStore();

    // Verify state is reset to initial
    const resetState = useRootStore.getState().curriculum;
    expect(resetState.userProgress).toEqual(initialCurriculumState.userProgress);
    expect(resetState.catalog).toBe(initialCurriculumState.catalog);
  });
});