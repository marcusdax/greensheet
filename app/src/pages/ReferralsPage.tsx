import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ExternalLink, Users, Package, ShoppingCart, Check } from 'lucide-react';
import { useReferrals } from '../stores/root-store';
import { ReferralCodeCard } from '../components/referrals/ReferralCodeCard';
import { ReferralStatsCard } from '../components/referrals/ReferralStatsCard';
import { ReferralInvitesTable } from '../components/referrals/ReferralInvitesTable';
import { ReferralLedgerTable } from '../components/referrals/ReferralLedgerTable';
import { ReferralShareCard } from '../components/referrals/ReferralShareCard';

export const ReferralsPage: React.FC = () => {
  const { t } = useTranslation(['referrals', 'common']);
  const accountId = 'r_001'; // TODO: replace with auth context when available
  const { loadCode, loadReferrals, loadLedger, loadStats } = useReferrals();

  useEffect(() => {
    void loadCode(accountId);
    void loadReferrals(accountId);
    void loadLedger(accountId);
    void loadStats(accountId);
  }, [accountId, loadCode, loadReferrals, loadLedger, loadStats]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl text-ink">{t('referrals:title')}</h1>
        <p className="text-sm text-muted mt-1">{t('referrals:subtitle', 'Manage your referral program. Track invites, rewards, and share your unique code.')}</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ReferralStatsCard />
          <ReferralInvitesTable accountId={accountId} />
          <ReferralLedgerTable accountId={accountId} />
        </div>
        <div className="space-y-6">
          <ReferralCodeCard accountId={accountId} />
          <ReferralShareCard accountId={accountId} />
        </div>
      </div>
    </div>
  );
};