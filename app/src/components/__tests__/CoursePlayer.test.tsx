import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CoursePlayer, type CourseTab } from '../CoursePlayer';
import '../../i18n';
import { useRootStore, resetStore } from '../../stores/root-store';
import { SEED_CATALOG } from '../../data/curriculum';
import type { CurriculumCatalog } from '../../stores/slices/curriculum-slice';

// Ensure document/window are available for jsdom environment
if (typeof globalThis.document === 'undefined') {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  (globalThis as any).document = dom.window.document;
  (globalThis as any).window = dom.window;
}

const MODULE_ID = 'mod_q_1';

function seedStore(catalog: CurriculumCatalog) {
  resetStore();
  useRootStore.getState().curriculum.setCatalog(catalog);
}

describe('CoursePlayer', () => {
  const onTabChange = vi.fn();

  beforeEach(() => {
    onTabChange.mockClear();
    seedStore(SEED_CATALOG);
  });

  it('renders the module title and description in the header from the store', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    expect(screen.getByText('Quality Foundations')).toBeInTheDocument();
    expect(screen.getByText(/SCA cupping protocol, sensory calibration, and defect recognition/i)).toBeInTheDocument();
  });

  it('renders all three tab buttons', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    const tablist = screen.getByRole('tablist');
    const tabButtons = within(tablist).getAllByRole('tab');
    expect(tabButtons).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lessons/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Progress/i })).toBeInTheDocument();
  });

  it('switches tabs and fires onTabChange callback', () => {
    render(<CoursePlayer moduleId={MODULE_ID} onTabChange={onTabChange} />);

    // Initially overview is shown
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-lessons')).not.toBeInTheDocument();

    // Click lessons tab
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    expect(screen.getByTestId('tab-lessons')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-overview')).not.toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('lessons');

    // Click progress tab
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));
    expect(screen.getByTestId('tab-progress')).toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('progress');
  });

  it('renders the lessons list in the lessons tab from the store catalog', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    const lessonsTab = screen.getByTestId('tab-lessons');
    expect(within(lessonsTab).getByText('Introduction to Green Coffee Quality')).toBeInTheDocument();
    expect(within(lessonsTab).getByText('Sensory Evaluation Basics')).toBeInTheDocument();
    expect(within(lessonsTab).getByText('SCA Cupping Protocol')).toBeInTheDocument();
  });

  it('renders the progress tab with no-progress state initially', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    const progressTab = screen.getByTestId('tab-progress');
    expect(within(progressTab).getByText(/No progress recorded yet/i)).toBeInTheDocument();
    expect(within(progressTab).getByText('0/4 Progress')).toBeInTheDocument();
  });

  it('applies aria-selected to the active tab', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));
    const lessonsTab = screen.getByRole('tab', { name: /Lessons/i });
    expect(lessonsTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveAttribute('aria-selected', 'false');
  });

  it('renders module metadata in the overview tab', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);

    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('Auctum Curriculum Team')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('VN-DKL')).toBeInTheDocument();
  });

  it('renders milestone badge in overview when present', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    expect(screen.getByText('Milestone Badge')).toBeInTheDocument();
    expect(screen.getByText('badge_quality_foundation')).toBeInTheDocument();
  });

  it('renders estimated minutes and level/track badges in header', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);

    // Total: 8 + 12 + 20 + 15 = 55 min
    expect(screen.getByText('~55 min')).toBeInTheDocument();
    expect(screen.getByText('beginner')).toBeInTheDocument();
    expect(screen.getByText('quality')).toBeInTheDocument();
  });

  it('renders a Mark Complete button for each incomplete lesson', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(4);
    expect(screen.getByTestId('mark-complete-q_lesson_1')).toHaveTextContent('Mark Complete');
  });

  it('marking a lesson complete hides its Mark Complete button and advances module status', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    const before = screen.getAllByTestId(/mark-complete-/);
    expect(before).toHaveLength(4);

    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));

    // q_lesson_1 is now complete, removing its Mark Complete button
    expect(screen.queryByTestId('mark-complete-q_lesson_1')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(3);

    // Progress in store reflects the completed lesson
    const progress = useRootStore.getState().curriculum.getModuleProgress(MODULE_ID);
    expect(progress?.lessonsCompleted).toContain('q_lesson_1');
    expect(progress?.status).toBe('in_progress');
  });

  it('shows the Progress tab completion percentage after marking lessons', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    const progressTab = screen.getByTestId('tab-progress');
    // 2/4 = 50%
    expect(within(progressTab).getByText('2/4 Progress')).toBeInTheDocument();
    expect(within(progressTab).getByText('in_progress')).toBeInTheDocument();
  });

  it('shows a Review button once the module is fully completed', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    // Complete all lessons
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // With the new contract, markLessonComplete does NOT auto-complete the module.
    // Switch to Progress tab to click Complete Module
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    // Click Complete Module to finish it
    fireEvent.click(screen.getByTestId('complete-module'));

    // Switch back to Lessons tab to see the Review button
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    expect(screen.getByTestId('review-module')).toBeInTheDocument();
    expect(screen.getByTestId('review-module')).toHaveTextContent('Review');
  });

  it('clicking Review keeps the completed module complete via the store', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // Switch to Progress tab to click Complete Module
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    // Complete the module via the Complete Module button first
    fireEvent.click(screen.getByTestId('complete-module'));

    // Switch back to Lessons tab to click Review
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    fireEvent.click(screen.getByTestId('review-module'));

    const progress = useRootStore.getState().curriculum.getModuleProgress(MODULE_ID);
    expect(progress?.status).toBe('completed');
    expect(progress?.lessonsCompleted).toEqual(['q_lesson_1', 'q_lesson_2', 'q_lesson_3', 'q_lesson_4']);
    // completeModule grants +50; Review is idempotent and does not re-grant.
    expect(progress?.trustScoreBoost).toBe(50);
  });

  it('renders a not-found message for an unknown module', () => {
    render(<CoursePlayer moduleId="unknown_module" />);
    expect(screen.getByText(/Module not found/i)).toBeInTheDocument();
  });

  it('shows a Complete Module button in progress tab when all lessons are completed', () => {
    render(<CoursePlayer moduleId={MODULE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    // Complete all lessons to reach 'in_progress' status via markLessonComplete
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // Since all 4 lessons are completed, status is 'in_progress'
    // The Complete Module button should appear in the Progress tab
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    const progress = useRootStore.getState().curriculum.getModuleProgress(MODULE_ID);
    expect(progress?.status).toBe('in_progress');
    expect(screen.getByTestId('complete-module')).toBeInTheDocument();
  });

  describe('Complete Module button in progress tab', () => {
    beforeEach(() => {
      // Use a separate module with 2 lessons so we can complete them all
      // and verify the Complete Module button appears before clicking Review.
      const catalog: CurriculumCatalog = {
        modules: {
          mod_test: {
            id: 'mod_test',
            title: 'Test Module',
            description: 'A test module for complete-module button',
            level: 'beginner',
            prerequisites: [],
            regionCode: 'VN-DKL',
            track: 'quality',
            lessons: ['q_lesson_1', 'q_lesson_2'],
          },
        },
      };
      seedStore(catalog);
    });

    it('shows Complete Module button when all lessons done but module not yet completed', () => {
      render(<CoursePlayer moduleId="mod_test" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      // Complete both lessons — this sets status to 'in_progress' via markLessonComplete
      fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
      fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));

      // After completing all lessons, status is 'in_progress' so Complete Module button should appear
      fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

      expect(screen.getByTestId('complete-module')).toBeInTheDocument();
    });

    it('clicking Complete Module from progress tab completes the module and grants +50 trust score', () => {
      render(<CoursePlayer moduleId="mod_test" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      // Mark one lesson complete to get status to in_progress
      fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));

      // Navigate to progress tab — only 1 of 2 lessons done, so no Complete Module button
      fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));
      expect(screen.queryByTestId('complete-module')).not.toBeInTheDocument();

      // Now complete the second lesson
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));
      fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));

      // Navigate to progress tab — both lessons done, Complete Module button should appear
      fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));
      expect(screen.getByTestId('complete-module')).toBeInTheDocument();

      // Click Complete Module
      fireEvent.click(screen.getByTestId('complete-module'));

      const progress = useRootStore.getState().curriculum.getModuleProgress('mod_test');
      expect(progress?.status).toBe('completed');
      expect(progress?.trustScoreBoost).toBe(50);
    });
  });

  describe('backward compatibility fallback (no store catalog seed)', () => {
    beforeEach(() => {
      // Reset to a truly empty store so fallback is exercised
      resetStore();
    });

    it('renders Quality Foundations from fallback seed when moduleId is mod_1 and store is empty', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      expect(screen.getByText('Quality Foundations')).toBeInTheDocument();
      expect(
        screen.getByText(/An introductory module covering green coffee quality fundamentals/i),
      ).toBeInTheDocument();
    });

    it('renders lessons from fallback seed when store catalog is empty', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      const lessonsTab = screen.getByTestId('tab-lessons');
      expect(within(lessonsTab).getByText('Introduction to Green Coffee Quality')).toBeInTheDocument();
      expect(within(lessonsTab).getByText('Sensory Evaluation Basics')).toBeInTheDocument();
      expect(within(lessonsTab).getByText('EUDR Traceability Requirements')).toBeInTheDocument();
    });

    it('renders Mark Complete buttons for fallback lessons', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(3);
      expect(screen.getByTestId('mark-complete-lesson_1')).toHaveTextContent('Mark Complete');
    });

    it('renders correct estimated minutes from fallback seed', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      // Total: 8 + 12 + 15 = 35 min
      expect(screen.getByText('~35 min')).toBeInTheDocument();
    });

    it('marks a fallback lesson complete and updates store progress', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      fireEvent.click(screen.getByTestId('mark-complete-lesson_1'));

      expect(screen.queryByTestId('mark-complete-lesson_1')).not.toBeInTheDocument();
      expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(2);

      const progress = useRootStore.getState().curriculum.getModuleProgress('mod_1');
      expect(progress?.lessonsCompleted).toContain('lesson_1');
      expect(progress?.status).toBe('in_progress');
    });

    it('shows Review button after completing all fallback lessons', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      fireEvent.click(screen.getByTestId('mark-complete-lesson_1'));
      fireEvent.click(screen.getByTestId('mark-complete-lesson_2'));
      fireEvent.click(screen.getByTestId('mark-complete-lesson_3'));

      // With the new contract, markLessonComplete does NOT auto-complete the module.
      // Switch to Progress tab to click Complete Module
      fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

      // Click Complete Module to finish it
      fireEvent.click(screen.getByTestId('complete-module'));

      // Switch back to Lessons tab to see the Review button
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      expect(screen.getByTestId('review-module')).toBeInTheDocument();
    });

    it('completes the module via Review in fallback mode', () => {
      render(<CoursePlayer moduleId="mod_1" />);
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      fireEvent.click(screen.getByTestId('mark-complete-lesson_1'));
      fireEvent.click(screen.getByTestId('mark-complete-lesson_2'));
      fireEvent.click(screen.getByTestId('mark-complete-lesson_3'));

      // With the new contract, markLessonComplete does NOT auto-complete the module.
      // Switch to Progress tab to click Complete Module
      fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

      // Click Complete Module to finish it
      fireEvent.click(screen.getByTestId('complete-module'));

      // Switch back to Lessons tab to click Review
      fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

      fireEvent.click(screen.getByTestId('review-module'));

      const progress = useRootStore.getState().curriculum.getModuleProgress('mod_1');
      expect(progress?.status).toBe('completed');
    });
  });
});
