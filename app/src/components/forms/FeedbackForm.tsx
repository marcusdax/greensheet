import React, { useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { InputField } from '../ui/InputField';
import { NumberField } from '../ui/NumberField';
import { TextAreaField } from '../ui/TextAreaField';
import { CheckboxField } from '../ui/CheckboxField';
import type { SampleFeedback, SampleKit } from '../../types/api';

const feedbackSchema = z.object({
  feedbackToken: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  lotRatings: z.array(z.object({
    lotId: z.string(),
    rating: z.number().int().min(1).max(5),
    wouldOrder: z.boolean().default(false),
  })).default([]),
});

type FeedbackFormValues = z.input<typeof feedbackSchema>;

export const FeedbackForm: React.FC<{
  onSubmit: (data: SampleFeedback) => void | Promise<void>;
  kit?: SampleKit | null;
}> = ({ onSubmit, kit }) => {
  const defaultValues = useMemo<FeedbackFormValues>(() => ({
    feedbackToken: kit?.feedbackToken ?? '',
    rating: 5,
    notes: '',
    lotRatings: kit?.lots.map((lot) => ({
      lotId: lot.lotId,
      rating: 5,
      wouldOrder: false,
    })) ?? [],
  }), [kit]);

  const methods = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues,
  });

  const lotRatings = methods.watch('lotRatings') ?? [];

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <InputField name="feedbackToken" label="Feedback Token" />
        <NumberField name="rating" label="Overall Rating (1–5)" min={1} max={5} step={1} />
        <TextAreaField name="notes" label="Notes" />

        {lotRatings.length > 0 && (
          <div className="space-y-2">
            <span className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">Lot Ratings</span>
            <div className="space-y-3">
              {lotRatings.map((lot, index) => (
                <div key={lot.lotId} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end border border-border rounded-md p-3">
                  <div className="text-sm font-sans text-ink">{kit?.lots[index]?.origin ?? lot.lotId}</div>
                  <NumberField name={`lotRatings.${index}.rating`} label="Rating" min={1} max={5} step={1} />
                  <CheckboxField name={`lotRatings.${index}.wouldOrder`} label="Would order" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Submit Feedback
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
