import React from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, Coffee, TrendingUp, UserPlus, UserCheck } from 'lucide-react';
import { VerificationBadge } from './VerificationBadge';
import { BraveFewBadge } from './BraveFewBadge';
import type { AnySpace, FarmerSpace, RoasterSpace, CafeSpace, CooperativeSpace } from '../types/lotspace';

interface SpaceCardProps {
  space: AnySpace;
  isFollowing?: boolean;
  onFollow?: (id: string) => void;
  onUnfollow?: (id: string) => void;
  onClick?: (id: string) => void;
}

function getSpaceName(space: AnySpace): string {
  if (space.archetype === 'farmer') return (space as FarmerSpace).farmName;
  if (space.archetype === 'roaster') {
    return (space as RoasterSpace).roasterName || (space as CafeSpace).cafeName;
  }
  if (space.archetype === 'cooperative') return (space as CooperativeSpace).cooperativeName;
  return 'Unknown Space';
}

function getSubtitle(space: AnySpace): string {
  if (space.archetype === 'farmer') {
    const f = space as FarmerSpace;
    return f.primaryVarietals.slice(0, 2).join(' · ') || 'Smallholder';
  }
  if (space.archetype === 'roaster') {
    const r = space as RoasterSpace;
    return r.sourcingOrigins?.slice(0, 2).join(' · ') || 'Roaster';
  }
  if (space.archetype === 'cooperative') {
    const c = space as CooperativeSpace;
    return `${c.memberFarmerCount.toLocaleString()} members`;
  }
  return '';
}

function getMetric(space: AnySpace): { label: string; value: string } | null {
  if (space.archetype === 'farmer') {
    const f = space as FarmerSpace;
    return {
      label: 'Cup Range',
      value: `${f.cupScoreRangeMin.toFixed(1)}–${f.cupScoreRangeMax.toFixed(1)}`,
    };
  }
  if (space.archetype === 'roaster') {
    const r = space as RoasterSpace;
    if (r.avgFarmgatePaidCentsPerLb) {
      return {
        label: 'Avg Farmgate',
        value: `$${(r.avgFarmgatePaidCentsPerLb / 100).toFixed(2)}/lb`,
      };
    }
  }
  if (space.archetype === 'cooperative') {
    const c = space as CooperativeSpace;
    if (c.eudrCompliancePct !== null) {
      return { label: 'EUDR', value: `${c.eudrCompliancePct}%` };
    }
  }
  return null;
}

const ARCHETYPE_COLORS: Record<string, string> = {
  farmer: 'bg-leaf/10 text-leaf border-leaf/20',
  roaster: 'bg-teal/10 text-teal border-teal/20',
  cooperative: 'bg-gold/10 text-gold-600 border-gold/20',
};

const ARCHETYPE_LABELS: Record<string, string> = {
  farmer: 'Farmer',
  roaster: 'Roaster / Café',
  cooperative: 'Cooperative',
};

export const SpaceCard: React.FC<SpaceCardProps> = ({
  space,
  isFollowing = false,
  onFollow,
  onUnfollow,
  onClick,
}) => {
  const name = getSpaceName(space);
  const subtitle = getSubtitle(space);
  const metric = getMetric(space);
  const archetypeLabel = ARCHETYPE_LABELS[space.archetype] || space.archetype;
  const archetypeColor = ARCHETYPE_COLORS[space.archetype] || 'bg-recessed text-muted border-border';

  const isBraveFew =
    space.archetype === 'roaster' && ((space as RoasterSpace).isBraveFew || (space as CafeSpace).isBraveFew);

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowing) onUnfollow?.(space.id);
    else onFollow?.(space.id);
  };

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px -4px rgb(22 50 62 / 0.12)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onClick={() => onClick?.(space.id)}
      className="bg-surface border border-border rounded-lg p-4 cursor-pointer flex flex-col gap-3 hover:border-teal/40 transition-colors duration-fast group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-parchment-50 font-display font-semibold text-sm shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>

        {/* Archetype chip */}
        <span className={`text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${archetypeColor}`}>
          {archetypeLabel}
        </span>
      </div>

      {/* Name & location */}
      <div className="space-y-0.5 min-w-0">
        <h3 className="text-sm font-sans font-semibold text-ink leading-tight truncate group-hover:text-teal transition-colors">
          {name}
        </h3>
        {space.archetype === 'farmer' && (
          <p className="text-xs font-sans text-muted truncate">
            {(space as FarmerSpace).fullName}
          </p>
        )}
        <div className="flex items-center gap-1 text-[10px] text-subtle font-mono">
          <MapPin size={10} />
          <span className="truncate">{space.locationLabel}</span>
        </div>
      </div>

      {/* Subtitle (varietals / origins) */}
      {subtitle && (
        <div className="flex items-center gap-1 text-[10px] text-muted font-mono">
          <Coffee size={10} />
          <span className="truncate">{subtitle}</span>
        </div>
      )}

      {/* Metric */}
      {metric && (
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <TrendingUp size={10} className="text-teal" />
          <span className="text-muted">{metric.label}:</span>
          <span className="text-ink font-semibold">{metric.value}</span>
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <VerificationBadge tier={space.verificationTier} size="sm" />
        {isBraveFew && <BraveFewBadge size="sm" />}
      </div>

      {/* Footer: followers + follow button */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-1 text-[10px] text-muted font-mono">
          <Users size={10} />
          <span>{space.followerCount.toLocaleString()} followers</span>
        </div>
        <button
          onClick={handleFollowClick}
          className={`flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-1 rounded-md transition-all duration-fast ${
            isFollowing
              ? 'text-teal bg-teal/10 hover:bg-cherry/10 hover:text-cherry'
              : 'text-muted hover:text-teal hover:bg-teal/10'
          }`}
        >
          {isFollowing ? (
            <><UserCheck size={10} /> Following</>
          ) : (
            <><UserPlus size={10} /> Follow</>
          )}
        </button>
      </div>
    </motion.div>
  );
};
