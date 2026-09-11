import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../../i18n';
import { resetDatabase } from '../../api/db';
import { resetStore } from '../../stores/root-store';
import { ReviewQueuePage } from '../ReviewQueuePage';

vi.setConfig({ testTimeout: 10000 });

function renderWithProviders() {
  return render(
    <MemoryRouter initialEntries={['/en/review-queue']}>
      <Routes>
        <Route path=":locale/*" element={<ReviewQueuePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewQueuePage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the review queue title and empty state', async () => {
    renderWithProviders();
    expect(await screen.findByText('Review Queue')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });
});