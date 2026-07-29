import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SampleKitsPage } from '../SampleKitsPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('SampleKitsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and request button', async () => {
    render(<SampleKitsPage />);
    expect(await screen.findByText('Sample Kits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request sample kit/i })).toBeInTheDocument();
  });

  it('opens the request sample kit modal', async () => {
    render(<SampleKitsPage />);
    await screen.findByText('Sample Kits');
    fireEvent.click(screen.getByRole('button', { name: /request sample kit/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByLabelText('Roaster')).toBeInTheDocument();
    expect(screen.getByText('Lots (max 8)')).toBeInTheDocument();
    expect(screen.getByLabelText('Address Line 1')).toBeInTheDocument();
  });
});
