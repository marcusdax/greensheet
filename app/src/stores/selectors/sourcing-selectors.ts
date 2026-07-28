import { useMemo } from 'react';
import { useSourcing } from '../root-store';
import type { CoffeeLot } from '../../types/domain';

export interface ScoredLot extends CoffeeLot {
  metrics: {
    costNorm: number;
    cupNorm: number;
    esgNorm: number;
    logisticsNorm: number;
    weightedScore: number;
    isOverBudget: boolean;
  };
}

export function rankLots(
  lots: CoffeeLot[],
  s: {
    weights: { cost: number; cup: number; esg: number; logistics: number };
    budgetCeiling: number;
    showOverBudget: boolean;
    searchQuery: string;
    selectedOrigins: string[];
    selectedProcesses: string[];
    minCupScore: number;
    sortOrder: 'weighted' | 'price' | 'cup' | 'esg';
  }
): ScoredLot[] {
  let filtered = lots;

  if (s.searchQuery) {
    const q = s.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.origin.toLowerCase().includes(q) ||
        (l.varietal && l.varietal.toLowerCase().includes(q)) ||
        (l.flavorNotes && l.flavorNotes.some((n) => n.toLowerCase().includes(q)))
    );
  }

  if (s.selectedOrigins.length) {
    filtered = filtered.filter((l) => s.selectedOrigins.includes(l.origin));
  }

  if (s.selectedProcesses.length) {
    filtered = filtered.filter(
      (l) => l.processingMethod && s.selectedProcesses.includes(l.processingMethod)
    );
  }

  if (!s.showOverBudget) {
    filtered = filtered.filter((l) => l.pricePerLb <= s.budgetCeiling);
  }

  filtered = filtered.filter((l) => l.cupScore >= s.minCupScore);

  const prices = lots.map((l) => l.pricePerLb);
  const maxP = Math.max(...prices, 10), minP = Math.min(...prices, 0);

  const scored = filtered.map((lot): ScoredLot => {
    const costNorm = maxP > minP ? clamp100(((maxP - lot.pricePerLb) / (maxP - minP)) * 100) : 50;
    const cupNorm = clamp100(((lot.cupScore - 75) / 20) * 100);
    const esgNorm = lot.esgScore != null ? lot.esgScore * 100 : 50;
    const logisticsNorm = 70; // Mock logisticsScore since not in seed data
    const weightedScore =
      costNorm * s.weights.cost +
      cupNorm * s.weights.cup +
      esgNorm * s.weights.esg +
      logisticsNorm * s.weights.logistics;

    return {
      ...lot,
      metrics: {
        costNorm: Math.round(costNorm),
        cupNorm: Math.round(cupNorm),
        esgNorm: Math.round(esgNorm),
        logisticsNorm: Math.round(logisticsNorm),
        weightedScore: Math.round(weightedScore * 100) / 100,
        isOverBudget: lot.pricePerLb > s.budgetCeiling,
      },
    };
  });

  switch (s.sortOrder) {
    case 'price':
      return [...scored].sort((a, b) => a.pricePerLb - b.pricePerLb);
    case 'cup':
      return [...scored].sort((a, b) => b.cupScore - a.cupScore);
    case 'esg':
      return [...scored].sort((a, b) => (b.esgScore ?? 0) - (a.esgScore ?? 0));
    default:
      return [...scored].sort((a, b) => b.metrics.weightedScore - a.metrics.weightedScore);
  }
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

export function useRankedLots(lots: CoffeeLot[]): ScoredLot[] {
  const slice = useShallowFilters();
  return useMemo(() => rankLots(lots, slice), [lots, slice]);
}

function useShallowFilters() {
  const s = useSourcing();
  return useShallowObject({
    weights: s.weights,
    budgetCeiling: s.budgetCeiling,
    showOverBudget: s.showOverBudget,
    searchQuery: s.searchQuery,
    selectedOrigins: s.selectedOrigins,
    selectedProcesses: s.selectedProcesses,
    minCupScore: s.minCupScore,
    sortOrder: s.sortOrder,
  });
}

import { useRef } from 'react';
function useShallowObject<T extends Record<string, any>>(obj: T): T {
  const ref = useRef(obj);
  const keys1 = Object.keys(obj);
  const keys2 = Object.keys(ref.current);
  let hasChanged = keys1.length !== keys2.length;
  if (!hasChanged) {
    for (const k of keys1) {
      if (typeof obj[k] === 'object' && obj[k] !== null && ref.current[k] !== null) {
        // shallow check inner object
        const innerObj = obj[k];
        const innerRefObj = ref.current[k];
        const innerKeys = Object.keys(innerObj);
        if (innerKeys.some((ik) => innerObj[ik] !== innerRefObj[ik])) {
          hasChanged = true;
          break;
        }
      } else if (obj[k] !== ref.current[k]) {
        hasChanged = true;
        break;
      }
    }
  }
  if (hasChanged) {
    ref.current = obj;
  }
  return ref.current;
}
