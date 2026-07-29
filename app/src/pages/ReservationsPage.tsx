import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../stores/root-store';
import { DataTable } from '../components/ui/DataTable';
import { fmtDate } from '../i18n/format';
import type { ColumnDef } from '../components/ui/DataTable';
import type { Reservation } from '../types/api';

export const ReservationsPage: React.FC = () => {
  const { t, i18n } = useTranslation(['common']);
  const { locale } = useParams<{ locale: string }>();
  const { reservations, lots, loading, loadLots } = useCatalog();
  const currentLocale = i18n.language;

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  const activeReservations = useMemo(
    () => reservations.filter((r) => r.status === 'active'),
    [reservations],
  );

  const columns = useMemo<ColumnDef<Reservation>[]>(
    () => [
      {
        key: 'lot',
        header: 'Lot',
        accessor: (row) => {
          const lot = lots.find((l) => l.id === row.lotId);
          return (
            <Link
              to={`/${locale ?? currentLocale}/catalog`}
              className="text-teal hover:text-navy font-sans text-sm font-semibold focus-visible:ring-2 focus-visible:ring-teal rounded-sm"
            >
              {lot ? lot.origin : row.lotId}
            </Link>
          );
        },
      },
      {
        key: 'order',
        header: 'Order',
        accessor: (row) => (
          <Link
            to={`/${locale ?? currentLocale}/orders`}
            className="text-teal hover:text-navy font-mono text-xs focus-visible:ring-2 focus-visible:ring-teal rounded-sm"
          >
            {row.orderId}
          </Link>
        ),
      },
      {
        key: 'quantity',
        header: 'Quantity',
        align: 'right',
        accessor: (row) => <span className="font-mono figure">{row.quantityLbs.toLocaleString()} lb</span>,
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        accessor: (row) => (
          <span className="inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider bg-success-bg text-success border border-success/10">
            {row.status}
          </span>
        ),
      },
      {
        key: 'expires',
        header: 'Expires',
        accessor: (row) => (
          <span className="font-mono text-xs text-muted">{fmtDate(currentLocale, row.expiresAt)}</span>
        ),
      },
    ],
    [lots, locale, currentLocale],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">INVENTORY RESERVATIONS</span>
        <h1 className="text-3xl font-display font-medium text-ink">Active Reservations</h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          Lots currently reserved against orders. Reservations expire automatically unless consumed.
        </p>
      </div>

      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        {loading && activeReservations.length === 0 ? (
          <div className="p-8 text-center text-muted font-sans">
            {t('common:states.loading')}
          </div>
        ) : (
          <DataTable
            data={activeReservations}
            columns={columns}
            keyExtractor={(row) => row.id}
            emptyMessage={
              <div className="text-center space-y-3">
                <p className="text-muted font-sans">No active reservations.</p>
                <Link
                  to={`/${locale ?? currentLocale}/orders`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {t('common:nav.orders')}
                </Link>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
};
