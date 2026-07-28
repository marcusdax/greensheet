import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignsPage } from '../CampaignsPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('CampaignsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and create campaign button', async () => {
    render(<CampaignsPage />);
    expect(await screen.findByText('Campaign Intelligence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create campaign/i })).toBeInTheDocument();
  });

  it('shows status filter buttons', async () => {
    render(<CampaignsPage />);
    await screen.findByText('Campaign Intelligence');
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
  });

  it('opens the create campaign modal', async () => {
    render(<CampaignsPage />);
    await screen.findByText('Campaign Intelligence');
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByLabelText('Slug')).toBeInTheDocument();
    expect(screen.getByLabelText('Campaign Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });

  it('renders attributed revenue derived from performance data', async () => {
    render(<CampaignsPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    // The first campaign is auto-selected and performance is loaded.
    await waitFor(() => expect(screen.getByText('ATTRIBUTED REVENUE')).toBeInTheDocument());
    expect(screen.getByText('$125,400.00')).toBeInTheDocument();
  });
});
