import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnalyticsPage } from '../AnalyticsPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('AnalyticsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and refresh button', async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText('Intelligence & Analytics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('renders derived analytics charts', async () => {
    render(<AnalyticsPage />);
    await screen.findByText('Intelligence & Analytics');

    await waitFor(() => {
      expect(screen.getByText('COHORT RETENTION HEATMAP')).toBeInTheDocument();
    });
    expect(screen.getByText('LTV TO CAC RATIO SCATTER')).toBeInTheDocument();
    expect(screen.getByText('INVENTORY FORECAST & TELEMETRY')).toBeInTheDocument();
    expect(screen.getByText('CHURN SURVIVAL CURVE')).toBeInTheDocument();
  });
});
