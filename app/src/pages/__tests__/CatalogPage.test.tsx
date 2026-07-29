import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CatalogPage } from '../CatalogPage';
import { ToastContainer } from '../../components/ui/ToastContainer';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/en-US/catalog']}>
      <Routes>
        <Route path="/:locale/catalog" element={<><CatalogPage /><ToastContainer /></>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CatalogPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header and add lot button', async () => {
    renderPage();
    expect(await screen.findByText('Green Sheet Catalog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add lot/i })).toBeInTheDocument();
  });

  it('loads and displays seeded lots', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.getByText('Huila, Colombia')).toBeInTheDocument();
    expect(screen.getByText('Yirgacheffe, Ethiopia')).toBeInTheDocument();
  });

  it('opens the add lot modal with expected fields', async () => {
    renderPage();
    await screen.findByText('Green Sheet Catalog');

    fireEvent.click(screen.getByRole('button', { name: /add lot/i }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('Origin')).toBeInTheDocument();
    expect(dialog.getByLabelText('Price / lb ($)')).toBeInTheDocument();
    expect(dialog.getByLabelText('Cup Score')).toBeInTheDocument();
  });

  it('shows a toast when a reserve request fails with insufficient inventory', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Cajamarca, Peru')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/Reserve Cajamarca, Peru/i));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Quantity (lbs)'), { target: { value: '10' } });
    fireEvent.change(dialog.getByLabelText('Order ID'), { target: { value: 'order_123' } });

    fireEvent.click(dialog.getByRole('button', { name: /reserve/i }));

    await waitFor(() =>
      expect(screen.getByText(/has 0 lbs available; 10 requested/i)).toBeInTheDocument(),
    );
  });
});
