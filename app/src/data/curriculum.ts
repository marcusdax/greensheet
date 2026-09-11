/**
 * Auctum Ledger — Curriculum Seed Data
 *
 * Seeded curriculum catalog used to bootstrap the root curriculum slice.
 * Modules are grounded in the Auctum Ledger domain: quality, EUDR compliance,
 * financial literacy (True Price Floor), and post-harvest logistics.
 *
 * This is the canonical seed catalog consumed by the root store on first run.
 */
import type { CurriculumCatalog, CurriculumModuleData } from '../stores/slices/curriculum-slice';
import type { CurriculumTrack, CurriculumLesson, CurriculumMilestone, CurriculumModule, RegionCode } from '../types/ledger';

export const curriculumTrackKeys: CurriculumTrack[] = ['quality', 'compliance', 'finance', 'logistics'];

export const SEED_CATALOG: CurriculumCatalog = {
  modules: {
    mod_q_1: {
      id: 'mod_q_1',
      title: 'Quality Foundations',
      description: 'SCA cupping protocol, sensory calibration, and defect recognition.',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'VN-DKL',
      track: 'quality',
      lessons: ['q_lesson_1', 'q_lesson_2', 'q_lesson_3', 'q_lesson_4'],
    },
    mod_c_1: {
      id: 'mod_c_1',
      title: 'EUDR Compliance & Traceability',
      description: 'Deforestation monitoring, geo-mapping, and EUDR due-diligence reporting.',
      level: 'intermediate',
      prerequisites: ['mod_q_1'],
      regionCode: 'VN-DKL',
      track: 'compliance',
      lessons: ['c_lesson_1', 'c_lesson_2', 'c_lesson_3'],
    },
    mod_f_1: {
      id: 'mod_f_1',
      title: 'Financial Literacy & True Price Floor',
      description: 'Farm budgets, subsistence ledger, and futures market simulations.',
      level: 'beginner',
      prerequisites: [],
      regionCode: 'ET-ORO',
      track: 'finance',
      lessons: ['f_lesson_1', 'f_lesson_2'],
    },
    mod_l_1: {
      id: 'mod_l_1',
      title: 'Logistics & Post-Harvest Handling',
      description: 'Drying mechanics, storage pest management, and shipping documentation.',
      level: 'intermediate',
      prerequisites: ['mod_q_1'],
      regionCode: 'CO-HUI',
      track: 'logistics',
      lessons: ['l_lesson_1', 'l_lesson_2', 'l_lesson_3', 'l_lesson_4', 'l_lesson_5'],
    },
  },
};

export function getModuleById(moduleId: string): CurriculumModuleData | undefined {
  return SEED_CATALOG.modules[moduleId];
}

/**
 * Resolves all modules for a given track from the seed catalog.
 */
export function getModulesByTrack(track: CurriculumTrack): CurriculumModuleData[] {
  return Object.values(SEED_CATALOG.modules).filter((m) => m.track === track);
}

/**
 * Convenience accessor returning the first module ID for a track, or null
 * if the track has no modules.
 */
export function getFirstModuleIdForTrack(track: CurriculumTrack): string | null {
  const modules = getModulesByTrack(track);
  return modules.length > 0 ? modules[0].id : null;
}

/**
 * Seeded lesson detail records keyed by lesson id.
 *
 * The root-store catalog stores lesson ids as a lightweight string array on each
 * module (see CurriculumModuleData.lessons). The CoursePlayer needs the full
 * lesson objects to render titles, content and estimated duration, so they are
 * resolved here from this seed map.
 */
