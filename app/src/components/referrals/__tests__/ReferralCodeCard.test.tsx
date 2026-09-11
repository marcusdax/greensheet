import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetDatabase } from '../../../api/db';
import { resetStore, useRootStore } from '../../../stores/root-store';
import { ReferralCodeCard } from '../ReferralCodeCard';
import '../../../i18n';

beforeEach(() => {
  localStorage.clear();
  resetDatabase();
  resetStore();
});

describe('ReferralCodeCard', () => {
  it('loads and displays the active code', async () => {
    await useRootStore.getState().referrals.loadCode('r_001');
    render(<ReferralCodeCard accountId="r_001" />);
    expect(await screen.findByText(/GS-RVR-001/i)).toBeInTheDocument();
  });
});
