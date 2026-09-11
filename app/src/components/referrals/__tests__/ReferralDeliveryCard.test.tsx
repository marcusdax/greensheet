import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetDatabase } from '../../../api/db';
import { resetStore } from '../../../stores/root-store';
import { ReferralDeliveryCard } from '../ReferralDeliveryCard';

beforeEach(() => {
  localStorage.clear();
  resetDatabase();
  resetStore();
});

describe('ReferralDeliveryCard', () => {
  it('renders the share copy and referral URL', async () => {
    render(<ReferralDeliveryCard accountId="r_001" />);
    expect(await screen.findByText(/Know a roaster still buying off PDFs/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue(/greensheet.com\/r\/GS-/i)).toBeInTheDocument();
  });
});