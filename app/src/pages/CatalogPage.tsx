import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelection, useCatalog, useUi, useRootStore } from '../stores/root-store';
import { CupScoreBadge } from '../components/CupScoreBadge';
import { LotForm, type LotFormOutput } from '../components/forms/LotForm';
import { lotToFormValues } from '../lib/lot-form-helpers';
import { Modal } from '../components/ui/Modal';
import {
  Search, Eye, GitCompare, Mail, Download, Grid, List,
  ArrowUpDown, ArrowUp, ArrowDown, Plus, Pencil, Archive, ShoppingCart
} from 'lucide-react';
import { fmtPricePerLb, fmtDate } from '../i18n/format';
import type { CoffeeLot, CoffeeLotPatch } from '../types/api';

type CatalogSortField = 'origin' | 'processingMethod' | 'elevation' | 'cupScore' | 'pricePerLbCents' | 'availableQuantityLbs' | 'esgScore' | 'estimatedArrival';

export const CatalogPage: React.FC = () => {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const { selectLot, selectedLotId, toggleCompare, compareTray } = useSelection();
  const catalog = useCatalog();
  const { lots, loading, loadLots, createLot, updateLot, retireLot, reserveLot } = catalog;
  const { pushToast } = useUi();
  const currentLocale = i18n.language;

  // Filter & Sort state
  const [search, setSearch] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<string>('all');
  const [minCup, setMinCup] = useState<number>(75);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sortField, setSortField] = useState<CatalogSortField>('cupScore');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // CRUD modals
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<CoffeeLot | null>(null);

  // Reserve modal
  const [reserveTarget, setReserveTarget] = useState<CoffeeLot | null>(null);
  const [reserveQty, setReserveQty] = useState<number>(0);
  const [reserveOrderId, setReserveOrderId] = useState('');

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  // Filter lots
  const filteredLots = useMemo(() => lots.filter((lot) => {
    const matchesSearch =
      lot.origin.toLowerCase().includes(search.toLowerCase()) ||
      (lot.varietal && lot.varietal.toLowerCase().includes(search.toLowerCase())) ||
      (lot.flavorNotes && lot.flavorNotes.some((n) => n.toLowerCase().includes(search.toLowerCase())));

    const matchesProcess = selectedProcess === 'all' || lot.processingMethod === selectedProcess;
    const matchesCup = lot.cupScore >= minCup;

    return matchesSearch && matchesProcess && matchesCup;
  }), [lots, search, selectedProcess, minCup]);

  // Sort lots
  const sortedLots = useMemo(() => [...filteredLots].sort((a, b) => {
    let aVal: string | number | null = a[sortField] as string | number | null;
    let bVal: string | number | null = b[sortField] as string | number | null;

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === 'string') {
      return sortAsc
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }
    return sortAsc
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  }), [filteredLots, sortField, sortAsc]);

  const handleSort = (field: CatalogSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getSortIcon = (field: CatalogSortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-subtle ml-1" />;
    return sortAsc
      ? <ArrowUp size={12} className="text-teal ml-1" />
      : <ArrowDown size={12} className="text-teal ml-1" />;
  };

  const exportCSV = () => {
    const headers = ['Lot ID', 'Origin', 'Varietal', 'Process', 'Elevation (m)', 'Cup Score', 'Price/lb ($)', 'Available (lbs)', 'ESG Score (%)', 'Certifications', 'ETA'];
    const rows = sortedLots.map((l) => [
      l.id,
      `"${l.origin.replace(/"/g, '""')}"`,
      `"${(l.varietal || '').replace(/"/g, '""')}"`,
      l.processingMethod ?? '',
      l.elevation ?? '',
      l.cupScore,
      (l.pricePerLbCents / 100).toFixed(2),
      l.availableQuantityLbs,
      l.esgScore ? Math.round(l.esgScore * 100) : '',
      `"${[
        l.certifications.organic && 'Organic',
        l.certifications.fairTrade && 'FairTrade',
        l.certifications.rainforestAlliance && 'Rainforest',
      ].filter(Boolean).join(', ')}"`,
      l.estimatedArrival || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `greensheet_catalog_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openCreate = () => {
    setEditingLot(null);
    setLotModalOpen(true);
  };

  const openEdit = (lot: CoffeeLot) => {
    setEditingLot(lot);
    setLotModalOpen(true);
  };

  const closeLotModal = () => {
    setLotModalOpen(false);
    setEditingLot(null);
  };

  const openReserve = (lot: CoffeeLot) => {
    setReserveTarget(lot);
    setReserveQty(0);
    setReserveOrderId('');
  };

  const closeReserve = () => {
    setReserveTarget(null);
    setReserveQty(0);
    setReserveOrderId('');
  };

  const handleCreateLot = async (data: LotFormOutput) => {
    const created = await createLot(data);
    if (created) {
      pushToast({ kind: 'success', message: 'Lot created' });
      closeLotModal();
    } else {
      const error = useRootStore.getState().catalog.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create lot' });
    }
  };

  const handleUpdateLot = async (data: LotFormOutput) => {
    if (!editingLot) return;
    const patch: CoffeeLotPatch = {
      pricePerLbCents: data.pricePerLbCents,
      availableQuantityLbs: data.availableQuantityLbs,
      esgScore: data.esgScore,
    };
    const updated = await updateLot(editingLot.id, patch);
    if (updated) {
      pushToast({ kind: 'success', message: 'Lot updated' });
      closeLotModal();
    } else {
      const error = useRootStore.getState().catalog.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update lot' });
    }
  };

  const handleRetire = async (lot: CoffeeLot) => {
    const updated = await retireLot(lot.id);
    if (updated) {
      pushToast({ kind: 'success', message: `${lot.origin} retired` });
    } else {
      const error = useRootStore.getState().catalog.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to retire lot' });
    }
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reserveTarget) return;
    const created = await reserveLot(reserveTarget.id, { quantityLbs: reserveQty, orderId: reserveOrderId });
    if (created) {
      pushToast({ kind: 'success', message: `Reserved ${reserveQty} lbs for order ${reserveOrderId}` });
      closeReserve();
    } else {
      const error = useRootStore.getState().catalog.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Reservation failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">
          {t('catalog.overline', 'GLOBAL INVENTORY LEDGER')}
        </span>
        <h1 className="text-3xl font-display font-medium text-ink">
          {t('catalog.title', 'Green Sheet Catalog')}
        </h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          {t('catalog.subtitle', 'Complete physical coffee offer list with sensory metrics, logistics ETA, and certified ESG audit tracking.')}
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-surface p-4 rounded-lg border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-e1">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder={t('catalog.toolbar.search', 'Search catalog…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
            />
            <Search className="absolute left-3 top-2.5 text-subtle" size={14} />
          </div>

          {/* Process select */}
          <select
            value={selectedProcess}
            onChange={(e) => setSelectedProcess(e.target.value)}
            className="px-3 py-1.5 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
          >
            <option value="all">{t('catalog.process.all', 'All Processes')}</option>
            <option value="washed">{t('catalog.process.washed', 'Washed')}</option>
            <option value="natural">{t('catalog.process.natural', 'Natural')}</option>
            <option value="honey">{t('catalog.process.honey', 'Honey')}</option>
            <option value="anaerobic">{t('catalog.process.anaerobic', 'Anaerobic')}</option>
          </select>

          {/* Min Cup Selector */}
          <select
            value={minCup}
            onChange={(e) => setMinCup(Number(e.target.value))}
            className="px-3 py-1.5 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
          >
            <option value="75">≥ 75.0 SCA</option>
            <option value="80">≥ 80.0 SCA (Specialty Floor)</option>
            <option value="85">≥ 85.0 SCA (Excellent)</option>
            <option value="90">≥ 90.0 SCA (Outstanding)</option>
          </select>
        </div>

        {/* View Options & Actions */}
        <div className="flex items-center justify-between md:justify-end gap-4">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
          >
            <Plus size={16} />
            Add Lot
          </button>

          {/* Density Toggle */}
          <div className="bg-recessed p-0.5 rounded-md flex gap-0.5" role="group" aria-label="Row density">
            <button
              onClick={() => setDensity('comfortable')}
              className={`p-1.5 rounded-sm transition-all focus-visible:ring-1 focus-visible:ring-teal ${
                density === 'comfortable' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
              title="Comfortable row height"
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setDensity('compact')}
              className={`p-1.5 rounded-sm transition-all focus-visible:ring-1 focus-visible:ring-teal ${
                density === 'compact' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
              title="Compact row height"
            >
              <List size={14} />
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border-interactive hover:bg-hover/20 text-ink text-sm font-semibold rounded-md transition-all active:scale-95"
          >
            <Download size={14} />
            {t('common:buttons.export', 'Export Sheet')}
          </button>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && lots.length === 0 ? (
            <div className="p-6 text-muted font-sans">{t('common:states.loading', 'Loading…')}</div>
          ) : (
            <table className="w-full border-collapse text-left text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-navy text-ink bg-recessed/30">
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none" onClick={() => handleSort('origin')}>
                    <span className="flex items-center">{t('catalog.table.lot', 'LOT / ORIGIN')} {getSortIcon('origin')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none" onClick={() => handleSort('processingMethod')}>
                    <span className="flex items-center">{t('catalog.table.process', 'PROCESS')} {getSortIcon('processingMethod')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none text-right" onClick={() => handleSort('elevation')}>
                    <span className="flex items-center justify-end">{t('catalog.table.elevation', 'ELEVATION')} {getSortIcon('elevation')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none text-center" onClick={() => handleSort('cupScore')}>
                    <span className="flex items-center justify-center">{t('catalog.table.cup', 'CUP')} {getSortIcon('cupScore')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none text-right" onClick={() => handleSort('pricePerLbCents')}>
                    <span className="flex items-center justify-end">{t('catalog.table.price', 'PRICE/LB')} {getSortIcon('pricePerLbCents')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none text-right" onClick={() => handleSort('availableQuantityLbs')}>
                    <span className="flex items-center justify-end">{t('catalog.table.available', 'AVAILABLE')} {getSortIcon('availableQuantityLbs')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none text-right" onClick={() => handleSort('esgScore')}>
                    <span className="flex items-center justify-end">{t('catalog.table.esg', 'ESG %')} {getSortIcon('esgScore')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider text-center">
                    <span>{t('catalog.table.certs', 'CERTS')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider cursor-pointer select-none" onClick={() => handleSort('estimatedArrival')}>
                    <span className="flex items-center">{t('catalog.table.eta', 'ETA')} {getSortIcon('estimatedArrival')}</span>
                  </th>
                  <th className="px-4 py-3 font-semibold overline text-xs tracking-wider text-center">
                    <span>{t('catalog.table.status', 'STATUS')}</span>
                  </th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {sortedLots.map((lot, idx) => {
                  const isSelected = selectedLotId === lot.id;
                  const rowHeightClass = density === 'compact' ? 'py-2 h-10' : 'py-3.5 h-12';

                  // Calculate percentage of available quantity relative to production
                  const pctAvailable = lot.totalProductionLbs > 0
                    ? Math.round((lot.availableQuantityLbs / lot.totalProductionLbs) * 100)
                    : 0;

                  return (
                    <tr
                      key={lot.id}
                      onClick={() => selectLot(lot.id)}
                      className={`hover:bg-hover/20 cursor-pointer transition-colors group ${
                        idx % 2 === 1 ? 'bg-recessed/10' : 'bg-surface'
                      } ${isSelected ? 'bg-teal/5' : ''}`}
                    >
                      {/* Lot Origin */}
                      <td className={`px-4 ${rowHeightClass} font-sans`}>
                        <span className="font-semibold text-ink block">{lot.origin}</span>
                        {lot.varietal && (
                          <span className="text-xs text-subtle font-sans">{lot.varietal}</span>
                        )}
                      </td>

                      {/* Process */}
                      <td className={`px-4 ${rowHeightClass}`}>
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-recessed text-ink capitalize font-sans">
                          {t(`process.${lot.processingMethod}`, lot.processingMethod ?? '—')}
                        </span>
                      </td>

                      {/* Elevation */}
                      <td className={`px-4 ${rowHeightClass} text-right font-mono figure text-ink`}>
                        {lot.elevation ?? '—'}m
                      </td>

                      {/* Cup */}
                      <td className={`px-4 ${rowHeightClass} text-center`}>
                        <CupScoreBadge score={lot.cupScore} />
                      </td>

                      {/* Price/lb */}
                      <td className={`px-4 ${rowHeightClass} text-right font-mono figure-strong text-ink`}>
                        {fmtPricePerLb(currentLocale, lot.pricePerLbCents)}
                      </td>

                      {/* Available */}
                      <td className={`px-4 ${rowHeightClass} text-right font-mono`}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="figure text-ink">{lot.availableQuantityLbs.toLocaleString()} lb</span>
                          {/* Progress line */}
                          <div className="w-20 h-1 bg-recessed rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal"
                              style={{ width: `${pctAvailable}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* ESG % */}
                      <td className={`px-4 ${rowHeightClass} text-right font-mono figure text-ink`}>
                        {lot.esgScore ? `${Math.round(lot.esgScore * 100)}%` : '—'}
                      </td>

                      {/* Certifications */}
                      <td className={`px-4 ${rowHeightClass} text-center`}>
                        <div className="flex items-center justify-center gap-1">
                          {lot.certifications.organic && <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-success-bg text-success text-[9px] font-bold rounded-sm border border-success/10" title="Organic Certified">ORG</span>}
                          {lot.certifications.fairTrade && <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-success-bg text-success text-[9px] font-bold rounded-sm border border-success/10" title="Fair Trade">FT</span>}
                          {lot.certifications.rainforestAlliance && <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-success-bg text-success text-[9px] font-bold rounded-sm border border-success/10" title="Rainforest Alliance">RA</span>}
                          {!lot.certifications.organic && !lot.certifications.fairTrade && !lot.certifications.rainforestAlliance && <span className="text-subtle text-xs">—</span>}
                        </div>
                      </td>

                      {/* ETA */}
                      <td className={`px-4 ${rowHeightClass} font-mono text-xs text-muted`}>
                        {lot.estimatedArrival ? fmtDate(currentLocale, lot.estimatedArrival) : '—'}
                      </td>

                      {/* Status */}
                      <td className={`px-4 ${rowHeightClass} text-center`}>
                        <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider ${
                          lot.status === 'active' ? 'bg-success-bg text-success border border-success/10' : 'bg-recessed text-muted border border-border'
                        }`}>
                          {lot.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className={`px-4 ${rowHeightClass} text-right`}>
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openReserve(lot); }}
                            className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md"
                            aria-label={`Reserve ${lot.origin}`}
                            title="Reserve"
                          >
                            <ShoppingCart size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(lot); }}
                            className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md"
                            aria-label={`Edit ${lot.origin}`}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleRetire(lot); }}
                            className="p-1 text-muted hover:text-danger hover:bg-danger-bg rounded-md"
                            aria-label={`Retire ${lot.origin}`}
                            title="Retire"
                          >
                            <Archive size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectLot(lot.id);
                            }}
                            className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md"
                            title="Quick View"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(lot.id);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              compareTray.includes(lot.id)
                                ? 'text-teal bg-teal/10 font-bold'
                                : 'text-muted hover:text-ink hover:bg-recessed'
                            }`}
                            title={compareTray.includes(lot.id) ? 'Remove from Compare' : 'Add to Compare'}
                          >
                            <GitCompare size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Requesting sample for lot ${lot.id}`);
                            }}
                            className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md"
                            title="Mail Sample"
                          >
                            <Mail size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer / Pagination */}
        <div className="px-4 py-3 bg-recessed/30 border-t border-border flex items-center justify-between font-mono text-xs text-muted">
          <span>
            {t('catalog.pagination.range', 'Showing')} 1–{sortedLots.length} {t('catalog.pagination.of', 'of')} {lots.length} {t('catalog.pagination.lots', 'lots')}
          </span>
          <div className="flex items-center gap-1">
            <button className="px-2.5 py-1 border border-border-interactive rounded-md bg-surface text-ink hover:bg-hover/20 opacity-45 cursor-not-allowed" disabled>
              Prev
            </button>
            <button className="px-2.5 py-1 border border-border-interactive rounded-md bg-surface text-ink hover:bg-hover/20 opacity-45 cursor-not-allowed" disabled>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Lot Modal */}
      <Modal
        isOpen={lotModalOpen}
        onClose={closeLotModal}
        title={editingLot ? 'Edit Lot' : 'Add Lot'}
        size="lg"
      >
        <LotForm
          onSubmit={editingLot ? handleUpdateLot : handleCreateLot}
          defaultValues={editingLot ? lotToFormValues(editingLot) : undefined}
        />
      </Modal>

      {/* Reserve Modal */}
      <Modal
        isOpen={!!reserveTarget}
        onClose={closeReserve}
        title={`Reserve ${reserveTarget?.origin ?? 'Lot'}`}
        size="sm"
      >
        <form onSubmit={handleReserve} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="reserve-qty" className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">Quantity (lbs)</label>
            <input
              id="reserve-qty"
              type="number"
              min={1}
              value={reserveQty || ''}
              onChange={(e) => setReserveQty(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="reserve-order" className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">Order ID</label>
            <input
              id="reserve-order"
              type="text"
              value={reserveOrderId}
              onChange={(e) => setReserveOrderId(e.target.value)}
              className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeReserve}
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink bg-surface border border-border rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-navy hover:bg-navy-800 rounded-md transition-colors"
            >
              Reserve
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
