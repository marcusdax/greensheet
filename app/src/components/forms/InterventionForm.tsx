import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SelectField } from '../ui/SelectField';
import { TextAreaField } from '../ui/TextAreaField';

const interventionSchema = z.object({
  type: z.enum(['email_campaign', 'sales_call', 'discount_offer', 'survey']),
  outcome: z.enum(['retained', 'churned', 'pending']),
  notes: z.string().min(1, 'Notes are required'),
});

export type InterventionFormValues = z.infer<typeof interventionSchema>;

const typeOptions = [
  { value: 'email_campaign', label: 'Email campaign' },
  { value: 'sales_call', label: 'Sales call' },
  { value: 'discount_offer', label: 'Discount offer' },
  { value: 'survey', label: 'Survey' },
];

const outcomeOptions = [
  { value: 'retained', label: 'Retained' },
  { value: 'churned', label: 'Churned' },
  { value: 'pending', label: 'Pending' },
];

export const InterventionForm: React.FC<{
  onSubmit: (data: InterventionFormValues) => void | Promise<void>;
  submitLabel?: string;
}> = ({ onSubmit, submitLabel = 'Save' }) => {
  const methods = useForm<InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: { type: 'sales_call', outcome: 'pending', notes: '' },
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <SelectField name="type" label="Type" options={typeOptions} />
        <SelectField name="outcome" label="Outcome" options={outcomeOptions} />
        <TextAreaField name="notes" label="Notes" />
        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            {submitLabel}
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
