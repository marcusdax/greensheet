import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, RefreshCw, QrCode, ExternalLink, Check, Clock, Package, ShoppingCart, Users, X } from 'lucide-react';
import { useReferrals, useCrm, useUi } from '../stores/root-store';
import { ReferralDeliveryCard } from '../components/ReferralDeliveryCard';
import { Modal } from '../components/ui/Modal';
import { DataTable } from '../components/ui/DataTable';
import type { ColumnDef } from '../components/ui/DataTable';
import type { Referral, ReferralStatus, RewardLedgerEntry } from '../types/api';

const REFERRAL_BASE = 'https://auctum.io/r/';

const statusOrder: ReferralStatus[] = [
  'invited',
  'clicked',
  'signed_up',
  'kit_requested',
  'kit_delivered',
  'feedback_submitted',
  'first_order_delivered',
  'qualified',
  'clawed_back',
  'declined',
];

const statusLabels: Record<ReferralStatus, string> = {
  invited: 'Invited',
  clicked: 'Clicked',
  signed_up: 'Signed Up',
  kit_requested: 'Kit Requested',
  kit_delivered: 'Kit Delivered',
  feedback_submitted: 'Feedback Submitted',
  first_order_delivered: 'First Order Delivered',
  qualified: 'Qualified',
  clawed_back: 'Clawed Back',
  declined: 'Declined',
};

// Local icon stubs for statuses without direct lucide equivalents
const ClipboardIcon = Package;
const UndoIcon = Clock;

const statusIcons: Record<ReferralStatus, React.ElementType> = {
  invited: Clock,
  clicked: ExternalLink,
  signed_up: Users,
  kit_requested: Package,
  kit_delivered: Package,
  feedback_submitted: ClipboardIcon,
  first_order_delivered: ShoppingCart,
  qualified: Check,
  clawed_back: UndoIcon,
  declined: X,
};

