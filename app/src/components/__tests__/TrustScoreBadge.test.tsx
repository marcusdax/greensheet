import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustScoreBadge } from '../TrustScoreBadge';

describe('TrustScoreBadge — base behavior', () => {
  it('renders score as integer when whole number', () => {
    render(<TrustScoreBadge score={92} />);
    expect(screen.getByText('92')).toBeInTheDocument();
  });

  it('renders score with one decimal when needed', () => {
    render(<TrustScoreBadge score={78.5} />);
    expect(screen.getByText('78.5')).toBeInTheDocument();
  });

  it('applies sealed colors at 90+', () => {
    const { container } = render(<TrustScoreBadge score={92} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-gold');
  });

  it('applies verified colors at 75-89.9', () => {
    const { container } = render(<TrustScoreBadge score={78} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-teal');
  });

  it('applies established colors at 55-74.9', () => {
    const { container } = render(<TrustScoreBadge score={65} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-cherry-100');
  });

  it('applies provisional colors at 35-54.9', () => {
    const { container } = render(<TrustScoreBadge score={42} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-slate-700');
  });

  it('applies at-risk colors below 35', () => {
    const { container } = render(<TrustScoreBadge score={30} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-danger-bg');
  });

  it('shows seal glyph for sealed band', () => {
    const { container } = render(<TrustScoreBadge score={92} />);
    expect(container.textContent).toContain('●');
  });

  it('does not show seal glyph below 90', () => {
    const { container } = render(<TrustScoreBadge score={78} />);
    expect(container.textContent).not.toContain('●');
  });

  it('displays evidence count in tooltip', () => {
    render(<TrustScoreBadge score={92} evidenceCount={5} />);
    expect(screen.getByTitle(/5 accepted documents/i)).toBeInTheDocument();
  });

  it('displays model version in tooltip', () => {
    render(<TrustScoreBadge score={92} modelVersion="v1.2" />);
    expect(screen.getByTitle(/model v1.2/i)).toBeInTheDocument();
  });

  it('uses sm size by default and md when requested', () => {
    const { container: sm } = render(<TrustScoreBadge score={92} />);
    const { container: md } = render(<TrustScoreBadge score={92} size="md" />);
    expect(sm.querySelector('span.inline-flex')).toHaveClass('h-6');
    expect(md.querySelector('span.inline-flex')).toHaveClass('h-7');
  });
});
