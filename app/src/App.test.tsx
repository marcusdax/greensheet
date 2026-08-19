import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import './i18n';
import { resetStore } from './stores/root-store';

const navLabels = [
  'Navigator',
  'Catalog',
  'Reservations',
  'Campaigns',
  'Automation Rules',
  'Roasters',
  'Sample Kits',
  'Orders',
  'Analytics',
  'Growth',
  'Webhooks',
];

function TestApp({ initialRoute = '/en-US/navigator' }: { initialRoute?: string }) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/:locale" element={<AppLayout />}>
          <Route path="navigator" element={<div data-testid="page">Navigator</div>} />
          <Route path="catalog" element={<div data-testid="page">Catalog</div>} />
          <Route path="reservations" element={<div data-testid="page">Reservations</div>} />
          <Route path="campaigns" element={<div data-testid="page">Campaigns</div>} />
          <Route path="automation-rules" element={<div data-testid="page">Automation Rules</div>} />
          <Route path="roasters" element={<div data-testid="page">Roasters</div>} />
          <Route path="sample-kits" element={<div data-testid="page">Sample Kits</div>} />
          <Route path="orders" element={<div data-testid="page">Orders</div>} />
          <Route path="analytics" element={<div data-testid="page">Analytics</div>} />
          <Route path="growth" element={<div data-testid="page">Growth</div>} />
          <Route path="webhooks" element={<div data-testid="page">Webhooks</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('App routing and navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('renders all sidebar navigation links', () => {
    render(<TestApp />);
    navLabels.forEach((label) => {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    });
  });

  it('renders the routed page without error', () => {
    render(<TestApp initialRoute="/en-US/automation-rules" />);
    expect(screen.getByTestId('page')).toHaveTextContent('Automation Rules');
  });
});
