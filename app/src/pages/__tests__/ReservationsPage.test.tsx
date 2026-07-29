import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ReservationsPage } from '../ReservationsPage';
import '../../i18n';
import { resetStore, useRootStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/en-US/reservations']}>
      <Routes>
        <Route path="/:locale/reservations" element={<ReservationsPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ReservationsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and empty state', async () => {
    renderPage();
    expect(await screen.findByText('Active Reservations')).toBeInTheDocument();
    expect(screen.getByText('No active reservations.')).toBeInTheDocument();
  });

  it('lists an active reservation after one is created', async () => {
    const reservation = await useRootStore.getState().catalog.reserveLot(
      'lot_001',
      { quantityLbs: 250, orderId: 'order_abc' },
      'reservation-key-1',
    );
    expect(reservation).not.toBeNull();

    renderPage();

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByText('Huila, Colombia')).toBeInTheDocument();
    expect(screen.getByText('order_abc')).toBeInTheDocument();
    expect(screen.getByText('250 lb')).toBeInTheDocument();
  });
});
