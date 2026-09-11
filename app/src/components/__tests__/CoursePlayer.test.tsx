import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CoursePlayer, type CourseTab } from '../CoursePlayer';
import '../../i18n';

describe('CoursePlayer', () => {
  const onTabChange = vi.fn();

  beforeEach(() => {
    onTabChange.mockClear();
  });

  it('renders the module title and description in the header', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    expect(screen.getByText('Quality Foundations')).toBeInTheDocument();
    expect(screen.getByText(/An introductory module covering green coffee quality fundamentals/i)).toBeInTheDocument();
  });

  it('renders all three tab buttons', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    const tablist = screen.getByRole('tablist');
    const tabButtons = within(tablist).getAllByRole('tab');
    expect(tabButtons).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Lessons/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Progress/i })).toBeInTheDocument();
  });

  it('switches tabs and fires onTabChange callback', () => {
    render(<CoursePlayer moduleId="mod_1" onTabChange={onTabChange} />);

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

  it('renders the lessons list in the lessons tab', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));

    const lessonsTab = screen.getByTestId('tab-lessons');
    expect(within(lessonsTab).getByText('Introduction to Green Coffee Quality')).toBeInTheDocument();
    expect(within(lessonsTab).getByText('Sensory Evaluation Basics')).toBeInTheDocument();
    expect(within(lessonsTab).getByText('EUDR Traceability Requirements')).toBeInTheDocument();
  });

  it('renders the progress tab with completion percentage', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    fireEvent.click(screen.getByRole('tab', { name: /Progress/i }));

    const progressTab = screen.getByTestId('tab-progress');
    // No progress recorded yet (progress is null in mock data)
    expect(within(progressTab).getByText(/No progress recorded yet/i)).toBeInTheDocument();
    expect(within(progressTab).getByText('0/3 Progress')).toBeInTheDocument();
  });

  it('applies aria-selected to the active tab', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    const overviewTab = screen.getByRole('tab', { name: /Overview/i });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /Lessons/i }));
    const lessonsTab = screen.getByRole('tab', { name: /Lessons/i });
    expect(lessonsTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveAttribute('aria-selected', 'false');
  });

  it('renders module metadata in the overview tab', () => {
    render(<CoursePlayer moduleId="mod_1" />);

    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('Auctum Curriculum Team')).toBeInTheDocument();
    expect(screen.getByText('Region')).toBeInTheDocument();
    expect(screen.getByText('VN-DKL')).toBeInTheDocument();
  });

  it('renders milestone badge in overview when present', () => {
    render(<CoursePlayer moduleId="mod_1" />);
    expect(screen.getByText('Milestone Badge')).toBeInTheDocument();
    expect(screen.getByText('badge_quality_foundation')).toBeInTheDocument();
  });

  it('renders estimated minutes and level/track badges in header', () => {
    render(<CoursePlayer moduleId="mod_1" />);

    // Total: 8 + 12 + 15 = 35 min
    expect(screen.getByText('~35 min')).toBeInTheDocument();
    expect(screen.getByText('beginner')).toBeInTheDocument();
    expect(screen.getByText('quality')).toBeInTheDocument();
  });
});
