import { describe, it, expect } from 'vitest';
import enUS from '../../../../localization/02-locale-files/en-US.json';
import esMX from '../../../../localization/02-locale-files/es-MX.json';
import ptBR from '../../../../localization/02-locale-files/pt-BR.json';
import zhCN from '../../../../localization/02-locale-files/zh-CN.json';

const locales = {
  'en-US': enUS,
  'es-MX': esMX,
  'pt-BR': ptBR,
  'zh-CN': zhCN,
} as const;

const curriculumKeys = [
  'title',
  'overline',
  'subtitle',
  'tabs',
  'noProgress',
  'trackHeader',
  'tracks',
  'trackDesc',
  'moduleCount_one',
  'moduleCount_other',
  'progress',
  'viewTrack',
  'noTrack',
  'noModule',
  'lessonControls',
  'ariaLabel',
  'authoring',
] as const;

const nestedCurriculumKeys = {
  tabs: ['overview', 'lessons', 'progress'],
  trackHeader: [
    'author',
    'region',
    'prerequisites',
    'milestoneBadge',
    'lessonCompletion',
    'moduleStatus',
    'trustScoreBoost',
  ],
  tracks: ['quality', 'compliance', 'finance', 'logistics'],
  trackDesc: ['quality', 'compliance', 'finance', 'logistics'],
  progress: ['notStarted', 'inProgress', 'completed', 'locked'],
  lessonControls: ['markComplete', 'review', 'completed', 'completedMessage', 'completeModule'],
  ariaLabel: ['courseTabs', 'markLessonComplete', 'reviewModule', 'lessonComplete', 'completeModule'],
  authoring: [
    'title',
    'topicLabel',
    'topicPlaceholder',
    'trackLabel',
    'levelLabel',
    'regionLabel',
    'generateBtn',
    'saveBtn',
    'cancelBtn',
    'outlineLabel',
    'contentLabel',
    'quizLabel',
    'generated',
    'editMode',
    'saveSuccess',
    'saveError',
  ],
} as const;

describe('curriculum locale coverage', () => {
  for (const [locale, file] of Object.entries(locales)) {
    it(`${locale} includes the complete curriculum namespace`, () => {
      expect(file.curriculum).toBeDefined();

      for (const key of curriculumKeys) {
        expect(file.curriculum, `${locale}.${key}`).toHaveProperty(key);
      }

      for (const [section, keys] of Object.entries(nestedCurriculumKeys)) {
        for (const key of keys) {
          expect(file.curriculum[section], `${locale}.curriculum.${section}.${key}`).toHaveProperty(key);
        }
      }

      expect(Object.keys(file.curriculum.authoring)).toEqual(nestedCurriculumKeys.authoring);
    });

    it(`${locale} has no empty curriculum strings`, () => {
      const emptyValues: string[] = [];

      const visit = (value: unknown, path: string) => {
        if (typeof value === 'string' && value.trim() === '') {
          emptyValues.push(path);
        } else if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value)) {
            visit(child, `${path}.${key}`);
          }
        }
      };

      visit(file.curriculum, 'curriculum');
      expect(emptyValues, JSON.stringify(emptyValues)).toEqual([]);
    });
  }
});
