import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { sampleKitCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { SelectField } from '../ui/SelectField';
import { MultiSelect } from '../ui/MultiSelect';
import type { SampleKitCreate } from '../../types/api';
import type { z } from 'zod';

type SampleKitFormValues = z.input<typeof sampleKitCreateSchema>;

const emptyDefaults: SampleKitFormValues = {
  roasterId: '',
  lotIds: [],
  shippingAddress: {
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'US',
  },
};

export const SampleKitForm: React.FC<{
  onSubmit: (data: SampleKitCreate) => void | Promise<void>;
  roasterOptions: { value: string; label: string }[];
  lotOptions: { value: string; label: string }[];
}> = ({ onSubmit, roasterOptions, lotOptions }) => {
  const methods = useForm<SampleKitFormValues>({
    resolver: zodResolver(sampleKitCreateSchema),
    defaultValues: emptyDefaults,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <SelectField name="roasterId" label="Roaster" options={roasterOptions} />
        <MultiSelect name="lotIds" label="Lots (max 8)" options={lotOptions} />
        <div className="space-y-2">
          <span className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">Shipping Address</span>
          <div className="grid grid-cols-1 gap-3">
            <InputField name="shippingAddress.line1" label="Address Line 1" />
            <InputField name="shippingAddress.line2" label="Address Line 2 (optional)" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField name="shippingAddress.city" label="City" />
              <InputField name="shippingAddress.region" label="State / Region" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField name="shippingAddress.postalCode" label="Postal Code" />
              <InputField name="shippingAddress.country" label="Country (2-letter)" maxLength={2} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Request Kit
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
