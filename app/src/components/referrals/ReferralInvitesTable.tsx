import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReferrals } from '../../stores/root-store';
import { DataTable } from '../ui/DataTable';
import type { ColumnDef } from '../ui/DataTable';
import type { Referral } from '../../types/api';

const statusClass: Record<string, string> = {
  invited: 'bg-info-bg text-info',
  clicked: 'bg-info-bg text-info',
  signed_up: 'bg-info-bg text-info',
  kit_requested: 'bg-warning-bg text-warning',
  kit_delivered: 'bg-warning-bg text-warning',
  feedback_submitted: 'bg-warning-bg text-warning',
  first_order_delivered: 'bg-warning-bg text-warning',
  qualified: 'bg-success-bg text-success',
  clawed_back: 'bg-danger-bg text-danger',
};

export const ReferralInvitesTable: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { t } = useTranslation('referrals');
  const { referrals, loading, loadReferrals, qualify, clawBack } = useReferrals();

  useEffect(() => {
    void loadReferrals(accountId);
  }, [accountId, loadReferrals]);

  const columns: ColumnDef<Referral>[] = [
    {
      key: 'referee',
      header: t('invitesTable.referee', 'Referee'),
      accessor: (row) => row.refereeId ?? t('invitesTable.pending', 'Pending'),
    },
    {
      key: 'channel',
      header: t('invitesTable.channel', 'Channel'),
      accessor: (row) => row.channel,
    },
    {
      key: 'status',
      header: t('invitesTable.status', 'Status'),
      render: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass[row.status] ?? 'bg-recessed text-muted'}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('invitesTable.date', 'Date'),
      accessor: (row) => row.createdAt,
    },
    {
      key: 'actions',
      header: t('invitesTable.actions', 'Actions'),
      render: (row) => (
        <div className="flex gap-2">
          {row.status !== 'qualified' && row.status !== 'clawed_back' && (
            <button
              type="button"
              className="px-2 py-1 text-xs bg-teal text-white rounded-md hover:bg-teal-700"
              onClick={() => qualify(row.id)}
            >
              {t('invitesTable.qualify', 'Qualify')}
            </button>
          )}
          {row.status === 'qualified' && (
            <button
              type="button"
              className="px-2 py-1 text-xs bg-danger-bg text-danger rounded-md hover:bg-danger/20"
              onClick={() => clawBack(row.id)}
            >
              {t('invitesTable.clawBack', 'Claw Back')}
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <p className="text-muted">{t('states.loading', 'Loading...')}</p>;

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-e1">
      <h2 className="font-display text-xl text-ink mb-4">{t('invitesTable.title', 'Invites')}</h2>
      <DataTable data={referrals} columns={columns} keyExtractor={(row) => row.id} />
    </div>
  );
};
