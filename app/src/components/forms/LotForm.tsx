import React from 'react';
import { useForm, FormProvider, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField } from '../ui/InputField';
import { NumberField } from '../ui/NumberField';
import { SelectField } from '../ui/SelectField';
import { TextAreaField } from '../ui/TextAreaField';

const processingOptions = [
  { value: '', label: '—' },
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'anaerobic', label: 'Anaerobic' },
];

const lotFormSchema = z.object({
  origin: z.string().min(1).max(100),
  varietal: z.string().max(100).optional().nullable(),
  processingMethod: z.enum(['washed', 'natural', 'honey', 'anaerobic']).optional().nullable().or(z.literal('')),
  elevation: z.number().int().positive().optional().nullable(),
  cupScore: z.number().min(0).max(100),
  pricePerLb: z.number().min(0.01),
  costPerLb: z.number().min(0),
  availableQuantityLbs: z.number().int().min(0),
  totalProductionLbs: z.number().int().min(0),
  esgScore: z.number().min(0).max(1).optional().nullable(),
  flavorNotesInput: z.string(),
}).transform((data) => ({
  origin: data.origin,
  varietal: data.varietal || undefined,
  processingMethod: data.processingMethod === '' || data.processingMethod == null ? undefined : data.processingMethod,
  elevation: data.elevation ?? undefined,
  cupScore: data.cupScore,
  pricePerLbCents: Math.round(data.pricePerLb * 100),
  costPerLbCents: Math.round(data.costPerLb * 100),
  availableQuantityLbs: data.availableQuantityLbs,
  totalProductionLbs: data.totalProductionLbs,
  esgScore: data.esgScore ?? undefined,
  flavorNotes: data.flavorNotesInput.split(',').map((s) => s.trim()).filter(Boolean),
}));

export type LotFormOutput = z.output<typeof lotFormSchema>;
type LotFormValues = z.input<typeof lotFormSchema>;

const emptyDefaults: LotFormValues = {
  origin: '',
  varietal: null,
  processingMethod: '',
  elevation: null,
  cupScore: 0,
  pricePerLb: 0,
  costPerLb: 0,
  availableQuantityLbs: 0,
  totalProductionLbs: 0,
  esgScore: null,
  flavorNotesInput: '',
};

export const LotForm: React.FC<{
  onSubmit: (data: LotFormOutput) => void | Promise<void>;
  defaultValues?: DefaultValues<LotFormValues>;
}> = ({ onSubmit, defaultValues }) => {
  const methods = useForm<LotFormValues, unknown, LotFormOutput>({
    resolver: zodResolver(lotFormSchema),
    defaultValues: defaultValues ? { ...emptyDefaults, ...defaultValues } : emptyDefaults,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField name="origin" label="Origin" />
        <InputField name="varietal" label="Varietal" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField name="processingMethod" label="Process" options={processingOptions} />
          <NumberField name="elevation" label="Elevation (m)" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField name="cupScore" label="Cup Score" step="0.1" />
          <NumberField name="pricePerLb" label="Price / lb ($)" step="0.01" />
          <NumberField name="costPerLb" label="Cost / lb ($)" step="0.01" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField name="availableQuantityLbs" label="Available (lbs)" />
          <NumberField name="totalProductionLbs" label="Total Production (lbs)" />
          <NumberField name="esgScore" label="ESG Score (0–1)" step="0.01" />
        </div>
        <TextAreaField name="flavorNotesInput" label="Flavor Notes" placeholder="jasmine, cane sugar, cocoa nib" />
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Save
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
