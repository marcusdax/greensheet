import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReferrals } from '../stores/root-store';
import { DataTable } from '../components/ui/DataTable';
import type { ColumnDef } from '../components/ui/DataTable';
import type { Referral } from '../types/api';

export const ReviewQueuePage: React.FC = () => {
  const { t } = useTranslation(['referrals', 'common']);
  const { reviewQueue, loading, loadReviewQueue, approveReview, declineReview } = useReferrals();

  useEffect(() => {
    void loadReviewQueue();
  }, [loadReviewQueue]);

  const columns: ColumnDef<Referral>[] = [
    {
      key: 'referrerId',
      header: t('referrals:reviewQueue.referrer'),
      accessor: (row) => row.referrerId ?? '',
    },
    {
      key: 'refereeId',
      header: t('referrals:reviewQueue.referee'),
      accessor: (row) => row.refereeId ?? '',
    },
    {
      key: 'refCode',
      header: t('referrals:code.title'),
      accessor: (row) => row.refCode ?? '',
    },
    {
      key: 'reviewStatus',
      header: t('referrals:reviewQueue.reason'),
      accessor: (row) => row.reviewStatus ?? '',
    },
    {
      key: 'actions',
      header: t('referrals:invitesTable.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-teal text-white rounded-md hover:bg-teal-700 transition-colors text-sm"
            onClick={() => approveReview(row.id)}
          >
            {t('referrals:reviewQueue.approve')}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-surface border border-border rounded-md hover:bg-recessed transition-colors text-sm"
            onClick={() => declineReview(row.id)}
          >
            {t('referrals:reviewQueue.decline')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-3xl text-ink">{t('referrals:reviewQueue.title')}</h1>
      {loading ? (
        <p className="text-muted">{t('common:states.loading')}</p>
      ) : reviewQueue.length === 0 ? (
        <p className="text-muted">{t('common:states.empty')}</p>
      ) : (
        <DataTable
          data={reviewQueue}
          columns={columns}
          keyExtractor={(row) => row.id}
        />
      )}
    </div>
  );
};