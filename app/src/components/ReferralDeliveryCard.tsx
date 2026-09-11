import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Share2, Check, QrCode, ExternalLink } from 'lucide-react';
import { useUi } from '../stores/root-store';

export interface ReferralDeliveryCardProps {
  accountId: string;
  roasterName: string;
  referralCode: string;
  referralUrl?: string;
  onQualifyReferral?: (referralId: string) => void;
}

const REFERRAL_BASE = 'https://auctum.io/r/';

function buildReferralUrl(code: string): string {
  return `${REFERRAL_BASE}${code}?utm_source=referral&utm_medium=invite_link&utm_campaign=ref_core_2025`;
}

export const ReferralDeliveryCard: React.FC<ReferralDeliveryCardProps> = ({
  accountId,
  roasterName: _roasterName,
  referralCode,
  referralUrl: referralUrlProp,
  onQualifyReferral,
}) => {
  const { t } = useTranslation(['referrals', 'common']);
  const { pushToast } = useUi();
  const [copied, setCopied] = useState(false);
  const [shareAvailable, setShareAvailable] = useState(false);

  const referralUrl = referralUrlProp ?? buildReferralUrl(referralCode);

  useEffect(() => {
    setShareAvailable(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushToast({ kind: 'success', message: t('common:buttons.copied', 'Copied to clipboard') });
    } catch {
      pushToast({ kind: 'error', message: t('referrals:copyError', 'Failed to copy link') });
    }
  };

  const share = async () => {
    if (!shareAvailable) return;
    try {
      await navigator.share({
        title: t('referrals:shareTitle', 'Referral link from Auctum Ledger'),
        text: t('referrals:shareText', 'Check out this sample kit referral from Auctum Ledger'),
        url: referralUrl,
      });
    } catch {
      // User cancelled share — fall through to copy
      void copyToClipboard();
    }
  };

  return (
    <section
      className="bg-surface border border-border-strong rounded-lg p-5 shadow-e2"
      data-testid="referral-delivery-card"
    >
      <header className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <QrCode size={20} className="text-teal" />
            <h2 className="text-lg font-display font-semibold text-ink">
              {t('referrals:deliveryCardTitle', 'Send a Kit, Get Credit')}
            </h2>
          </div>
          <p className="text-sm text-muted font-sans leading-relaxed">
            {t('referrals:deliveryCardBody', 'Know a roaster still buying off PDFs? Send them a real kit — scoresheets included. You get $150 of roast credit when their first order lands.')}
          </p>
        </div>
      </header>

      <div className="mt-4 space-y-4">
        {/* Referral link */}
        <div>
          <label className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
            {t('referrals:yourLink', 'Your referral link')}
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <code
              className="flex-1 px-3 py-1.5 bg-recessed/20 border border-border rounded-md text-xs font-mono text-ink truncate"
              data-testid="referral-link"
            >
              {referralUrl}
            </code>
            <button
              type="button"
              onClick={copyToClipboard}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-recessed transition-colors focus-visible:ring-2 focus-visible:ring-teal"
              aria-label={t('referrals:copyLink', 'Copy referral link')}
            >
              {copied ? <Check size={14} className="text-teal" /> : <Copy size={14} />}
              {t('common:buttons.copy', 'Copy')}
            </button>
          </div>
        </div>

        {/* Referral code */}
        <div>
          <label className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
            {t('referrals:yourCode', 'Referral code')}
          </label>
          <div
            className="mt-1.5 flex items-center gap-2 font-mono text-base font-semibold text-ink bg-recessed/10 px-3 py-2 rounded-md border border-border"
            data-testid="referral-code"
          >
            {referralCode}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {shareAvailable && (
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-2 px-3 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-teal"
            >
              <Share2 size={16} />
              {t('common:buttons.share', 'Share')}
            </button>
          )}
          <a
            href={referralUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 border border-border hover:bg-recessed rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-teal"
          >
            <ExternalLink size={16} />
            {t('referrals:openLink', 'Open link')}
          </a>
        </div>
      </div>

      {/* Incentive summary */}
      <div className="mt-5 pt-4 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted font-sans">{t('referrals:rewardReferrer', 'You get')}</span>
          <span className="font-semibold text-ink font-mono">$150 {t('referrals:roastCredit', 'roast credit')}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted font-sans">{t('referrals:rewardReferee', 'They get')}</span>
          <span className="font-semibold text-ink font-mono">$100 {t('referrals:offFirstOrder', 'off first order') + ' + ' + t('referrals:freeKit', 'free sample kit')}</span>
        </div>
      </div>

      {/* Debug: qualify action (visible only when callback provided) */}
      {onQualifyReferral && (
        <button
          type="button"
          onClick={() => onQualifyReferral('ref_deliv_' + accountId)}
          className="mt-3 text-[10px] text-subtle font-mono underline hover:text-teal"
        >
          {t('referrals:simulateQualify', '[simulate qualify]')}
        </button>
      )}
    </section>
  );
};
