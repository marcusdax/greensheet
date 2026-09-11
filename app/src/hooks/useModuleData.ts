import type { CurriculumModule, CurriculumLesson, CurriculumMilestone, UserCurriculumProgress } from '../types/ledger';

export interface ModuleData {
  module: CurriculumModule;
  lessons: CurriculumLesson[];
  milestone: CurriculumMilestone | null;
  progress: UserCurriculumProgress | null;
}

export function useModuleData(moduleId: string): ModuleData {
  const module: CurriculumModule = {
    id: moduleId,
    title: 'Quality Foundations',
    description: 'An introductory module covering green coffee quality fundamentals, sensory evaluation, and EUDR compliance basics.',
    level: 'beginner',
    prerequisites: [],
    regionCode: 'VN-DKL',
    track: 'quality',
    author: 'Auctum Curriculum Team',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
  };

  const lessons: CurriculumLesson[] = [
    {
      id: 'lesson_1',
      moduleId,
      title: 'Introduction to Green Coffee Quality',
      content: 'Green coffee quality starts in the cherry. This lesson covers...',
      estimatedMinutes: 8,
    },
    {
      id: 'lesson_2',
      moduleId,
      title: 'Sensory Evaluation Basics',
      content: 'Sensory evaluation is the backbone of quality assessment...',
      estimatedMinutes: 12,
    },
    {
      id: 'lesson_3',
      moduleId,
      title: 'EUDR Traceability Requirements',
      content: 'The EU Deforestation Regulation requires...',
      estimatedMinutes: 15,
    },
  ];

  const milestone: CurriculumMilestone = {
    id: 'milestone_1',
    moduleId,
    lessonCount: lessons.length,
    verificationTier: 'agent_verified',
    badgeId: 'badge_quality_foundation',
    unlocks: ['track_quality_complete'],
  };

  const progress: UserCurriculumProgress | null = null;

  return { module, lessons, milestone, progress };
}
