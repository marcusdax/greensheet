import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CupScoreBadge } from '../CupScoreBadge';
import type { ModuleStatus } from '../../types/ledger';

describe('CupScoreBadge — base behavior (unmodified)', () => {
  it('renders the score with one decimal place', () => {
    render(<CupScoreBadge score={90.5} />);
    expect(screen.getByText('90.5')).toBeInTheDocument();
  });

  it('applies gold styling at 90+ and renders the tick', () => {
    const { container } = render(<CupScoreBadge score={90.0} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-gold');
    expect(badge).toHaveTextContent('✓');
  });

  it('applies teal styling between 85 and 89.9', () => {
    const { container } = render(<CupScoreBadge score={87.3} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-teal');
    expect(badge).not.toHaveTextContent('✓');
  });

  it('applies leaf styling between 80 and 84.9', () => {
    const { container } = render(<CupScoreBadge score={82.0} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-leaf');
  });

  it('applies slate styling below 80', () => {
    const { container } = render(<CupScoreBadge score={75.0} />);
    const badge = container.querySelector('span.inline-flex');
    expect(badge).toHaveClass('bg-slate');
  });

  it('uses sm sizing by default and lg when requested', () => {
    const { container: sm } = render(<CupScoreBadge score={90.0} />);
    const { container: lg } = render(<CupScoreBadge score={90.0} size="lg" />);

    expect(sm.querySelector('span.inline-flex')).toHaveClass('px-2');
    expect(sm.querySelector('span.inline-flex')).toHaveClass('text-sm');
    expect(lg.querySelector('span.inline-flex')).toHaveClass('px-3');
    expect(lg.querySelector('span.inline-flex')).toHaveClass('text-lg');
  });
});

describe('CupScoreBadge — curriculum integration', () => {
  it('does not render a curriculum sub-badge when curriculum is omitted', () => {
    render(<CupScoreBadge score={90.0} />);
    // Only the score (and tick) should be present, no aria-label about modules
    expect(screen.queryByLabelText(/Curriculum modules completed/i)).not.toBeInTheDocument();
  });

  it('renders a ratio sub-badge when curriculum with totalModules is provided', () => {
    render(
      <CupScoreBadge
        score={90.0}
        curriculum={{ completedModules: 3, totalModules: 5 }}
      />,
    );
    const sub = screen.getByLabelText('Curriculum modules completed: 3/5');
    expect(sub).toBeInTheDocument();
    expect(sub).toHaveTextContent('3/5');
  });

  it('renders an absolute count sub-badge when totalModules is omitted', () => {
    render(
      <CupScoreBadge score={85.0} curriculum={{ completedModules: 7 }} />,
    );
    const sub = screen.getByLabelText('Curriculum modules completed: 7');
    expect(sub).toBeInTheDocument();
    expect(sub).toHaveTextContent('7');
  });

  it('renders a condensed dot with no text when condensed is true', () => {
    render(
      <CupScoreBadge
        score={90.0}
        curriculum={{ completedModules: 2, totalModules: 4, condensed: true }}
      />,
    );
    const sub = screen.getByLabelText('Curriculum modules completed: 2/4');
    // The dot has no visible text content but still carries the aria label
    expect(sub).toHaveTextContent('');
    expect(sub).toHaveClass('w-1.5');
    expect(sub).toHaveClass('h-1.5');
  });

  it.each([
    ['completed', 'bg-leaf'],
    ['in_progress', 'bg-teal'],
    ['available', 'bg-slate'],
    ['locked', 'bg-slate'],
  ] as Array<[ModuleStatus, string]>)(
    'applies status classes for %s status',
    (status, expectedClass) => {
      render(
        <CupScoreBadge
          score={90.0}
          curriculum={{ completedModules: 1, totalModules: 3 }}
          curriculumStatus={status}
        />,
      );
      const sub = screen.getByLabelText('Curriculum modules completed: 1/3');
      expect(sub).toHaveClass(expectedClass);
    },
  );

  it('defaults to completed status styling when curriculumStatus is omitted', () => {
    render(
      <CupScoreBadge score={90.0} curriculum={{ completedModules: 2 }} />,
    );
    const sub = screen.getByLabelText('Curriculum modules completed: 2');
    expect(sub).toHaveClass('bg-leaf');
  });

  it('carries an accurate title tooltip with status and ratio', () => {
    render(
      <CupScoreBadge
        score={90.0}
        curriculum={{ completedModules: 4, totalModules: 8 }}
        curriculumStatus="in_progress"
      />,
    );
    const sub = screen.getByLabelText('Curriculum modules completed: 4/8');
    expect(sub).toHaveAttribute(
      'title',
      'Curriculum: in_progress (4/8 modules)',
    );
  });

  it('keeps the base score rendering intact when curriculum is present', () => {
    render(
      <CupScoreBadge score={90.0} curriculum={{ completedModules: 1, totalModules: 2 }} />,
    );
    // Score text still present
    expect(screen.getByText('90.0')).toBeInTheDocument();
    // Tick still present (90+ threshold)
    const badge = screen.getByText('90.0');
    expect(badge.closest('span.inline-flex')).toHaveTextContent('✓');
  });
});

describe('CupScoreBadge — curriculumTier integration', () => {
  it('does not render an Award icon when curriculumTier is omitted', () => {
    const { container } = render(
      <CupScoreBadge score={90.0} curriculum={{ completedModules: 1, totalModules: 2 }} />,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders an Award icon with the tier as aria-label when curriculumTier is provided', () => {
    render(
      <CupScoreBadge
        score={90.0}
        curriculum={{ completedModules: 1, totalModules: 2 }}
        curriculumTier="quality"
      />,
    );
    const award = screen.getByLabelText('quality');
    expect(award).toBeInTheDocument();
    expect(award.tagName.toLowerCase()).toBe('span');
    expect(award).toHaveAttribute('title', 'Curriculum track: quality');
    expect(award.querySelector('svg')).toBeInTheDocument();
  });

  it.each([
    ['quality', 'text-gold'],
    ['compliance', 'text-navy'],
    ['finance', 'text-teal'],
    ['logistics', 'text-cherry'],
  ] as Array<[string, string]>)(
    'applies tier color class %s for the %s track',
    (tier, expectedClass) => {
      const { container } = render(
        <CupScoreBadge
          score={90.0}
          curriculum={{ completedModules: 1, totalModules: 2 }}
          curriculumTier={tier as 'quality' | 'compliance' | 'finance' | 'logistics'}
        />,
      );
      const award = container.querySelector('svg');
      expect(award).not.toBeNull();
      expect(award).toHaveClass(expectedClass);
    },
  );

  it('renders the Award icon only when both curriculum and curriculumTier are provided', () => {
    const { container } = render(
      <CupScoreBadge score={90.0} curriculumTier="finance" />,
    );
    // No curriculum sub-badge means no Award icon either
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('keeps the curriculum sub-badge intact when curriculumTier is present', () => {
    render(
      <CupScoreBadge
        score={90.0}
        curriculum={{ completedModules: 3, totalModules: 5 }}
        curriculumTier="compliance"
      />,
    );
    // Sub-badge ratio still rendered
    expect(screen.getByLabelText('Curriculum modules completed: 3/5')).toHaveTextContent('3/5');
    // Award icon also rendered
    expect(screen.getByLabelText('compliance')).toBeInTheDocument();
  });
});
