import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GrowthPage } from '../GrowthPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

vi.setConfig({ testTimeout: 10000 });

function renderWithProviders() {
  return render(
    <MemoryRouter initialEntries={['/en-US/growth']}>
      <GrowthPage />
    </MemoryRouter>,
  );
}

describe('GrowthPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();

    global.ResizeObserver = class ResizeObserver {
      constructor(private callback: (entries: Array<{ contentRect: DOMRectReadOnly }>) => void) {}
      observe(target: Element) {
        const rect = target.getBoundingClientRect();
        this.callback([{ contentRect: rect }]);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the page title', async () => {
    renderWithProviders();
    expect(await screen.findByText('Growth Dashboard')).toBeInTheDocument();
  });

  it('renders each widget title', async () => {
    renderWithProviders();
    await screen.findByText('Growth Dashboard');

    expect(screen.getByText('Weekly Transacting Roasters')).toBeInTheDocument();
    expect(screen.getByText('Kit Funnel')).toBeInTheDocument();
    expect(screen.getByText('CAC by Channel')).toBeInTheDocument();
    expect(screen.getByText('Churn Hazard Heatmap')).toBeInTheDocument();
    expect(screen.getByText('K-Factor')).toBeInTheDocument();
    expect(screen.getByText('Campaign Lift')).toBeInTheDocument();
  });

  it('renders each widget description', async () => {
    renderWithProviders();
    await screen.findByText('Growth Dashboard');

    expect(
      screen.getByText('Trailing 7-day active roasters with 4-week moving average'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kit Sent → Delivered → Feedback → First Order'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Blended customer acquisition cost vs. $500 ceiling'),
    ).toBeInTheDocument();
    expect(screen.getByText('Accounts by churn tier and segment')).toBeInTheDocument();
    expect(screen.getByText('Viral referral coefficient vs. 0.6 target')).toBeInTheDocument();
    expect(screen.getByText('Bayesian posterior probability vs. control')).toBeInTheDocument();
  });

  it('renders the refresh button', async () => {
    renderWithProviders();
    expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
