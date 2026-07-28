import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSourcing, useSelection } from '../stores/root-store';
import { useRankedLots } from '../stores/selectors/sourcing-selectors';
import { lots } from '../data/lots';
import { GOAL_PROFILES, type GoalKey, type SortOrder } from '../types/domain';
import { CupScoreBadge } from '../components/CupScoreBadge';
import { 
  Scale, Coins, Star, Sprout, Ship, Search, SlidersHorizontal, 
  ChevronDown, ChevronUp, AlertCircle, Calendar, ArrowUpDown
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export const NavigatorPage: React.FC = () => {
  const { t } = useTranslation(['catalog', 'common']);
  const sourcing = useSourcing();
  const { selectLot } = useSelection();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Retrieve ranked lots using custom selector hook
  const rankedLots = useRankedLots(lots);

  // Extract unique origins and processes from lots data for advanced filter checkboxes
  const allOrigins = Array.from(new Set(lots.map((l) => l.origin)));
  const allProcesses = ['washed', 'natural', 'honey', 'anaerobic'];

  // Map icon strings to Lucide components
  const iconMap: Record<string, React.ComponentType<any>> = {
    Scale,
    Coins,
    Star,
    Sprout,
    Ship
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">
          {t('navigator.overline', 'SOURCING DECISION ENGINE')}
        </span>
        <h1 className="text-3xl font-display font-medium text-ink">
          {t('navigator.title', 'Sourcing Navigator')}
        </h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          {t('navigator.subtitle', 'Optimize your coffee procurement portfolio using weighted multi-attribute decision matrix templates.')}
        </p>
      </div>

      {/* 1. Goal Profile Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(GOAL_PROFILES) as GoalKey[]).map((key) => {
          const profile = GOAL_PROFILES[key];
          const isActive = sourcing.goal === key;
          const IconComponent = iconMap[profile.icon] || Scale;

          return (
            <button
              key={key}
              onClick={() => sourcing.setGoal(key)}
              className={`text-left p-4 bg-surface rounded-lg border transition-all duration-base flex flex-col gap-2 relative group focus-visible:ring-2 focus-visible:ring-teal ${
                isActive 
                  ? 'border-teal ring-1 ring-teal/30 shadow-e2' 
                  : 'border-border hover:border-border-strong hover:bg-hover/30 shadow-e1 hover:shadow-e2'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`p-2 rounded-md ${isActive ? 'bg-teal/10 text-teal' : 'bg-recessed text-muted group-hover:text-ink'}`}>
                  <IconComponent size={20} />
                </span>
                {isActive && (
                  <span className="text-[10px] font-mono font-bold text-teal flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-teal rounded-full animate-pulse" />
                    {t('common:labels.active', 'ACTIVE')}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink leading-tight font-sans">
                  {t(`goals.${key}.label`, profile.label)}
                </h3>
                <p className="text-xs text-muted mt-1 leading-snug font-sans">
                  {t(`goals.${key}.description`, profile.description)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-surface rounded-lg border border-border p-4 shadow-e1 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          
          {/* Budget Slider */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="budget-slider" className="overline text-muted font-bold">
                {t('filters.budgetCeiling', 'BUDGET CEILING')}
              </label>
              <span className="font-mono figure-strong text-teal text-sm">
                ${sourcing.budgetCeiling.toFixed(2)}/lb
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="budget-slider"
                type="range"
                min="3"
                max="45"
                step="0.5"
                value={sourcing.budgetCeiling}
                onChange={(e) => sourcing.setBudgetCeiling(parseFloat(e.target.value))}
                className="w-full accent-teal h-1.5 bg-recessed rounded-lg cursor-pointer"
                aria-label={t('common:a11y.budgetCeilingSlider', 'Budget ceiling slider')}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={sourcing.showOverBudget}
                onChange={() => sourcing.toggleOverBudget()}
                className="rounded-sm border-border-interactive text-teal focus:ring-teal bg-surface w-4 h-4 cursor-pointer"
              />
              <span>{t('filters.includeOverBudget', 'Include out-of-budget lots')}</span>
            </label>
          </div>

          {/* Sort Segmented Control */}
          <div className="md:col-span-4 space-y-1.5">
            <span className="overline text-xs text-muted font-bold block">
              {t('filters.sortBy', 'SORT BY')}
            </span>
            <div className="bg-recessed p-0.5 rounded-md flex gap-0.5" role="radiogroup" aria-label="Sort order">
              {(['weighted', 'price', 'cup', 'esg'] as SortOrder[]).map((mode) => {
                const isSelected = sourcing.sortOrder === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => sourcing.setSortOrder(mode)}
                    role="radio"
                    aria-checked={isSelected}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-sm transition-all focus-visible:ring-1 focus-visible:ring-teal ${
                      isSelected
                        ? 'bg-navy text-white shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t(`sort.${mode}`, mode)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Input */}
          <div className="md:col-span-3 space-y-1.5">
            <label htmlFor="search-input" className="overline text-xs text-muted font-bold block">
              {t('filters.search', 'SEARCH')}
            </label>
            <div className="relative">
              <input
                id="search-input"
                type="text"
                placeholder={t('filters.searchPlaceholder', 'Search origin, flavor…')}
                value={sourcing.searchQuery}
                onChange={(e) => sourcing.setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans"
              />
              <Search className="absolute left-3 top-2.5 text-subtle" size={14} />
            </div>
          </div>

          {/* Advanced Filters Button */}
          <div className="md:col-span-1">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-full flex items-center justify-center gap-1 py-1.5 border rounded-md text-sm font-semibold transition-all ${
                showAdvanced 
                  ? 'bg-recessed border-border-strong text-ink' 
                  : 'border-border-interactive text-muted hover:text-ink hover:bg-hover/20'
              }`}
              aria-expanded={showAdvanced}
            >
              <SlidersHorizontal size={14} />
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* 3. Advanced Filters Drawer Panel */}
        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="overflow-hidden border-t border-border pt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Origins List */}
                <div className="space-y-2">
                  <span className="overline text-xs text-muted font-bold block">
                    {t('filters.origins', 'ORIGIN COUNTRIES')}
                  </span>
                  <div className="max-h-28 overflow-y-auto border border-border rounded-md p-2 bg-recessed/10 space-y-1.5">
                    {allOrigins.map((origin) => (
                      <label key={origin} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:text-teal transition-colors">
                        <input
                          type="checkbox"
                          checked={sourcing.selectedOrigins.includes(origin)}
                          onChange={() => sourcing.toggleOrigin(origin)}
                          className="rounded-sm border-border-interactive text-teal focus:ring-teal w-4 h-4 cursor-pointer"
                        />
                        <span className="font-sans">{origin}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Processing Methods */}
                <div className="space-y-2">
                  <span className="overline text-xs text-muted font-bold block">
                    {t('filters.processes', 'PROCESSING METHODS')}
                  </span>
                  <div className="border border-border rounded-md p-3 bg-recessed/10 grid grid-cols-2 gap-2 h-28">
                    {allProcesses.map((proc) => (
                      <label key={proc} className="flex items-center gap-2 text-sm text-ink cursor-pointer hover:text-teal transition-colors">
                        <input
                          type="checkbox"
                          checked={sourcing.selectedProcesses.includes(proc)}
                          onChange={() => sourcing.toggleProcess(proc)}
                          className="rounded-sm border-border-interactive text-teal focus:ring-teal w-4 h-4 cursor-pointer"
                        />
                        <span className="font-sans capitalize">{t(`process.${proc}`, proc)}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Min Cup Score Slider */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="overline text-xs text-muted font-bold block">
                      {t('filters.minCupScore', 'MINIMUM CUP SCORE')}
                    </span>
                    <span className="font-mono figure-strong text-teal text-sm bg-teal/10 px-2 py-0.5 rounded-full">
                      {sourcing.minCupScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="space-y-2 bg-recessed/10 border border-border rounded-md p-4 h-28 flex flex-col justify-center">
                    <input
                      type="range"
                      min="70"
                      max="95"
                      step="0.5"
                      value={sourcing.minCupScore}
                      onChange={(e) => sourcing.setMinCupScore(parseFloat(e.target.value))}
                      className="w-full accent-teal h-1.5 bg-recessed rounded-lg cursor-pointer"
                      aria-label={t('common:a11y.minCupScoreSlider', 'Minimum cup score slider')}
                    />
                    <div className="flex justify-between text-[10px] text-subtle font-mono">
                      <span>70.0</span>
                      <span>80.0</span>
                      <span>85.0</span>
                      <span>90.0+</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Filter Footer Actions */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-border">
                <button
                  onClick={() => sourcing.resetFilters()}
                  className="px-3 py-1.5 text-xs text-muted hover:text-ink font-semibold rounded-md border border-transparent hover:border-border-strong hover:bg-hover/10"
                >
                  {t('common:buttons.resetFilters', 'Reset Filters')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Header */}
      <div className="flex justify-between items-center text-xs text-muted border-b border-border pb-2">
        <span aria-live="polite" className="font-sans font-medium">
          {rankedLots.length} {rankedLots.length === 1 ? t('results.countOne', 'lot matches') : t('results.countMany', 'lots match')}
        </span>
        <span className="font-mono tracking-wider flex items-center gap-1.5">
          <ArrowUpDown size={12} />
          {t('results.sortedBy', 'SORTED BY')}: {sourcing.sortOrder.toUpperCase()}
        </span>
      </div>

      {/* 4. Results List */}
      <AnimatePresence mode="popLayout">
        {rankedLots.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center p-12 border border-dashed border-border-strong rounded-lg bg-surface/50 text-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-recessed flex items-center justify-center text-subtle">
              <Search size={24} />
            </div>
            <div>
              <h3 className="font-display text-lg text-ink font-semibold">
                {t('results.emptyTitle', 'No lots match your filters')}
              </h3>
              <p className="text-sm text-muted mt-1 max-w-sm font-sans">
                {t('results.emptyDesc', 'Try broadening your budget ceiling or unchecking origin criteria to discover coffee lots.')}
              </p>
            </div>
            <button
              onClick={() => sourcing.resetFilters()}
              className="mt-2 px-4 py-1.5 bg-navy hover:bg-navy-800 text-white rounded-md text-xs font-semibold shadow-e1 hover:shadow-e2 transition-all active:scale-95"
            >
              {t('common:buttons.clearAll', 'Clear all filters')}
            </button>
          </motion.div>
        ) : (
          <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {rankedLots.slice(0, 8).map((lot, idx) => {
              const rank = idx + 1;
              const isNew = idx < 2; // Simulated new arrivals
              
              return (
                <motion.div
                  key={lot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  onClick={() => selectLot(lot.id)}
                  className={`bg-surface p-5 rounded-lg border transition-all duration-base shadow-e1 hover:shadow-e3 hover:-translate-y-[1px] flex flex-col justify-between cursor-pointer relative ${
                    lot.metrics.isOverBudget 
                      ? 'border-warning border-2' 
                      : 'border-border hover:border-border-strong'
                  } ${isNew ? 'border-l-4 border-l-gold' : ''}`}
                >
                  <div>
                    {/* Title Row */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-recessed rounded-full flex items-center justify-center text-xs font-mono font-bold text-ink shrink-0">
                          #{rank}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-ink font-sans flex items-center gap-2">
                            {lot.origin}
                            {isNew && (
                              <span className="px-1.5 py-0.5 bg-gold-100 border border-gold/30 text-gold-text text-[9px] font-bold rounded-sm uppercase tracking-wider font-sans">
                                {t('common:labels.new', 'NEW')}
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-muted font-sans mt-0.5">
                            {lot.varietal} • <span className="capitalize">{t(`process.${lot.processingMethod}`, lot.processingMethod)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <CupScoreBadge score={lot.cupScore} />
                        {lot.metrics.isOverBudget && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning-bg border border-warning/20 text-warning text-[9px] font-bold rounded-sm uppercase tracking-wider font-sans">
                            <AlertCircle size={10} />
                            {t('lot.badge.overBudget', 'OVER BUDGET')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-3 gap-2 bg-recessed/20 p-2.5 rounded-md border border-border/50 text-xs font-mono mb-4 text-muted">
                      <div>
                        <span className="block text-[10px] overline text-subtle">{t('lot.card.price', 'PRICE')}</span>
                        <span className="figure text-ink text-sm font-semibold">${lot.pricePerLb.toFixed(2)}/lb</span>
                      </div>
                      <div>
                        <span className="block text-[10px] overline text-subtle">{t('lot.card.available', 'QUANTITY')}</span>
                        <span className="figure text-ink text-sm font-semibold">{lot.availableQuantityLbs.toLocaleString()} lb</span>
                      </div>
                      <div>
                        <span className="block text-[10px] overline text-subtle">{t('lot.card.eta', 'ETA')}</span>
                        <span className="text-info text-sm font-semibold flex items-center gap-1">
                          <Calendar size={12} />
                          {lot.estimatedArrival ? lot.estimatedArrival.substring(5) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Flavor Chips */}
                    {lot.flavorNotes && (
                      <div className="flex flex-wrap gap-1 mb-5">
                        {lot.flavorNotes.slice(0, 3).map((note) => (
                          <span key={note} className="px-2 py-0.5 bg-recessed/60 text-[10px] text-muted rounded-full border border-border/60">
                            {note}
                          </span>
                        ))}
                        {lot.flavorNotes.length > 3 && (
                          <span className="px-2 py-0.5 bg-transparent text-[10px] text-subtle font-semibold">
                            +{lot.flavorNotes.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Score and Bars */}
                  <div className="border-t border-border/60 pt-4 flex flex-col gap-4 mt-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="overline text-[10px] text-subtle leading-none mb-0.5">{t('lot.card.matchScore', 'MATCH SCORE')}</span>
                        <span className="figure-strong text-2xl text-ink font-bold leading-none">{lot.metrics.weightedScore.toFixed(1)}</span>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          selectLot(lot.id);
                        }}
                        className="py-1.5 px-4 bg-navy hover:bg-navy-800 text-white rounded-md text-xs font-semibold shadow-e1 hover:shadow-e2 active:scale-95 transition-all"
                      >
                        {t('common:buttons.sourceLot', 'Source This Lot')}
                      </button>
                    </div>

                    {/* Weights Breakdown Bars */}
                    <div className="grid grid-cols-4 gap-2 text-[10px] border-t border-border/20 pt-3">
                      <div>
                        <div className="flex justify-between text-subtle font-sans font-semibold mb-0.5">
                          <span>Cost</span>
                          <span className="figure font-mono font-medium">{lot.metrics.costNorm}%</span>
                        </div>
                        <div className="h-1 w-full bg-recessed rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal" 
                            style={{ width: `${lot.metrics.costNorm}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-subtle font-sans font-semibold mb-0.5">
                          <span>Quality</span>
                          <span className="figure font-mono font-medium">{lot.metrics.cupNorm}%</span>
                        </div>
                        <div className="h-1 w-full bg-recessed rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal" 
                            style={{ width: `${lot.metrics.cupNorm}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-subtle font-sans font-semibold mb-0.5">
                          <span>ESG</span>
                          <span className="figure font-mono font-medium">{lot.metrics.esgNorm}%</span>
                        </div>
                        <div className="h-1 w-full bg-recessed rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal" 
                            style={{ width: `${lot.metrics.esgNorm}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-subtle font-sans font-semibold mb-0.5">
                          <span>Logistics</span>
                          <span className="figure font-mono font-medium">{lot.metrics.logisticsNorm}%</span>
                        </div>
                        <div className="h-1 w-full bg-recessed rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal" 
                            style={{ width: `${lot.metrics.logisticsNorm}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
