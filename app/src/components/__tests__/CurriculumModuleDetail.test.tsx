import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
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
  });

  it('renders module detail with title and description', () => {
    renderDetail();
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByTestId('module-title')).toHaveTextContent('Quality Foundations');
    expect(screen.getByTestId('module-description')).toHaveTextContent(
      /SCA cupping protocol, sensory calibration, and defect recognition/i,
    );
  });

  it('shows progress information', () => {
    renderDetail();
    expect(screen.getByTestId('progress-summary')).toBeInTheDocument();
    // Initially no lessons completed → 0%
    expect(screen.getByText(/^0%$/)).toBeInTheDocument();
    const summary = screen.getByTestId('progress-summary');
    expect(summary).toHaveTextContent('0');
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });

  it('shows mark complete buttons for lessons', () => {
    renderDetail();
    // 4 lessons, each with a mark-complete button
    expect(screen.getAllByTestId(/mark-complete-/)).toHaveLength(4);
    expect(screen.getByTestId('mark-complete-q_lesson_1')).toHaveTextContent('Mark Complete');
  });

  it('shows "not found" when module not in catalog', () => {
    renderDetail('/en-US/curriculum/quality/nonexistent_module');
    expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    expect(screen.getByText(/Module not found/i)).toBeInTheDocument();
  });

  it('updates progress after marking a lesson complete', () => {
    renderDetail();
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));

    // Progress now shows 1/4 in the summary
    const summary = screen.getByTestId('progress-summary');
    expect(summary).toHaveTextContent('1');
    // The completed lesson no longer has a mark-complete button
    expect(screen.queryByTestId('mark-complete-q_lesson_1')).not.toBeInTheDocument();
    expect(screen.getByTestId('lesson-completed-q_lesson_1')).toBeInTheDocument();
  });

  it('shows trust score boost after completing module', () => {
    renderDetail();
    // Complete all lessons first
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_1'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_2'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_3'));
    fireEvent.click(screen.getByTestId('mark-complete-q_lesson_4'));

    // Now mark the module complete
    fireEvent.click(screen.getByTestId('complete-module-button'));

    const trustScore = useRootStore.getState().curriculum.getModuleProgress('mod_q_1');
    expect(trustScore?.trustScoreBoost).toBe(60);
    expect(screen.getByTestId('trust-score')).toHaveTextContent('+60');
  });
});
