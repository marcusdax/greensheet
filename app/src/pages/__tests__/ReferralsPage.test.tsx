import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../i18n';
import { resetDatabase } from '../../api/db';
import { resetStore } from '../../stores/root-store';
import { ReferralsPage } from '../ReferralsPage';

vi.setConfig({ testTimeout: 10000 });

function renderWithProviders() {
  return render(
    <MemoryRouter initialEntries={['/en/referrals']}>
      <Routes>
        <Route path=":locale/*" element={<ReferralsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReferralsPage', () => {
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

  it('renders the page title and seeded code', async () => {
    renderWithProviders();
    expect(await screen.findByText('Referrals')).toBeInTheDocument();
    expect(await screen.findByText('GS-RVR-001')).toBeInTheDocument();
  });

  it('shows referral stats card', async () => {
    renderWithProviders();
    expect(await screen.findByText('Program stats')).toBeInTheDocument();
  });

  it('shows referral invites table', async () => {
    renderWithProviders();
    expect(await screen.findByText('Invites')).toBeInTheDocument();
  });
});