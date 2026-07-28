import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { RoastersPage } from '../RoastersPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('RoastersPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders roaster list', async () => {
    render(<RoastersPage />);
    expect(screen.getByText('Roaster Accounts')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Blue Bottle Coffee')).toBeInTheDocument());
  });

  it('selects a roaster and shows detail panel', async () => {
    render(<RoastersPage />);
    await screen.findByText('Blue Bottle Coffee');
    fireEvent.click(screen.getByText('Heart Coffee Roasters'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Heart Coffee Roasters' })).toBeInTheDocument());
  });

  it('adds a roaster', async () => {
    render(<RoastersPage />);
    await screen.findByText('Blue Bottle Coffee');

    fireEvent.click(screen.getByRole('button', { name: /add roaster/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Roaster Name'), { target: { value: 'New Roaster' } });
    fireEvent.change(dialog.getByLabelText('Contact Name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(dialog.getByLabelText('Contact Email'), { target: { value: 'jane@example.com' } });

    fireEvent.click(dialog.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('New Roaster')).toBeInTheDocument());
  });

  it('edits a roaster', async () => {
    render(<RoastersPage />);
    await screen.findByText('Blue Bottle Coffee');

    fireEvent.click(screen.getAllByLabelText(/Edit Blue Bottle Coffee/i)[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Roaster Name'), { target: { value: 'Updated Blue Bottle' } });

    fireEvent.click(dialog.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Updated Blue Bottle')).toBeInTheDocument());
  });

  it('anonymizes a roaster', async () => {
    render(<RoastersPage />);
    await screen.findByText('Blue Bottle Coffee');

    fireEvent.click(screen.getAllByLabelText(/Anonymize Blue Bottle Coffee/i)[0]);
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('[redacted]')).toBeInTheDocument());
  });

  it('logs an intervention for the selected roaster', async () => {
    render(<RoastersPage />);
    await screen.findByText('Blue Bottle Coffee');

    fireEvent.click(screen.getByText('Coava Coffee Roasters'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Coava Coffee Roasters' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Follow-up call scheduled.' } });
    fireEvent.click(screen.getByRole('button', { name: /log intervention/i }));

    await waitFor(() => expect(screen.getByText('Follow-up call scheduled.')).toBeInTheDocument());
  });
});
