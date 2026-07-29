import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { WebhooksPage } from '../WebhooksPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('WebhooksPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and create webhook button', async () => {
    render(<WebhooksPage />);
    expect(await screen.findByText('Webhooks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create webhook/i })).toBeInTheDocument();
  });

  it('reveals the signing secret once after creating a webhook', async () => {
    render(<WebhooksPage />);
    await screen.findByText('Webhooks');

    fireEvent.click(screen.getByRole('button', { name: /create webhook/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Webhook URL'), { target: { value: 'https://example.com/webhook' } });
    fireEvent.click(dialog.getByLabelText('Order Created'));
    fireEvent.change(dialog.getByLabelText('Challenge'), { target: { value: 'secret-challenge' } });

    fireEvent.click(dialog.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Signing secret revealed')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /reveal secret/i }));
    await waitFor(() => expect(screen.getByText(/whsec_/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /dismiss secret/i }));
    await waitFor(() => expect(screen.queryByText('Signing secret revealed')).not.toBeInTheDocument());
  });
});
