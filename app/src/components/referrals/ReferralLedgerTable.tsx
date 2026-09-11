import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReferrals } from '../../stores/root-store';
import { DataTable } from '../ui/DataTable';
import type { ColumnDef } from '../ui/DataTable';
import type { RewardLedgerEntry } from '../../types/api';

const typeClass: Record<string, string> = {
  referrer_credit: 'bg-teal/10 text-teal',
  referee_discount: 'bg-gold/20 text-ink',
};

const statusClass: Record<string, string> = {
  pending: 'bg-warning-bg text-warning',
  posted: 'bg-success-bg text-success',
  clawed_back: 'bg-danger-bg text-danger',
};

export const ReferralLedgerTable: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { t } = useTranslation('referrals');
  const { ledger, loading, loadLedger } = useReferrals();

  useEffect(() => {
    void loadLedger(accountId);
  }, [accountId, loadLedger]);

  const columns: ColumnDef<RewardLedgerEntry>[] = [
    {
      key: 'createdAt',
      header: t('ledgerTable.date', 'Date'),
      accessor: (row) => row.createdAt,
    },
    {
      key: 'type',
      header: t('ledgerTable.type', 'Type'),
      render: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${typeClass[row.type] ?? 'bg-recessed text-muted'}`}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('ledgerTable.amount', 'Amount'),
      accessor: (row) => `$${(row.amountCents / 100).toFixed(2)}`,
    },
    {
      key: 'status',
      header: t('ledgerTable.status', 'Status'),
      render: (row) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${statusClass[row.status] ?? 'bg-recessed text-muted'}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'description',
      header: t('ledgerTable.description', 'Description'),
      accessor: (row) => row.description,
    },
  ];

  if (loading) return <p className="text-muted">{t('states.loading', 'Loading...')}</p>;

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-e1">
      <h2 className="font-display text-xl text-ink mb-4">{t('ledgerTable.title', 'Reward Ledger')}</h2>
      <DataTable data={ledger} columns={columns} keyExtractor={(row) => row.id} />
    </div>
  );
};
