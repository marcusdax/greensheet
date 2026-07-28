import React from 'react';
import { useForm, FormProvider, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { TextAreaField } from '../ui/TextAreaField';
import { SelectField } from '../ui/SelectField';
import { MultiSelect } from '../ui/MultiSelect';
import type { CampaignStatus } from '../../types/api';
import { z } from 'zod';

const statusOptions: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
];

const segmentOptions = [
  { value: 'micro', label: 'Micro' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'commercial', label: 'Commercial' },
];

export type CampaignFormValues = z.input<typeof campaignCreateSchema> & {
  status: CampaignStatus;
};

const campaignFormSchema = campaignCreateSchema.extend({
  status: z.enum(['draft', 'active', 'paused', 'retired']),
});

const emptyDefaults: CampaignFormValues = {
  slug: '',
  name: '',
  description: '',
  status: 'draft',
  targetAudience: { segments: [] },
};

export const CampaignForm: React.FC<{
  onSubmit: (data: CampaignFormValues) => void | Promise<void>;
  defaultValues?: DefaultValues<CampaignFormValues>;
}> = ({ onSubmit, defaultValues }) => {
  const methods = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: defaultValues ? { ...emptyDefaults, ...defaultValues } as CampaignFormValues : emptyDefaults,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField name="slug" label="Slug" placeholder="welcome-series" />
        <InputField name="name" label="Campaign Name" />
        <TextAreaField name="description" label="Description" />
        <SelectField name="status" label="Status" options={statusOptions} />
        <MultiSelect name="targetAudience.segments" label="Target Audience Segments" options={segmentOptions} />
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Save
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
