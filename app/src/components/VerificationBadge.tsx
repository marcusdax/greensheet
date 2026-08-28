import React from 'react';
import { ShieldCheck, CheckCircle, Circle } from 'lucide-react';
import type { VerificationTier } from '../types/lotspace';

interface VerificationBadgeProps {
  tier: VerificationTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const TIER_CONFIG = {
  self_declared: {
    label: 'Self-Declared',
    shortLabel: 'Self',
    icon: Circle,
    className: 'text-subtle border border-border bg-recessed',
    iconColor: 'text-muted',
  },
  agent_verified: {
    label: 'Agent Verified',
    shortLabel: 'Verified',
    icon: CheckCircle,
    className: 'text-teal bg-teal/10 border border-teal/30',
    iconColor: 'text-teal',
  },
  audit_verified: {
    label: 'Audit Verified',
    shortLabel: 'Audited',
    icon: ShieldCheck,
    className: 'text-gold-600 bg-gold/10 border border-gold/40',
    iconColor: 'text-gold',
  },
} as const;

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  tier,
  size = 'md',
  showLabel = true,
}) => {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSize = { sm: 10, md: 12, lg: 14 }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold rounded-full tracking-wide ${config.className} ${sizeClasses}`}
      title={config.label}
    >
      <Icon size={iconSize} className={config.iconColor} />
      {showLabel && (
        <span>{size === 'sm' ? config.shortLabel : config.label}</span>
      )}
    </span>
  );
};
