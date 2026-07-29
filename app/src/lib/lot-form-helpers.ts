import type { ProcessingMethod } from '../types/api';

export const lotToFormValues = (lot: {
  origin: string;
  varietal: string | null | undefined;
  processingMethod: ProcessingMethod | string | null | undefined;
  elevation: number | null | undefined;
  cupScore: number;
  pricePerLbCents: number;
  costPerLbCents: number;
  availableQuantityLbs: number;
  totalProductionLbs: number;
  esgScore: number | null | undefined;
  flavorNotes: string[] | null | undefined;
}): {
  origin: string;
  varietal: string | null;
  processingMethod: ProcessingMethod | '';
  elevation: number | null;
  cupScore: number;
  pricePerLb: number;
  costPerLb: number;
  availableQuantityLbs: number;
  totalProductionLbs: number;
  esgScore: number | null;
  flavorNotesInput: string;
} => ({
  origin: lot.origin,
  varietal: lot.varietal ?? null,
  processingMethod: (lot.processingMethod as ProcessingMethod | '') ?? '',
  elevation: lot.elevation ?? null,
  cupScore: lot.cupScore,
  pricePerLb: lot.pricePerLbCents / 100,
  costPerLb: lot.costPerLbCents / 100,
  availableQuantityLbs: lot.availableQuantityLbs,
  totalProductionLbs: lot.totalProductionLbs,
  esgScore: lot.esgScore ?? null,
  flavorNotesInput: (lot.flavorNotes ?? []).join(', '),
});
