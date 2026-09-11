import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Link, QrCode, Mail, Share2 } from 'lucide-react';
import { useReferralCode } from '../../stores/selectors/referral-selectors';

const channels: { key: string; icon: any }[] = [
  { key: 'invite_link', icon: Link },
  { key: 'qr_sticker', icon: QrCode },
  { key: 'email_share', icon: Mail },
  { key: 'instagram_dm', icon: Share2 },
  { key: 'event_badge', icon: Share2 },
];

const buildUrl = (code: string, accountId: string, channel: string) =>
  `https://greensheet.com/r/${code}?utm_source=referral&utm_medium=${channel}&utm_campaign=ref_core_2025&utm_content=${accountId}:${channel}`;

export const ReferralShareCard: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { t } = useTranslation('referrals');
  const code = useReferralCode();
  const [selectedChannel, setSelectedChannel] = useState('invite_link');
  const [copied, setCopied] = useState(false);

  const url = code ? buildUrl(code.code, accountId, selectedChannel) : '';

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-e1">
      <h2 className="font-display text-xl text-ink mb-4">{t('share.title', 'Share Your Referral Link')}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {channels.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedChannel(key)}
            className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
              selectedChannel === key ? 'bg-navy text-white' : 'bg-recessed text-ink hover:bg-surface'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(`channels.${key}`, key)}
          </button>
        ))}
      </div>
      {code ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 bg-recessed border border-border rounded-md px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 bg-navy text-white rounded-md hover:bg-navy-700 transition-colors flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? t('share.copied', 'Copied!') : t('share.copy', 'Copy link')}
          </button>
        </div>
      ) : (
        <p className="text-muted">{t('code.loading', 'Loading…')}</p>
      )}
    </div>
  );
};
