import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Share2 } from 'lucide-react';
import { useReferrals } from '../../stores/root-store';
import { useReferralCode, useReferralStats } from '../../stores/selectors/referral-selectors';

export const ReferralDeliveryCard: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { t } = useTranslation('referrals');
  const { loadCode, loadStats } = useReferrals();
  const code = useReferralCode();
  const stats = useReferralStats();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadCode(accountId);
    void loadStats(accountId);
  }, [accountId, loadCode, loadStats]);

  const url = code
    ? `https://greensheet.com/r/${code.code}?utm_source=referral&utm_medium=invite_link&utm_campaign=ref_core_2025&utm_content=${accountId}:invite_link`
    : '';

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gold/10 border border-gold/30 rounded-lg p-6 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <Share2 className="w-5 h-5 text-ink" />
        <h3 className="font-display text-lg text-ink">{t('delivery.title', 'Share the love')}</h3>
      </div>
      <p className="text-ink mb-4">
        {t(
          'delivery.body',
          'Know a roaster still buying off PDFs? Send them a real kit — scoresheets included. You get $150 of roast credit when their first order lands.',
        )}
      </p>
      {code ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-navy text-white rounded-md hover:bg-navy-700 transition-colors flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('share.copied') : t('share.copy')}
          </button>
        </div>
      ) : (
        <p className="text-muted text-sm">{t('code.loading')}</p>
      )}
      {stats && (
        <p className="text-sm text-muted mt-3">
          {t('delivery.earned', 'You have {{amount}} in referral credit.', { amount: `$${(stats.earnedRewardsCents / 100).toFixed(2)}` })}
        </p>
      )}
    </div>
  );
};