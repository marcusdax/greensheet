import React from 'react';
import type { VerificationTier } from '../types/ledger';

type Size = 'sm' | 'md' | 'lg';

export interface AuctumVerifiedOriginProps {
  verified: boolean;
  tier: VerificationTier;
  size?: Size;
  showLabel?: boolean;
}

/**
 * Token-aligned sizing (4dp grid per tokens.md §4).
 *   sm: 8dp × 4dp         — caption/10px
 *   md: 12dp × 6dp        — body/14px
 *   lg: 16dp × 8dp        — lead/16px
 * Font-family is chosen per variant below (display vs. sans).
 */
const SIZE_CONFIG: Record<Size, { text: string; dot: string }> = {
  sm: { text: 'text-xs', dot: 'w-1.5 h-1.5' },
  md: { text: 'text-sm', dot: 'w-2 h-2' },
  lg: { text: 'text-base', dot: 'w-2.5 h-2.5' },
};

/**
 * Tier → visual variant.
 *
 * Token-backed class mapping (per 02-design-tokens.md §9–10 + tailwind.config.js):
 *   audit_verified  → gold-500 (#C9A34A) seal on parchment, Playfair Display label
 *   agent_verified  → navy-700 (#16323E) on canvas, Inter badge text
 *   self_declared   → leaf-600 (#3E6B50) outline on recessed, Inter badge text
 *   verified:false  → null (seal never renders on unverified lots)
 *
 * Colors resolve to brand-static primitives or CSS-variable semantic tokens —
 * no arbitrary hex literals appear in markup.
 */
function tierVariant(tier: VerificationTier): {
  label: string;
  classes: string;
  font: 'font-display' | 'font-sans';
} {
  switch (tier) {
    case 'audit_verified':
      return {
        label: 'AUCTUM VERIFIED ORIGIN',
        // gold seal text on parchment ground, thin brass border = seal impression
        classes: 'text-gold bg-parchment border border-gold/30 tracking-tight',
        font: 'font-display',
      };
    case 'agent_verified':
      return {
        label: 'Verified',
        // navy on canvas surface
        classes: 'text-navy bg-surface border border-navy/20 tracking-wide',
        font: 'font-sans',
      };
    case 'self_declared':
      return {
        label: 'Declared',
        // outline leaf on recessed surface
        classes: 'text-leaf bg-recessed border border-leaf tracking-wide',
        font: 'font-sans',
      };
  }
}

export const AuctumVerifiedOrigin: React.FC<AuctumVerifiedOriginProps> = ({
  verified,
  tier,
  size = 'md',
  showLabel = true,
}) => {
  if (!verified) return null;

  const variant = tierVariant(tier);
  const sizeCfg = SIZE_CONFIG[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-instant select-none ${variant.classes}`}
      title={variant.label}
    >
      {showLabel ? (
        <span className={`${variant.font} ${sizeCfg.text}`}>{variant.label}</span>
      ) : (
        <span className={`rounded-full bg-current ${sizeCfg.dot}`} aria-label={variant.label} />
      )}
    </span>
  );
};
