import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReferralDeliveryCard } from '../../ReferralDeliveryCard';
import '../../../i18n';

describe('ReferralDeliveryCard', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      constructor(
        private callback: (entries: Array<{ contentRect: DOMRectReadOnly }>) => void,
      ) {}
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

  it('renders the card with an accountId', () => {
    render(
      <ReferralDeliveryCard
        accountId="acc_123"
        roasterName="Stumptown Coffee"
        referralCode="AL-RVR-001"
      />,
    );
    expect(screen.getByTestId('referral-delivery-card')).toBeInTheDocument();
  });

  it('displays the "Send a Kit, Get Credit" title', () => {
    render(
      <ReferralDeliveryCard
        accountId="acc_123"
        roasterName="Stumptown Coffee"
        referralCode="AL-RVR-001"
      />,
    );
    expect(screen.getByText('Send a Kit, Get Credit')).toBeInTheDocument();
  });

  it('displays the body copy about sending a kit', () => {
    render(
      <ReferralDeliveryCard
        accountId="acc_123"
        roasterName="Stumptown Coffee"
        referralCode="AL-RVR-001"
      />,
    );
    expect(
      screen.getByText(
        /Know a roaster still buying off PDFs\? Send them a real kit — scoresheets included\. You get \$150 of roast credit when their first order lands\./,
      ),
    ).toBeInTheDocument();
  });
});
