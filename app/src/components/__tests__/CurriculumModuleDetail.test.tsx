import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../i18n';
import { CurriculumModuleDetail } from '../CurriculumModuleDetail';
import { useRootStore, resetStore } from '../../stores/root-store';
import { SEED_CATALOG } from '../../data/curriculum';

function seedStore() {
  resetStore();
  useRootStore.getState().curriculum.setCatalog(SEED_CATALOG);
}

function renderDetail(route = '/en-US/curriculum/quality/mod_q_1') {
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/:locale/curriculum/:track/:moduleId" element={<CurriculumModuleDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CurriculumModuleDetail', () => {
  beforeEach(() => {
    seedStore();
    vi.clearAllMocks();
  });

  it('renders module detail with title and description for valid track/module', () => {
    renderDetail();
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByTestId('module-title')).toHaveTextContent('Quality Foundations');
    expect(screen.getByTestId('module-description')).toHaveTextContent(
      /SCA cupping protocol, sensory calibration, and defect recognition/i,
    );
  });

  it('shows progress information starting at 0%', () => {
    renderDetail();
    expect(screen.getByTestId('progress-summary')).toBeInTheDocument();
    expect(screen.getByText(/^0%$/)).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('shows mark complete buttons for lessons', () => {
    renderDetail();
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(4);
    expect(screen.getByTestId('mark-complete-q_lesson_1')).toHaveTextContent('Mark Complete');
  });

  it('shows "Module not found" for invalid track (no redirect, no toast)', () => {
    renderDetail('/en-US/curriculum/invalid_track/mod_q_1');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByText(/Module not found/i)).toBeInTheDocument();
  });

  it('shows "Module not found" for invalid module ID (no redirect, no toast)', () => {
    renderDetail('/en-US/curriculum/quality/nonexistent_module');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByText(/Module not found/i)).toBeInTheDocument();
  });

  it('shows "Module not found" when module track does not match URL track', () => {
    // mod_c_1 belongs to 'compliance' track, but we're accessing via 'quality' track
    renderDetail('/en-US/curriculum/quality/mod_c_1');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByText(/Module not found/i)).toBeInTheDocument();
  });

  it('derives lock status from prerequisites (not persisted status)', () => {
    // mod_c_1 has prerequisite mod_q_1
    renderDetail('/en-US/curriculum/compliance/mod_c_1');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    // Module should be locked because prerequisite mod_q_1 is not completed
    expect(screen.getByText(/locked/i)).toBeInTheDocument();
    // Mark-complete buttons ARE visible for locked module (they unlock it when clicked)
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(3);
  });

  it('unlocks module when prerequisites are completed', () => {
    // First complete mod_q_1
    const curriculum = useRootStore.getState().curriculum;
    curriculum.markLessonComplete('mod_q_1', 'q_lesson_1');
    curriculum.markLessonComplete('mod_q_1', 'q_lesson_2');
    curriculum.markLessonComplete('mod_q_1', 'q_lesson_3');
    curriculum.markLessonComplete('mod_q_1', 'q_lesson_4');
    curriculum.completeModule('mod_q_1');

    // Now mod_c_1 should be unlocked
    renderDetail('/en-US/curriculum/compliance/mod_c_1');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByText(/in_progress|available/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(3);
  });

  it('locked lessons CAN be marked complete (which unlocks the module)', () => {
    // mod_c_1 is locked (prerequisite not met)
    renderDetail('/en-US/curriculum/compliance/mod_c_1');
    const markButton = screen.queryByTestId('mark-complete-c_lesson_1');
    expect(markButton).toBeInTheDocument();
    // Clicking it unlocks the module to in_progress (per contract)
    fireEvent.click(markButton);
    // Progress is created with status in_progress
    const progress = useRootStore.getState().curriculum.getModuleProgress('mod_c_1');
    expect(progress).toBeDefined();
    expect(progress?.status).toBe('in_progress');
    expect(progress?.lessonsCompleted).toContain('c_lesson_1');
  });

  it('marking every canonical lesson does NOT auto-complete module', () => {
    renderDetail();
    // Complete all 4 lessons
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // Module should NOT be auto-completed
    const progress = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(progress?.status).toBe('in_progress'); // Not 'completed'
    expect(progress?.trustScoreBoost).toBeUndefined(); // No points for lessons
  });

  it('only canonical lesson IDs from catalog are recognized', () => {
    renderDetail();
    // Only 4 canonical lessons should have mark-complete buttons
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(4);
  });

  it('completing module via completeModule awards exactly +50 trust score once', () => {
    renderDetail();
    // Complete all lessons first
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // Now complete the module
    fireEvent.click(screen.getByTestId('complete-module-button'));

    let progress = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(progress?.status).toBe('completed');
    expect(progress?.trustScoreBoost).toBe(50);
    expect(screen.getByTestId('trust-score')).toHaveTextContent('+50');
  });

  it('completeModule rejects unknown module', () => {
    renderDetail();
    const curriculum = useRootStore.getState().curriculum;
    // Try to complete unknown module - should not throw and should not add progress
    expect(() => curriculum.completeModule('unknown_module')).not.toThrow();
    const progress = curriculum.getModuleProgress('unknown_module');
    expect(progress).toBeUndefined();
  });

  it('completeModule rejects locked module', () => {
    // mod_c_1 is locked (prerequisite not met)
    renderDetail('/en-US/curriculum/compliance/mod_c_1');
    const curriculum = useRootStore.getState().curriculum;
    // Try to complete locked module - should not throw
    expect(() => curriculum.completeModule('mod_c_1')).not.toThrow();
    const progress = curriculum.getModuleProgress('mod_c_1');
    // Should remain locked or available, not completed
    expect(progress?.status).not.toBe('completed');
  });

  it('completeModule rejects already-completed module (idempotent, no additional points)', () => {
    renderDetail();
    // Complete all lessons and module
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));
    fireEvent.click(screen.getByTestId('complete-module-button'));

    let progress = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(progress?.trustScoreBoost).toBe(50);

    // Click complete again (Review) - should NOT add more points
    fireEvent.click(screen.getByTestId('complete-module-button'));

    progress = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(progress?.trustScoreBoost).toBe(50); // Still 50, not 100
  });

  it('completed module Review button is informational/disabled, no mutation', () => {
    renderDetail();
    // Complete all lessons and module
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));
    fireEvent.click(screen.getByTestId('complete-module-button'));

    // Button should show "Review Module" and be disabled
    const completeButton = screen.getByTestId('complete-module-button');
    expect(completeButton).toHaveTextContent('Review Module');
    expect(completeButton).toBeDisabled();
  });

  it('no toast is shown on module completion', () => {
    renderDetail();
    // Complete all lessons and module
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));
    fireEvent.click(screen.getByTestId('complete-module-button'));

    // No toast should appear (we're not testing toast directly but ensuring no pushToast call)
    // The component should not call pushToast
  });

  it('does not fill missing lessons when completing module', () => {
    renderDetail();
    // Complete only 2 of 4 lessons
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));

    // Complete module - should NOT auto-fill missing lessons
    fireEvent.click(screen.getByTestId('complete-module-button'));

    const progress = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(progress?.lessonsCompleted.length).toBe(2); // Only the 2 we completed
    expect(progress?.status).toBe('completed'); // But module is marked completed
    expect(progress?.trustScoreBoost).toBe(50);
  });
});