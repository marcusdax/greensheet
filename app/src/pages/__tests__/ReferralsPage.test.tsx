import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReferralsPage } from '../ReferralsPage';
import '../../i18n';
import { resetStore } from '../../stores/root-store';
import { resetDatabase } from '../../api/db';

describe('ReferralsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDatabase();
    resetStore();
  });

  it('renders the page header', async () => {
    render(<ReferralsPage />);
    expect(await screen.findByText('Referrals')).toBeInTheDocument();
    expect(screen.getByText('Manage your referral program. Track invites, rewards, and share your unique code.')).toBeInTheDocument();
  });

  it('renders the referral code for the default account', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Referrals');
    // r_001 has the seeded code GS-RVR-001
    // Note: data-testid="referral-code" appears on both the page and the DeliveryCard
    const codeElements = await screen.findAllByTestId('referral-code');
    expect(codeElements.length).toBeGreaterThanOrEqual(1);
    await waitFor(() => {
      expect(codeElements[0]).toHaveTextContent('GS-RVR-001');
    });
  });

  it('renders the stats cards once loaded', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Referrals');
    await waitFor(() => {
      expect(screen.getByText('Invites sent')).toBeInTheDocument();
    });
    // "Qualified" appears as both a stats card label and a referral status badge
    expect(screen.getAllByText('Qualified').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('K-factor')).toBeInTheDocument();
    expect(screen.getByText('Earned credits')).toBeInTheDocument();
  });

  it('renders the referrals table with seeded data', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Referrals');
    // r_001 has 5 referrals
    await waitFor(() => {
      expect(screen.getByText('Your Referrals')).toBeInTheDocument();
    });
    // ref_004 has refereeId r_005 → roaster name "Stumptown Coffee"
    await waitFor(() => {
      expect(screen.getByText('Stumptown Coffee')).toBeInTheDocument();
    });
  });

  it('renders the reward ledger section', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Referrals');
    await waitFor(() => {
      expect(screen.getByText('Reward Ledger')).toBeInTheDocument();
    });
    // r_001 has ledger entries — the status column renders the raw status value
    await waitFor(() => {
      expect(screen.getByText('posted')).toBeInTheDocument();
    });
  });

  it('renders the ReferralDeliveryCard with incentive summary', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Referrals');
    await waitFor(() => {
      expect(screen.getByTestId('referral-delivery-card')).toBeInTheDocument();
    });
    expect(screen.getByText('Send a Kit, Get Credit')).toBeInTheDocument();
    expect(screen.getByText('$150')).toBeInTheDocument();
  });

  it('renders the refresh button', async () => {
    render(<ReferralsPage />);
    expect(await screen.findByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
