import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  CurriculumTrack,
  CurriculumLevel,
  ModuleStatus,
  VerificationTieIn,
  CurriculumModule,
  CurriculumLesson,
  CurriculumMilestone,
  UserCurriculumProgress,
  VerificationTier,
  RegionCode,
  MediaAsset,
  MediaAssetType,
} from '../ledger';

describe('curriculum domain types', () => {
  describe('CurriculumTrack', () => {
    it('exposes exactly the four curriculum tracks', () => {
      expectTypeOf<CurriculumTrack>()
        .toEqualTypeOf<'quality' | 'compliance' | 'finance' | 'logistics'>();
    });

    it('rejects invalid track values at the type level', () => {
      expectTypeOf<CurriculumTrack>().not.toEqualTypeOf<'quality' | 'compliance'>();
    });
  });

  describe('CurriculumLevel', () => {
    it('has beginner, intermediate, and advanced', () => {
      expectTypeOf<CurriculumLevel>()
        .toEqualTypeOf<'beginner' | 'intermediate' | 'advanced'>();
    });
  });

  describe('ModuleStatus', () => {
    it('has the four lifecycle states', () => {
      expectTypeOf<ModuleStatus>()
        .toEqualTypeOf<'available' | 'locked' | 'in_progress' | 'completed'>();
    });
  });

  describe('VerificationTieIn', () => {
    it('aliases VerificationTier so tiers stay in sync', () => {
      expectTypeOf<VerificationTieIn>().toEqualTypeOf<VerificationTier>();
    });
  });

  describe('CurriculumModule', () => {
    const makeModule = (): CurriculumModule => ({
      id: 'mod_01',
      title: 'True Price Economics',
      description: 'Understanding the five-pillar subsistence ledger.',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'VN-DKL',
      track: 'finance',
      author: 'Auctum Curriculum Team',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    });

    it('constructs a module with all required fields', () => {
      const mod = makeModule();
      expect(mod.id).toBe('mod_01');
      expect(mod.track).toBe('finance');
      expect(mod.level).toBe('beginner');
      expect(mod.prerequisites).toEqual([]);
      expectTypeOf(mod.regionCode).toEqualTypeOf<RegionCode>();
    });

    it('accepts every track value', () => {
      const tracks: CurriculumTrack[] = ['quality', 'compliance', 'finance', 'logistics'];
      tracks.forEach((track) => {
        const mod = makeModule();
        mod.track = track;
        expect(mod.track).toBe(track);
      });
    });

    it('supports prerequisite module references', () => {
      const mod = makeModule();
      mod.prerequisites = ['mod_00', 'mod_00b'];
      expect(mod.prerequisites).toHaveLength(2);
      expect(mod.prerequisites).toContain('mod_00');
    });
  });

  describe('CurriculumLesson', () => {
    const makeLesson = (): CurriculumLesson => ({
      id: 'les_01',
      moduleId: 'mod_01',
      title: 'Lesson 1: Subsistence Floor',
      content: 'The $3.00/lb floor covers five pillars...',
      estimatedMinutes: 12,
      quizId: 'quiz_01',
      mediaAssets: [],
    });

    it('has sensible required defaults and optional fields', () => {
      const lesson = makeLesson();
      expect(lesson.quizId).toBe('quiz_01');
      expect(lesson.mediaAssets).toEqual([]);
      expectTypeOf(lesson.estimatedMinutes).toEqualTypeOf<number>();
    });

    it('allows lessons without a quiz or media assets', () => {
      const lesson: CurriculumLesson = {
        id: 'les_02',
        moduleId: 'mod_01',
        title: 'No quiz lesson',
        content: 'Reading material only.',
        estimatedMinutes: 5,
      };
      expect(lesson.quizId).toBeUndefined();
      expect(lesson.mediaAssets).toBeUndefined();
    });

    it('associates media assets with the lesson', () => {
      const asset: MediaAsset = {
        id: 'media_01',
        type: 'photo' as MediaAssetType,
        url: 'https://example.com/img.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        caption: 'Farm photo',
        takenAt: '2024-01-15T00:00:00Z',
        capturedByAgent: true,
      };
      const lesson = makeLesson();
      lesson.mediaAssets = [asset];
      expect(lesson.mediaAssets).toHaveLength(1);
      expect(lesson.mediaAssets![0].type).toBe('photo');
    });
  });

  describe('CurriculumMilestone', () => {
    const makeMilestone = (): CurriculumMilestone => ({
      id: 'mil_01',
      moduleId: 'mod_01',
      lessonCount: 5,
      verificationTier: 'audit_verified',
      badgeId: 'badge_true_price',
      unlocks: ['mod_02'],
    });

    it('tracks lesson count and verification tier', () => {
      const mil = makeMilestone();
      expect(mil.lessonCount).toBe(5);
      expect(mil.verificationTier).toBe('audit_verified');
    });

    it('optionally gates module completion on unlocks', () => {
      const mil = makeMilestone();
      expect(mil.unlocks).toContain('mod_02');
    });

    it('makes badgeId and unlocks optional', () => {
      const minimal: CurriculumMilestone = {
        id: 'mil_minimal',
        moduleId: 'mod_01',
        lessonCount: 1,
        verificationTier: 'self_declared',
      };
      expect(minimal.badgeId).toBeUndefined();
      expect(minimal.unlocks).toBeUndefined();
    });
  });

  describe('UserCurriculumProgress', () => {
    const makeProgress = (): UserCurriculumProgress => ({
      userId: 'user_01',
      moduleId: 'mod_01',
      status: 'in_progress',
      lessonsCompleted: ['les_01'],
      lastUpdated: '2024-02-01T00:00:00Z',
      trustScoreBoost: 5,
    });

    it('starts in_progress with completed lessons', () => {
      const prog = makeProgress();
      expect(prog.status).toBe('in_progress');
      expect(prog.lessonsCompleted).toContain('les_01');
      expect(prog.trustScoreBoost).toBe(5);
    });

    it('can transition to completed with empty remaining lessons', () => {
      const prog = makeProgress();
      prog.status = 'completed';
      prog.lessonsCompleted = ['les_01', 'les_02', 'les_03'];
      prog.lastUpdated = '2024-02-05T00:00:00Z';
      expect(prog.status).toBe('completed');
      expect(prog.lessonsCompleted).toHaveLength(3);
    });

    it('supports a locked status with no completed lessons', () => {
      const prog: UserCurriculumProgress = {
        userId: 'user_02',
        moduleId: 'mod_02',
        status: 'locked',
        lessonsCompleted: [],
        lastUpdated: '2024-01-01T00:00:00Z',
      };
      expect(prog.status).toBe('locked');
      expect(prog.lessonsCompleted).toEqual([]);
      expect(prog.trustScoreBoost).toBeUndefined();
    });
  });
});
