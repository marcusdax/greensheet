import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelection } from '../stores/root-store';
import { lots } from '../data/lots';
import { CupScoreBadge } from './CupScoreBadge';
import { X } from 'lucide-react';
import { fmtCurrency, fmtDate } from '../i18n/format';

export const LotDetailDrawer: React.FC = () => {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const { selectedLotId, selectLot } = useSelection();
  
  if (!selectedLotId) return null;
  
  const lot = lots.find((l) => l.id === selectedLotId);
  if (!lot) return null;

  const currentLocale = i18n.language;

  // Calculate some mock margin data for the price table
  const markup = lot.pricePerLb - lot.costPerLb;
  const marginPct = (markup / lot.pricePerLb) * 100;

  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true">
      {/* Scrim */}
      <div 
        className="absolute inset-0 bg-navy-900/50 backdrop-blur-xs" 
        onClick={() => selectLot(null)}
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[480px] bg-surface shadow-e5 flex flex-col border-l border-border animate-slide-in">
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-start">
          <div>
            <span className="overline text-xs text-muted block mb-1">
              {t('lot.details.overline', 'COFFEE LOT SHEET')}
            </span>
            <h2 className="text-2xl font-display font-medium text-ink">
              {lot.origin}
            </h2>
            {lot.varietal && (
              <p className="text-sm text-muted font-sans mt-0.5">
                {lot.varietal} • {t(`process.${lot.processingMethod}`, lot.processingMethod)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CupScoreBadge score={lot.cupScore} size="lg" />
            <button 
              onClick={() => selectLot(null)}
              className="p-1 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
              aria-label={t('common:buttons.close', 'Close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sensory Profile */}
          {lot.sensoryProfile && (
            <div className="space-y-3">
              <h3 className="overline text-xs text-muted">
                {t('lot.details.sensoryProfile', 'SENSORY PROFILE')}
              </h3>
              <div className="space-y-2.5 bg-recessed/30 p-4 rounded-lg border border-border">
                {Object.entries(lot.sensoryProfile).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-muted">{t(`lot.sensory.${key}`, key)}</span>
                      <span className="figure font-mono font-medium">{val.toFixed(1)}/10.0</span>
                    </div>
                    <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal transition-all duration-slower" 
                        style={{ width: `${val * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flavor Notes */}
          {lot.flavorNotes && (
            <div className="space-y-2">
              <h3 className="overline text-xs text-muted">
                {t('lot.details.flavorNotes', 'FLAVOR NOTES')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {lot.flavorNotes.map((note) => (
                  <span 
                    key={note} 
                    className="px-2.5 py-0.5 bg-recessed text-ink text-xs rounded-full font-sans border border-border"
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Q-Grader Quote */}
          <div className="border-l-2 border-gold pl-4 py-1 italic font-serif text-muted bg-gold/5 rounded-r-md">
            "A beautifully complex coffee exhibiting notes of honey-like sweetness and vibrant stone fruits. Outstanding cup cleaness with an elegant finish."
            <span className="block text-xs font-sans not-italic text-subtle mt-1.5">
              — Licensed Q-Grader Sensory Report
            </span>
          </div>

          {/* Specifications Table */}
          <div className="space-y-2">
            <h3 className="overline text-xs text-muted">
              {t('lot.details.specifications', 'SPECIFICATIONS')}
            </h3>
            <table className="w-full text-sm font-sans border-collapse">
              <tbody>
                <tr className="border-b border-border py-2">
                  <td className="text-muted py-2">{t('lot.specs.elevation', 'Elevation')}</td>
                  <td className="figure font-mono text-ink text-right py-2">{lot.elevation}m</td>
                </tr>
                <tr className="border-b border-border py-2">
                  <td className="text-muted py-2">{t('lot.specs.esg', 'ESG Score')}</td>
                  <td className="figure font-mono text-ink text-right py-2">
                    {lot.esgScore ? `${Math.round(lot.esgScore * 100)}%` : '—'}
                  </td>
                </tr>
                <tr className="border-b border-border py-2">
                  <td className="text-muted py-2">{t('lot.specs.available', 'Available Quantity')}</td>
                  <td className="figure font-mono text-ink text-right py-2">
                    {lot.availableQuantityLbs.toLocaleString()} / {lot.totalProductionLbs.toLocaleString()} lbs
                  </td>
                </tr>
                <tr className="py-2">
                  <td className="text-muted py-2">{t('lot.specs.certificates', 'Certifications')}</td>
                  <td className="text-ink text-right py-2 flex justify-end gap-1.5">
                    {lot.organicCertified && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success-bg text-success text-[10px] font-bold rounded-sm border border-success/10">ORG</span>}
                    {lot.fairTradeCertified && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-success-bg text-success text-[10px] font-bold rounded-sm border border-success/10">FT</span>}
                    {lot.rainforestAlliance && <span className="inline-flex items-center gap-0.5 bg-success-bg text-success text-[10px] font-bold rounded-sm border border-success/10">RA</span>}
                    {!lot.organicCertified && !lot.fairTradeCertified && !lot.rainforestAlliance && <span className="text-subtle">—</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pricing Model Table */}
          <div className="space-y-2">
            <h3 className="overline text-xs text-muted">
              {t('lot.details.pricing', 'PRICING & FINANCE (PER LB)')}
            </h3>
            <div className="bg-recessed/20 border border-border rounded-lg overflow-hidden font-mono text-sm">
              <div className="grid grid-cols-2 p-3 border-b border-border">
                <span className="text-muted">{t('pricing.FOBPrice', 'FOB Price')}</span>
                <span className="text-ink text-right font-bold">{fmtCurrency(currentLocale).format(lot.pricePerLb)}</span>
              </div>
              <div className="grid grid-cols-2 p-3 border-b border-border bg-recessed/10">
                <span className="text-muted">{t('pricing.landedCost', 'Estimated Landed')}</span>
                <span className="text-ink text-right">{fmtCurrency(currentLocale).format(lot.costPerLb)}</span>
              </div>
              <div className="grid grid-cols-2 p-3 bg-recessed/30">
                <span className="text-muted">{t('pricing.estimatedMargin', 'Importers Gross Margin')}</span>
                <span className="text-teal text-right font-bold">
                  {fmtCurrency(currentLocale).format(markup)} ({marginPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Logistics Timeline */}
          {lot.estimatedArrival && (
            <div className="space-y-3">
              <h3 className="overline text-xs text-muted">
                {t('lot.details.logistics', 'LOGISTICS TIMELINE')}
              </h3>
              <div className="relative pl-6 space-y-4 border-l border-border ml-2 text-xs">
                <div className="relative">
                  <div className="absolute -left-8 top-0.5 bg-success w-3 h-3 rounded-full border-2 border-surface" />
                  <p className="font-bold text-ink">{t('logistics.stage1', 'Port Inspection Completed')}</p>
                  <p className="text-muted">{t('logistics.stage1.desc', 'Origin country exports verified')}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-8 top-0.5 bg-teal w-3 h-3 rounded-full border-2 border-surface" />
                  <p className="font-bold text-ink">{t('logistics.stage2', 'Vessel Dispatched')}</p>
                  <p className="text-muted">{t('logistics.stage2.desc', 'Transit in progress')}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-8 top-0.5 bg-subtle w-3 h-3 rounded-full border-2 border-surface" />
                  <p className="font-bold text-ink">{t('logistics.stage3', 'Estimated Arrival')}</p>
                  <p className="text-muted font-mono">{fmtDate(currentLocale, lot.estimatedArrival)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-recessed/30 grid grid-cols-2 gap-3">
          <button 
            onClick={() => selectLot(null)}
            className="w-full py-2 bg-navy hover:bg-navy-800 text-white text-sm font-medium rounded-md shadow-e1 hover:shadow-e2 active:scale-95 transition-all text-center"
          >
            {t('common:buttons.sourceLot', 'Source This Lot')}
          </button>
          <button 
            onClick={() => selectLot(null)}
            className="w-full py-2 border border-border-interactive hover:bg-recessed text-ink text-sm font-medium rounded-md active:scale-95 transition-all text-center"
          >
            {t('common:buttons.compare', 'Add to Compare')}
          </button>
        </div>
      </div>
    </div>
  );
};
