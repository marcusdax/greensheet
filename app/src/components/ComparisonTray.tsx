import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelection } from '../stores/root-store';
import { lots } from '../data/lots';
import { CupScoreBadge } from './CupScoreBadge';
import { X, GitCompare, Trash2, ArrowRight } from 'lucide-react';
import { fmtCurrency } from '../i18n/format';

export const ComparisonTray: React.FC = () => {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const { compareTray, toggleCompare, clearCompare, selectLot } = useSelection();

  if (compareTray.length === 0) return null;

  const currentLocale = i18n.language;
  const comparedLots = lots.filter((l) => compareTray.includes(l.id));

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-sticky bg-navy text-parchment-50 border-t border-navy-800 shadow-e5 transition-all duration-300 animate-slide-up"
      role="region"
      aria-label="Lot comparison tray"
    >
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left Badge & Info */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 bg-teal/20 text-teal rounded-lg border border-teal/30">
            <GitCompare size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-sm text-parchment-50">
                {t('comparison.title', 'Lot Comparison Tray')}
              </span>
              <span className="px-2 py-0.5 bg-gold text-ink text-[10px] font-mono font-bold rounded-full">
                {compareTray.length} / 3
              </span>
            </div>
            <p className="text-xs text-parchment-50/60 font-sans">
              {t('comparison.subtitle', 'Side-by-side specs, price/lb, and sensory breakdown')}
            </p>
          </div>
        </div>

        {/* Center: Compared Cards Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {comparedLots.map((lot) => (
            <div
              key={lot.id}
              onClick={() => selectLot(lot.id)}
              className="bg-navy-900/80 border border-navy-700 hover:border-teal rounded-md p-2.5 flex items-center justify-between gap-2 cursor-pointer group transition-all"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-parchment-50 truncate font-sans">
                    {lot.origin}
                  </span>
                  <CupScoreBadge score={lot.cupScore} size="sm" />
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-parchment-50/60 mt-0.5">
                  <span>{fmtCurrency(currentLocale).format(lot.pricePerLb)}/lb</span>
                  <span>•</span>
                  <span className="capitalize">{lot.processingMethod}</span>
                  {lot.esgScore && (
                    <>
                      <span>•</span>
                      <span className="text-leaf">ESG {Math.round(lot.esgScore * 100)}%</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompare(lot.id);
                }}
                className="p-1 text-parchment-50/40 hover:text-white hover:bg-white/10 rounded shrink-0 transition-colors"
                title="Remove lot from comparison"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {/* Empty slot placeholders */}
          {Array.from({ length: 3 - comparedLots.length }).map((_, idx) => (
            <div 
              key={idx}
              className="border border-dashed border-navy-700/60 rounded-md p-2.5 flex items-center justify-center text-xs text-parchment-50/30 font-sans"
            >
              + {t('comparison.addPlaceholder', 'Select lot to compare')}
            </div>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => clearCompare()}
            className="p-2 text-parchment-50/60 hover:text-white hover:bg-white/10 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Clear comparison tray"
          >
            <Trash2 size={14} />
            <span className="hidden lg:inline">{t('common:buttons.clearAll', 'Clear')}</span>
          </button>
          <button
            onClick={() => {
              if (comparedLots.length > 0) {
                selectLot(comparedLots[0].id);
              }
            }}
            className="px-3 py-1.5 bg-teal hover:bg-teal-600 text-white text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <span>{t('comparison.inspect', 'Inspect Specs')}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
