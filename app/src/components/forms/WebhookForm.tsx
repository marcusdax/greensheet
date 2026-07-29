import React from 'react';
import { useForm, FormProvider, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { webhookCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { TextAreaField } from '../ui/TextAreaField';
import { MultiSelect } from '../ui/MultiSelect';
import type { z } from 'zod';

const eventOptions = [
  { value: 'lot.created', label: 'Lot Created' },
  { value: 'lot.updated', label: 'Lot Updated' },
  { value: 'lot.retired', label: 'Lot Retired' },
  { value: 'order.created', label: 'Order Created' },
  { value: 'order.shipped', label: 'Order Shipped' },
  { value: 'order.delivered', label: 'Order Delivered' },
  { value: 'roaster.registered', label: 'Roaster Registered' },
  { value: 'sample_kit.delivered', label: 'Sample Kit Delivered' },
];

export type WebhookFormValues = z.input<typeof webhookCreateSchema>;

const emptyDefaults: WebhookFormValues = {
  url: '',
  description: '',
  events: [],
  challenge: '',
};

export const WebhookForm: React.FC<{
  onSubmit: (data: WebhookFormValues) => void | Promise<void>;
  defaultValues?: DefaultValues<WebhookFormValues>;
}> = ({ onSubmit, defaultValues }) => {
  const methods = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookCreateSchema),
    defaultValues: defaultValues ? { ...emptyDefaults, ...defaultValues } : emptyDefaults,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField
          name="url"
          label="Webhook URL"
          type="url"
          placeholder="https://api.example.com/webhooks/greensheet"
        />
        <MultiSelect name="events" label="Events" options={eventOptions} />
        <TextAreaField
          name="description"
          label="Description"
          placeholder="What this webhook is for"
        />
        <InputField
          name="challenge"
          label="Challenge"
          placeholder="Verification challenge expected by your endpoint"
        />
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold"
          >
            Save
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
