import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CurriculumPage } from '../CurriculumPage';
import { CurriculumModuleDetail } from '../../components/CurriculumModuleDetail';
import { ToastContainer } from '../../components/ui/ToastContainer';
import '../../i18n';
import { resetStore } from '../../stores/root-store';

const renderPage = (initialRoute = '/en-US/curriculum') =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/:locale/curriculum" element={<CurriculumPage />} />
        <Route path="/:locale/curriculum/:track/:moduleId" element={<CurriculumModuleDetail />} />
      </Routes>
      <ToastContainer />
    </MemoryRouter>,
  );

describe('CurriculumPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('renders the page title', async () => {
    renderPage();
    expect(await screen.findByText('Curriculum')).toBeInTheDocument();
  });

  it('renders the overline text', async () => {
    renderPage();
    expect(await screen.findByText('CURRICULUM LEDGER')).toBeInTheDocument();
  });

  it('renders a card for each track (quality, compliance, finance, logistics)', async () => {
    renderPage();
    await screen.findByText('Curriculum');

    expect(screen.getByTestId('track-card-quality')).toBeInTheDocument();
    expect(screen.getByTestId('track-card-compliance')).toBeInTheDocument();
    expect(screen.getByTestId('track-card-finance')).toBeInTheDocument();
    expect(screen.getByTestId('track-card-logistics')).toBeInTheDocument();
  });

  it('renders a link to each track', async () => {
    renderPage();
    await screen.findByText('Curriculum');

    expect(screen.getByTestId('track-link-quality')).toBeInTheDocument();
    expect(screen.getByTestId('track-link-compliance')).toBeInTheDocument();
    expect(screen.getByTestId('track-link-finance')).toBeInTheDocument();
    expect(screen.getByTestId('track-link-logistics')).toBeInTheDocument();
  });

  it('renders track title labels inside the track cards', async () => {
    renderPage();
    await screen.findByText('Curriculum');

    const qualityCard = screen.getByTestId('track-card-quality');
    expect(qualityCard).toHaveTextContent('Quality');

    const complianceCard = screen.getByTestId('track-card-compliance');
    expect(complianceCard).toHaveTextContent('Compliance');

    const financeCard = screen.getByTestId('track-card-finance');
    expect(financeCard).toHaveTextContent('Finance');

    const logisticsCard = screen.getByTestId('track-card-logistics');
    expect(logisticsCard).toHaveTextContent('Logistics');
  });

  it('renders module cards within each track section', async () => {
    renderPage();
    await screen.findByText('Curriculum');

    expect(screen.getByTestId('module-card-mod_q_1')).toBeInTheDocument();
    expect(screen.getByTestId('module-card-mod_c_1')).toBeInTheDocument();
    expect(screen.getByTestId('module-card-mod_f_1')).toBeInTheDocument();
    expect(screen.getByTestId('module-card-mod_l_1')).toBeInTheDocument();
  });

  it('navigates to a module route when a module card button is clicked', async () => {
    renderPage();
    await screen.findByText('Curriculum');

    const moduleLink = screen.getByTestId('module-link-mod_q_1');
    expect(moduleLink).toBeInTheDocument();

    fireEvent.click(moduleLink);

    // After click, the MemoryRouter should have navigated to the module route
    await waitFor(() => {
      expect(screen.getByTestId('module-detail')).toBeInTheDocument();
    });
  });
});
