import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CurriculumDetailPage } from '../CurriculumDetailPage';
import { CurriculumPage } from '../CurriculumPage';
import { ToastContainer } from '../../components/ui/ToastContainer';
import '../../i18n';
import { resetStore, useRootStore } from '../../stores/root-store';

function TestApp({ initialRoute = '/en-US/curriculum/quality/mod_q_1' }: { initialRoute?: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/:locale/curriculum" element={<CurriculumPage />} />
        <Route path="/:locale/curriculum/:track/:moduleId" element={<CurriculumDetailPage />} />
      </Routes>
      <ToastContainer />
    </MemoryRouter>
  );
}

describe('CurriculumDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('renders the module title in the header', async () => {
    render(<TestApp />);
    // The detail page header shows the module title
    const header = await screen.findByTestId('curriculum-detail-page');
    expect(header).toBeInTheDocument();
    // CoursePlayer also renders the title, so use getAllByText
    const titles = screen.getAllByText('Quality Foundations');
    expect(titles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the module description from the root store catalog', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');
    expect(
      screen.getByTestId('module-description'),
    ).toHaveTextContent(/SCA cupping protocol, sensory calibration, and defect recognition/i);
  });

  it('renders the level badge', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');
    // The level badge is in the status row; CoursePlayer also shows "beginner"
    const badges = screen.getAllByText('beginner');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the module status from root store progress', async () => {
    render(<TestApp />);
    const statusRow = await screen.findByTestId('module-status');
    expect(statusRow).toHaveTextContent('available');
  });

  it('renders region metadata', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');
    expect(screen.getByTestId('module-meta')).toHaveTextContent('VN-DKL');
  });

  it('renders the CoursePlayer component for lesson content', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');
    expect(screen.getByTestId('course-player-container')).toBeInTheDocument();
    expect(screen.getByTestId('course-player')).toBeInTheDocument();
  });

  it('renders back button and navigates to curriculum list on click', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    fireEvent.click(screen.getByTestId('back-button'));

    await waitFor(() => {
      expect(screen.getByText('CURRICULUM LEDGER')).toBeInTheDocument();
    });
    // Should also show track cards from CurriculumPage
    expect(screen.getByTestId('track-card-quality')).toBeInTheDocument();
  });

  it('seeds the catalog into the root store on mount', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    const catalog = useRootStore.getState().curriculum.catalog;
    expect(catalog).not.toBeNull();
    expect(Object.keys(catalog!.modules)).toContain('mod_q_1');
    expect(Object.keys(catalog!.modules)).toContain('mod_c_1');
    expect(Object.keys(catalog!.modules)).toContain('mod_f_1');
    expect(Object.keys(catalog!.modules)).toContain('mod_l_1');
  });

  it('shows 0% progress before any lessons are completed', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    const progressBar = screen.getByTestId('progress-bar');
    // Check the inner div has width 0%
    const innerDiv = progressBar.querySelector('div');
    expect(innerDiv).toHaveStyle({ width: '0%' });
  });

  it('marks all lessons complete and updates progress percentage', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    fireEvent.click(screen.getByTestId('mark-all-lessons-button'));

    await waitFor(() => {
      const progressBar = screen.getByTestId('progress-bar');
      const innerDiv = progressBar.querySelector('div');
      // mod_q_1 has 4 lessons — all should now be complete
      expect(innerDiv).toHaveStyle({ width: '100%' });
    });
  });

  it('completes a module via the complete button', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    fireEvent.click(screen.getByTestId('complete-module-button'));

    await waitFor(() => {
      expect(screen.getByTestId('module-status')).toHaveTextContent('completed');
    });
  });

  it('redirects to curriculum list when track is invalid', async () => {
    const { container } = render(<TestApp initialRoute="/en-US/curriculum/invalid/mod_q_1" />);

    // Should redirect to the curriculum list page
    await waitFor(() => {
      expect(screen.getByTestId('track-card-quality')).toBeInTheDocument();
    });
  });

  it('redirects to curriculum list when moduleId is invalid', async () => {
    const { container } = render(<TestApp initialRoute="/en-US/curriculum/quality/nonexistent_module" />);

    await waitFor(() => {
      expect(screen.getByTestId('track-card-quality')).toBeInTheDocument();
    });
  });

  it('renders prerequisites when the module has them', async () => {
    render(<TestApp initialRoute="/en-US/curriculum/compliance/mod_c_1" />);
    await screen.findByTestId('curriculum-detail-page');

    expect(screen.getByText(/Prerequisites/i)).toBeInTheDocument();
    expect(screen.getByText(/mod_q_1/)).toBeInTheDocument();
  });

  it('renders different modules correctly based on the moduleId param', async () => {
    render(<TestApp initialRoute="/en-US/curriculum/finance/mod_f_1" />);
    await screen.findByTestId('curriculum-detail-page');

    // CoursePlayer renders the title too, so use getAllByText
    expect(screen.getAllByText('Financial Literacy & True Price Floor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('module-meta')).toHaveTextContent('ET-ORO');
  });

  it('disables the complete button when module is already completed', async () => {
    render(<TestApp />);
    await screen.findByTestId('curriculum-detail-page');

    // Complete the module first
    fireEvent.click(screen.getByTestId('complete-module-button'));

    await waitFor(() => {
      expect(screen.getByTestId('module-status')).toHaveTextContent('completed');
    });

    // Button should now show "Review Module" text and be disabled
    const completeButton = screen.getByTestId('complete-module-button');
    expect(completeButton).toHaveTextContent('Review Module');
    expect(completeButton).toBeDisabled();
  });

  it('navigation from CurriculumPage to a module renders the detail page', async () => {
    render(
      <MemoryRouter initialEntries={['/en-US/curriculum']}>
        <Routes>
          <Route path="/:locale/curriculum" element={<CurriculumPage />} />
          <Route path="/:locale/curriculum/:track/:moduleId" element={<CurriculumDetailPage />} />
        </Routes>
        <ToastContainer />
      </MemoryRouter>,
    );

    // Wait for the CurriculumPage to render
    await screen.findByTestId('track-card-quality');

    // Click the first module's "Start" button
    fireEvent.click(screen.getByTestId('module-link-mod_q_1'));

    // Should now show the detail page
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-detail-page')).toBeInTheDocument();
    });
    expect(screen.getByTestId('course-player')).toBeInTheDocument();
  });
});
