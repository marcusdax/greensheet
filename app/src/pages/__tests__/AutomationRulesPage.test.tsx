import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AutomationRulesPage } from '../AutomationRulesPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('AutomationRulesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and create rule button', async () => {
    render(<AutomationRulesPage />);
    expect(await screen.findByText('Automation Rules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create rule/i })).toBeInTheDocument();
  });

  it('shows the rules table after loading', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByText('COF-001')).toBeInTheDocument();
    expect(screen.getByText('COF-005')).toBeInTheDocument();
  });

  it('filters rules by status', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getAllByText('armed').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Paused' }));
    await waitFor(() => expect(screen.getByText('No rules match the selected filters.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(screen.getByText('COF-001')).toBeInTheDocument());
  });

  it('filters rules by trigger event', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    const triggerSelect = screen.getByLabelText('Trigger');
    fireEvent.change(triggerSelect, { target: { value: 'roaster.no_order' } });
    await waitFor(() => {
      expect(screen.getByText('COF-004')).toBeInTheDocument();
      expect(screen.getByText('COF-005')).toBeInTheDocument();
      expect(screen.queryByText('COF-001')).not.toBeInTheDocument();
    });
  });

  it('opens the create rule modal', async () => {
    render(<AutomationRulesPage />);
    await screen.findByText('Automation Rules');
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByLabelText('Rule Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Rule Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Trigger Event')).toBeInTheDocument();
  });

  it('creates a standalone rule', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Rule Code'), { target: { value: 'COF-006' } });
    fireEvent.change(dialog.getByLabelText('Rule Name'), { target: { value: 'New Standalone Rule' } });
    fireEvent.change(dialog.getByLabelText('Trigger Event'), { target: { value: 'order.created' } });

    fireEvent.click(dialog.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('New Standalone Rule')).toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Standalone')).toBeInTheDocument());
  });

  it('edits a rule', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Edit Touch 1/));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Rule Name'), { target: { value: 'Updated Rule Name' } });

    fireEvent.click(dialog.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Updated Rule Name')).toBeInTheDocument());
  });

  it('deletes a rule', async () => {
    render(<AutomationRulesPage />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Delete Touch 1/));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('COF-001')).not.toBeInTheDocument());
  });
});
