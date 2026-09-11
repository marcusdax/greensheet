import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuctumVerifiedOrigin } from '../AuctumVerifiedOrigin';
import type { VerificationTier } from '../../types/ledger';

describe('AuctumVerifiedOrigin curriculum badge', () => {
  it('renders a curriculum badge when curriculumBadge is provided', () => {
    render(<AuctumVerifiedOrigin verified={true} tier="agent_verified" showLabel={false} curriculumBadge="audit_verified" />);
    const badge = screen.getByLabelText(/Curriculum badge/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('★');
  });

  it('does not render a curriculum badge when curriculumBadge is not provided', () => {
    render(<AuctumVerifiedOrigin verified={true} tier="agent_verified" showLabel={false} />);
    expect(screen.queryByLabelText(/Curriculum badge/i)).not.toBeInTheDocument();
  });

  it('renders curriculum badge with correct tier label in title', () => {
    render(<AuctumVerifiedOrigin verified={true} tier="audit_verified" showLabel={true} curriculumBadge="agent_verified" />);
    const badge = screen.getByLabelText(/Curriculum badge: agent verified/i);
    expect(badge).toBeInTheDocument();
  });

  it('renders different color classes for each verification tier badge', () => {
    const tiers: VerificationTier[] = ['self_declared', 'agent_verified', 'audit_verified'];
    tiers.forEach((tier) => {
      const { unmount } = render(
        <AuctumVerifiedOrigin verified={true} tier={tier} showLabel={false} curriculumBadge={tier} />,
      );
      const badge = screen.getByLabelText(/Curriculum badge/i);
      expect(badge).toBeInTheDocument();
      unmount();
    });
  });

  it('does not render at all when verified is false, even with curriculumBadge', () => {
    const { container } = render(
      <AuctumVerifiedOrigin verified={false} tier="audit_verified" curriculumBadge="agent_verified" />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText(/Curriculum badge/i)).not.toBeInTheDocument();
  });

  it('does not alter existing tier rendering when curriculumBadge is absent', () => {
    const { container } = render(
      <AuctumVerifiedOrigin verified={true} tier="agent_verified" showLabel={true} />,
    );
    // The existing seal/badge should still render
    expect(screen.getByText('Verified')).toBeInTheDocument();
    // No curriculum badge should appear
    expect(screen.queryByLabelText(/Curriculum badge/i)).not.toBeInTheDocument();
  });
});