const statusColorClass = (status: ReferralStatus) => {
  switch (status) {
    case 'qualified':
      return 'bg-success-bg text-success border-success/10';
    case 'clawed_back':
    case 'declined':
      return 'bg-danger-bg text-danger border-danger/15';
    case 'first_order_delivered':
      return 'bg-info-bg text-info border-info/15';
    case 'kit_delivered':
    case 'feedback_submitted':
      return 'bg-warning-bg text-warning border-warning/15';
    default:
      return 'bg-recessed text-muted border-border';
  }
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function statusIndex(status: ReferralStatus): number {
  return statusOrder.indexOf(status);
}

function buildReferralUrl(code: string): string {
  return `${REFERRAL_BASE}${code}?utm_source=referral&utm_medium=invite_link&utm_campaign=ref_core_2025`;
}

export const ReferralsPage: React.FC = () => {
  const { t } = useTranslation(['referrals', 'common']);
  const { referrals, code, stats, ledger, loading, error, loadCode, loadReferrals, loadStats, loadLedger } = useReferrals();
  const { roasters, loadRoasters } = useCrm();
  const { pushToast } = useUi();

  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Default to first roaster account for demo
  useEffect(() => {
    void loadRoasters();
  }, [loadRoasters]);

  useEffect(() => {
    if (roasters.length > 0 && !selectedAccountId) {
      const activeRoaster = roasters.find((r) => r.status === 'active') ?? roasters[0];
      setSelectedAccountId(activeRoaster.id);
    }
  }, [roasters, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    void loadReferrals(selectedAccountId);
    void loadStats(selectedAccountId);
    void loadLedger(selectedAccountId);
    void loadCode(selectedAccountId);
  }, [selectedAccountId, loadReferrals, loadStats, loadLedger, loadCode]);

  const selectedRoasterName = useMemo(() => {
    if (!selectedAccountId) return '';
    return roasters.find((r) => r.id === selectedAccountId)?.roasterName ?? '';
  }, [selectedAccountId, roasters]);

  const primaryCode = code?.status === 'active' ? code?.code : '';

  const columns = useMemo<ColumnDef<Referral>[]>(
    () => [
      {
        key: 'referee',
        header: 'Referee',
        accessor: (row) => {
          const referee = row.refereeId ? roasters.find((r) => r.id === row.refereeId) : null;
          return <span className="font-semibold text-ink">{referee?.roasterName ?? row.refereeId ?? t('referrals:anonymous', 'Anonymous')}</span>;
        },
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (row) => (
          <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider border ${statusColorClass(row.status)}`}>
            {statusLabels[row.status]}
          </span>
        ),
      },
      {
        key: 'channel',
        header: 'Channel',
        accessor: (row) => <span className="text-sm text-muted font-mono">{row.channel}</span>,
      },
      {
        key: 'qualified',
        header: 'Qualified At',
        accessor: (row) => <span className="text-xs text-muted font-mono">{formatDate(row.qualifiedAt)}</span>,
      },
      {
        key: 'amount',
        header: 'Reward',
        accessor: (row) => {
          if (row.status === 'qualified') return <span className="text-sm font-mono font-semibold text-teal">+$150</span>;
          if (row.status === 'clawed_back') return <span className="text-sm font-mono text-danger">-$150</span>;
          return <span className="text-xs text-muted">pending</span>;
        },
      },
    ],
    [roasters, t],
  );

  const ledgerColumns = useMemo<ColumnDef<RewardLedgerEntry>[]>(
    () => [
      {
        key: 'type',
        header: 'Type',
        accessor: (row) => (
          <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
            {row.type === 'referrer_credit' ? 'Referrer Credit' : 'Referee Discount'}
          </span>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        accessor: (row) => <span className="font-mono">${(row.amountCents / 100).toFixed(2)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        accessor: (row) => (
          <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider border ${
            row.status === 'posted' ? 'bg-success-bg text-success border-success/10'
            : row.status === 'clawed_back' ? 'bg-danger-bg text-danger border-danger/15'
            : 'bg-warning-bg text-warning border-warning/15'
          }`}>
            {row.status}
          </span>
        ),
      },
      {
        key: 'created',
        header: 'Date',
        accessor: (row) => <span className="text-xs text-muted font-mono">{formatDate(row.createdAt)}</span>,
      },
      {
        key: 'description',
        header: 'Description',
        accessor: (row) => <span className="text-sm text-ink">{row.description}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('referrals:overline', 'REFERRALS')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('referrals:title', 'Referrals')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            {t('referrals:subtitle', 'Manage your referral program. Track invites, rewards, and share your unique code.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!selectedAccountId) return;
            void loadReferrals(selectedAccountId);
            void loadStats(selectedAccountId);
            void loadLedger(selectedAccountId);
            void loadCode(selectedAccountId);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 disabled:opacity-50 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common:actions.refresh', 'Refresh')}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-md border border-cherry/30 bg-cherry/10 text-cherry"
        >
          <span className="text-sm font-semibold">{error.detail ?? error.title}</span>
        </div>
      )}

      {/* Delivery card (in-product referral prompt) */}
      {primaryCode && selectedAccountId && (
        <ReferralDeliveryCard
          accountId={selectedAccountId}
          roasterName={selectedRoasterName}
          referralCode={primaryCode}
          onQualifyReferral={(referralId: string) => {
            // This is a demo hook — in production, the qualify endpoint
            // is invoked server-side when the referee's first order is delivered.
            void referralId;
            pushToast({ kind: 'info', message: t('referrals:qualifyNote', 'Referral qualification is driven by referee first-order delivery.') });
          }}
        />
      )}

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label={t('referrals:stats.invitesSent', 'Invites sent')}
            value={stats.invitesSent}
          />
          <StatCard
            icon={Check}
            label={t('referrals:stats.qualified', 'Qualified')}
            value={stats.qualifiedReferrals}
          />
          <StatCard
            icon={Clock}
            label={t('referrals:stats.kFactor', 'K-factor')}
            value={stats.kFactor}
          />
          <StatCard
            icon={Copy}
            label={t('referrals:stats.earned', 'Earned credits')}
            value={`$${(stats.earnedRewardsCents / 100).toFixed(0)}`}
          />
        </div>
      )}

      {/* Referral code */}
      <div className="bg-surface border border-border-strong rounded-lg p-4 shadow-e1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold text-ink">
            {t('referrals:codeSection', 'Your Referral Code')}
          </h2>
          <button
            type="button"
            onClick={() => setShowCodeModal(true)}
            className="text-xs font-sans text-teal hover:text-teal/80"
          >
            {t('referrals:viewAllCodes', 'View all codes')}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="px-4 py-2 bg-recessed/10 border border-border rounded-md font-mono text-xl font-semibold text-ink"
            data-testid="referral-code"
          >
            {primaryCode || t('referrals:noCode', 'Loading…')}
          </div>
          {primaryCode && (
            <a
              href={buildReferralUrl(primaryCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-muted hover:text-ink rounded-md hover:bg-recessed transition-colors"
              aria-label={t('referrals:openLink', 'Open referral link')}
            >
              <ExternalLink size={16} />
            </a>
          )}
          {primaryCode && (
            <CopyLinkButton code={primaryCode} url={buildReferralUrl(primaryCode)} />
          )}
        </div>
      </div>

      {/* Referrals table */}
      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-display font-medium text-ink">
            {t('referrals:referralsList', 'Your Referrals')}
          </h2>
        </div>
        {loading && referrals.length === 0 ? (
          <div className="p-8 text-center text-muted font-sans">{t('common:states.loading', 'Loading…')}</div>
        ) : (
          <DataTable
            data={referrals}
            columns={columns}
            keyExtractor={(r) => r.id}
            onRowClick={(r) => setSelectedReferral(r)}
            emptyMessage={
              <div className="text-center">
                <p className="text-muted font-sans">{t('referrals:empty', 'No referrals yet. Share your code to get started.')}</p>
              </div>
            }
          />
        )}
      </div>

      {/* Reward ledger */}
      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-display font-medium text-ink">
            {t('referrals:ledgerTitle', 'Reward Ledger')}
          </h2>
        </div>
        {ledger.length === 0 ? (
          <div className="p-6 text-center text-muted font-sans">
            {t('referrals:ledgerEmpty', 'No reward entries yet.')}
          </div>
        ) : (
          <DataTable
            data={ledger}
            columns={ledgerColumns}
            keyExtractor={(e) => e.id}
            emptyMessage={<div className="text-center text-muted">{t('referrals:ledgerEmpty', 'No reward entries yet.')}</div>}
          />
        )}
      </div>

      {/* Referral detail drawer */}
      <DetailDrawer referral={selectedReferral ?? undefined} onClose={() => setSelectedReferral(null)} />

      {/* All codes modal */}
      <Modal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        title={t('referrals:allCodesTitle', 'All Referral Codes')}
        size="md"
      >
        <div className="space-y-3">
          {code && (
            <div key={code.id} className="flex items-center justify-between p-3 bg-recessed/10 rounded-md border border-border">
              <div className="flex items-center gap-3">
                <QrCode size={20} className="text-teal" />
                <div>
                  <code className="font-mono font-semibold text-ink">{code.code}</code>
                  <div className="text-[10px] text-muted font-sans mt-0.5">
                    {t('referrals:codeStatus', 'Status')}: {code.status}
                  </div>
                </div>
              </div>
              <CopyLinkButton code={code.code} url={buildReferralUrl(code.code)} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border-strong rounded-lg p-3 shadow-e1">
      <div className="flex items-start gap-2">
        <div className="p-1.5 bg-teal/10 rounded-md">
          <Icon size={16} className="text-teal" />
        </div>
        <div>
          <div className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
            {label}
          </div>
          <div className="text-xl font-display font-semibold text-ink">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyLinkButton({ code, url }: { code: string; url: string }) {
  const { pushToast } = useUi();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushToast({ kind: 'success', message: url });
    } catch {
      pushToast({ kind: 'error', message: 'Failed to copy link' });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`p-1.5 rounded-md border border-border hover:bg-recessed transition-colors focus-visible:ring-2 focus-visible:ring-teal ${
        copied ? 'text-teal bg-teal/10' : 'text-muted'
      }`}
      aria-label={`Copy referral link for ${code}`}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

interface DetailDrawerProps {
  referral?: Referral;
  onClose: () => void;
}

function DetailDrawer({ referral, onClose }: DetailDrawerProps) {
  const { t } = useTranslation(['referrals', 'common']);

  if (!referral) return null;

  const steps = statusOrder.slice(
    0,
    statusIndex(referral.status) + 1,
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={t('referrals:detailTitle', 'Referral Detail')}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
              {t('referrals:detail.refCode', 'Referral code')}
            </span>
            <code className="block font-mono text-ink mt-0.5">{referral.refCode}</code>
          </div>
          <div>
            <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
              {t('referrals:detail.status', 'Status')}
            </span>
            <span className="block text-ink mt-0.5">{statusLabels[referral.status]}</span>
          </div>
          <div>
            <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
              {t('referrals:detail.channel', 'Channel')}
            </span>
            <span className="block text-ink mt-0.5">{referral.channel}</span>
          </div>
          <div>
            <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">
              {t('referrals:detail.referredAt', 'Referred at')}
            </span>
            <span className="block text-ink mt-0.5">{formatDate(referral.createdAt)}</span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-sans font-semibold text-muted uppercase tracking-wider mb-3">
            {t('referrals:detail.funnel', 'Funnel Progress')}
          </h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {steps.map((step, index) => {
              const Icon = statusIcons[step];
              return (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center min-w-[72px] text-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-teal text-white border-2 border-teal">
                      <Icon size={12} />
                    </div>
                    <span className="text-[9px] font-sans mt-1 leading-tight text-ink">
                      {statusLabels[step]}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 bg-teal min-w-[12px]" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {referral.status === 'qualified' && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted font-sans">{t('referrals:detail.reward', 'Reward posted')}</span>
              <span className="font-semibold text-teal font-mono">+$150</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
