import React from 'react';
import { useForm, FormProvider, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { roasterCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { SelectField } from '../ui/SelectField';
import { CheckboxField } from '../ui/CheckboxField';
import type { z } from 'zod';

export type RoasterFormValues = z.input<typeof roasterCreateSchema>;

const emptyDefaults: RoasterFormValues = {
  roasterName: '',
  segment: 'micro',
  status: 'trial',
  primaryContact: { fullName: '', email: '', marketingOptIn: false },
};

const segmentOptions = [
  { value: 'micro', label: 'Micro' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'commercial', label: 'Commercial' },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'churned', label: 'Churned' },
];

export const RoasterForm: React.FC<{
  onSubmit: (data: RoasterFormValues) => void | Promise<void>;
  defaultValues?: DefaultValues<RoasterFormValues>;
}> = ({ onSubmit, defaultValues }) => {
  const methods = useForm<RoasterFormValues>({
    resolver: zodResolver(roasterCreateSchema),
    defaultValues: defaultValues ? { ...emptyDefaults, ...defaultValues } as RoasterFormValues : emptyDefaults,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField name="roasterName" label="Roaster Name" />
        <SelectField name="segment" label="Segment" options={segmentOptions} />
        <SelectField name="status" label="Status" options={statusOptions} />
        <InputField name="primaryContact.fullName" label="Contact Name" />
        <InputField name="primaryContact.email" label="Contact Email" type="email" />
        <CheckboxField name="primaryContact.marketingOptIn" label="Marketing opt-in" />
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Save
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
