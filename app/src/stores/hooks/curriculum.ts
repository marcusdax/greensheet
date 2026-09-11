import { useRootStore } from '../root-store';

export const useCurriculum = () => useRootStore((s) => s.curriculum);
export const useCurriculumCatalog = () => useRootStore((s) => s.curriculum.catalog);
export const useUserCurriculumProgress = () => useRootStore((s) => s.curriculum.userProgress);
export const useCurriculumUserProgress = () => useRootStore((s) => s.curriculum.getModuleProgress);
export const useCompletedLessonCount = () => useRootStore((s) => s.curriculum.getCompletedLessonCount);
export const useModuleStatus = () => useRootStore((s) => s.curriculum.getModuleStatus);
export const useCurriculumActions = () => {
  const setCatalog = useRootStore((s) => s.curriculum.setCatalog);
  const markLessonComplete = useRootStore((s) => s.curriculum.markLessonComplete);
  const completeModule = useRootStore((s) => s.curriculum.completeModule);
  return { setCatalog, markLessonComplete, completeModule };
};

/**
 * Returns the store-backed progress slice for a single module, plus derived
 * loading flags. Components use this to drive completion UI without touching
 * useModuleData.
 */
export const useModuleProgress = (moduleId: string) => {
  const getModuleProgress = useRootStore((s) => s.curriculum.getModuleProgress);
  const getCompletedLessonCount = useRootStore((s) => s.curriculum.getCompletedLessonCount);
  const getModuleStatus = useRootStore((s) => s.curriculum.getModuleStatus);

  const progress = getModuleProgress(moduleId);
  const status = getModuleStatus(moduleId);
  const completedCount = getCompletedLessonCount(moduleId);
  const completedLessons = progress?.lessonsCompleted ?? [];

  return { progress, status, completedLessons, completedCount };
};