export const SEED_LESSONS: Record<string, CurriculumLesson> = {
  q_lesson_1: {
    id: 'q_lesson_1',
    moduleId: 'mod_q_1',
    title: 'Introduction to Green Coffee Quality',
    content: 'Green coffee quality starts in the cherry. This lesson covers selective harvesting, moisture management, and how the post-harvest chain affects the final cup.',
    estimatedMinutes: 8,
  },
  q_lesson_2: {
    id: 'q_lesson_2',
    moduleId: 'mod_q_1',
    title: 'Sensory Evaluation Basics',
    content: 'Sensory evaluation is the backbone of quality assessment. Learn to identify aromatics, acidity, body, and defect attributes using the SCA cupping protocol.',
    estimatedMinutes: 12,
  },
  q_lesson_3: {
    id: 'q_lesson_3',
    moduleId: 'mod_q_1',
    title: 'SCA Cupping Protocol',
    content: 'Master the standardized SCA cupping procedure: lighting, grinding, steeping, and scoring across the 100-point sensory spectrum.',
    estimatedMinutes: 20,
  },
  q_lesson_4: {
    id: 'q_lesson_4',
    moduleId: 'mod_q_1',
    title: 'Defect Recognition & Taint Identification',
    content: 'Identify primary and secondary defects in green coffee, understand formation causes, and learn how to mitigate taints during processing.',
    estimatedMinutes: 15,
  },
  c_lesson_1: {
    id: 'c_lesson_1',
    moduleId: 'mod_c_1',
    title: 'EUDR Deforestation Risk',
    content: 'The EU Deforestation Regulation requires proof that no forest conversion occurred. Learn risk indicators and geo-assessment workflows.',
    estimatedMinutes: 10,
  },
  c_lesson_2: {
    id: 'c_lesson_2',
    moduleId: 'mod_c_1',
    title: 'Geo-Mapping & Polygon Capture',
    content: 'Capture plot polygons, verify GPS accuracy, and record administrative region data for EUDR due-diligence compliance.',
    estimatedMinutes: 18,
  },
  c_lesson_3: {
    id: 'c_lesson_3',
    moduleId: 'mod_c_1',
    title: 'Due-Diligence Reporting',
    content: 'Build and submit the EUDR due-diligence report, including risk assessments and supplier traceability chains.',
    estimatedMinutes: 14,
  },
  f_lesson_1: {
    id: 'f_lesson_1',
    moduleId: 'mod_f_1',
    title: 'The Five-Pillar Subsistence Ledger',
    content: 'The $3.00/lb True Price Floor covers household, operating, debt, infrastructure, and resilience costs. Calculate break-evens per farm.',
    estimatedMinutes: 15,
  },
  f_lesson_2: {
    id: 'f_lesson_2',
    moduleId: 'mod_f_1',
    title: 'Futures Markets & Price Discovery',
    content: 'Read coffee futures curves, understand ICE ICE contract mechanics, and forecast price volatility by origin.',
    estimatedMinutes: 22,
  },
  l_lesson_1: {
    id: 'l_lesson_1',
    moduleId: 'mod_l_1',
    title: 'Drying Mechanics',
    content: 'Control moisture migration from cherry to exportable green: drying tables, parabolic dryers, and hermetic storage principles.',
    estimatedMinutes: 16,
  },
  l_lesson_2: {
    id: 'l_lesson_2',
    moduleId: 'mod_l_1',
    title: 'Storage Pest Management',
    content: 'Identify key storage pests, implement IPM protocols, and monitor infestation thresholds across the post-harvest chain.',
    estimatedMinutes: 24,
  },
  l_lesson_3: {
    id: 'l_lesson_3',
    moduleId: 'mod_l_1',
    title: 'Shipping Documentation',
    content: 'Master phytosanitary certificates, origin certificates, and bill of lading requirements for international coffee exports.',
    estimatedMinutes: 13,
  },
  l_lesson_4: {
    id: 'l_lesson_4',
    moduleId: 'mod_l_1',
    title: 'Cold Chain & Container Conditioning',
    content: 'Maintain green coffee quality through temperature and humidity control during ocean freight and container stuffing.',
    estimatedMinutes: 15,
  },
  l_lesson_5: {
    id: 'l_lesson_5',
    moduleId: 'mod_l_1',
    title: 'Inventory Rotation & FIFO',
    content: 'Apply first-in-first-out rotation, track age by lot, and minimize quality degradation over extended storage periods.',
    estimatedMinutes: 11,
  },
};

/**
 * Seeded milestone records keyed by module id.
 *
 * Milestones grant badges and unlock downstream content when a module is completed.
 */
export const SEED_MILESTONES: Record<string, CurriculumMilestone> = {
  mod_q_1: {
    id: 'milestone_q_1',
    moduleId: 'mod_q_1',
    lessonCount: 4,
    verificationTier: 'agent_verified',
    badgeId: 'badge_quality_foundation',
    unlocks: ['track_quality_complete'],
  },
  mod_c_1: {
    id: 'milestone_c_1',
    moduleId: 'mod_c_1',
    lessonCount: 3,
    verificationTier: 'audit_verified',
    badgeId: 'badge_eudr_compliance',
    unlocks: ['track_compliance_complete'],
  },
  mod_f_1: {
    id: 'milestone_f_1',
    moduleId: 'mod_f_1',
    lessonCount: 2,
    verificationTier: 'self_declared',
    badgeId: 'badge_true_price',
    unlocks: [],
  },
  mod_l_1: {
    id: 'milestone_l_1',
    moduleId: 'mod_l_1',
    lessonCount: 5,
    verificationTier: 'agent_verified',
    badgeId: 'badge_post_harvest',
    unlocks: ['track_logistics_complete'],
  },
};

/**
 * Seeded module-author mapping keyed by module id.
 *
 * The CurriculumModule base type does not carry author metadata; the CoursePlayer
 * surface resolves the author from this map.
 */
export const SEED_MODULE_AUTHORS: Record<string, string> = {
  mod_q_1: 'Auctum Curriculum Team',
  mod_c_1: 'Auctum Compliance Team',
  mod_f_1: 'Auctum Finance Team',
  mod_l_1: 'Auctum Logistics Team',
};

/**
 * Resolves the full lesson objects for a module from the seed lesson map.
 */
export function getLessonsForModule(moduleId: string): CurriculumLesson[] {
  return SEED_LESSONS[moduleId]
    ? Object.values(SEED_LESSONS).filter((l) => l.moduleId === moduleId)
    : [];
}

/**
 * Resolves the milestone for a module, or null when none is defined.
 */
export function getMilestoneForModule(moduleId: string): CurriculumMilestone | null {
  return SEED_MILESTONES[moduleId] ?? null;
}

/**
 * Resolves the author label for a module, or null when none is defined.
 */
export function getModuleAuthor(moduleId: string): string | null {
  return SEED_MODULE_AUTHORS[moduleId] ?? null;
}

/**
 * Resolves the full CurriculumModule (with author/region/createdAt) for display.
 * Falls back to constructing one from the catalog module data when no seed
 * module record exists.
 */
export function getCurriculumModule(moduleId: string): CurriculumModule | undefined {
  const catalogModule = getModuleById(moduleId);
  if (!catalogModule) return undefined;

  const author = getModuleAuthor(moduleId);
  const iso = '2025-01-15T00:00:00.000Z';
  return {
    id: catalogModule.id,
    title: catalogModule.title,
    description: catalogModule.description,
    level: catalogModule.level,
    prerequisites: catalogModule.prerequisites,
    regionCode: catalogModule.regionCode as RegionCode,
    track: catalogModule.track,
    author: author ?? 'Auctum Curriculum Team',
    createdAt: iso,
    updatedAt: iso,
  };
}
