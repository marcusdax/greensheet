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