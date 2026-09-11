import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, Gift, Wallet } from 'lucide-react';
import {
  useReferralStats,
  useReferralTier,
  useNetEarnedCents,
} from '../../stores/selectors/referral-selectors';

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-recessed rounded-md p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-display text-ink">{value}</div>
    </div>
  );
}

export const ReferralStatsCard: React.FC = () => {
  const { t } = useTranslation('referrals');
  const stats = useReferralStats();
  const tier = useReferralTier();
  const netEarnedCents = useNetEarnedCents();

  if (!stats) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-e1">
      <div className="flex items-start justify-between mb-4">
        <h2 className="font-display text-xl text-ink">{t('stats.title', 'Program stats')}</h2>
        {tier && (
          <div className="bg-gold text-ink px-3 py-1 rounded-full text-sm font-semibold">
            {tier.name}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Kpi icon={Users} label={t('stats.invites', 'Invites sent')} value={stats.invitesSent} />
        <Kpi icon={TrendingUp} label={t('stats.clicks', 'Clicks')} value={stats.clicks} />
        <Kpi icon={Gift} label={t('stats.qualified', 'Qualified')} value={stats.qualifiedReferrals} />
        <Kpi icon={Wallet} label={t('stats.earned', 'Earned credits')} value={`$${(netEarnedCents / 100).toFixed(2)}`} />
      </div>
      {tier && <p className="text-sm text-muted">{tier.perks}</p>}
    </div>
  );
};
