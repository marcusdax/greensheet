import React from 'react';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderCreateSchema } from '../../api/schemas';
import { SelectField } from '../ui/SelectField';
import { NumberField } from '../ui/NumberField';
import type { z } from 'zod';

type OrderFormValues = z.input<typeof orderCreateSchema>;
type OrderCreate = z.infer<typeof orderCreateSchema>;

const emptyDefaults: OrderFormValues = {
  accountId: '',
  lineItems: [{ lotId: '', quantityLbs: 0, unitPriceCents: 0 }],
};

export const OrderForm: React.FC<{
  onSubmit: (data: OrderCreate) => void | Promise<void>;
  accountOptions: { value: string; label: string }[];
  lotOptions: { value: string; label: string }[];
}> = ({ onSubmit, accountOptions, lotOptions }) => {
  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderCreateSchema),
    defaultValues: emptyDefaults,
  });
  const { control, handleSubmit } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <SelectField
          name="accountId"
          label="Account"
          options={[{ value: '', label: 'Select an account' }, ...accountOptions]}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">Line Items</span>
            <button
              type="button"
              onClick={() => append({ lotId: '', quantityLbs: 0, unitPriceCents: 0 })}
              className="text-xs font-semibold text-teal hover:text-navy transition-colors"
            >
              + Add line item
            </button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 border border-border rounded-md bg-recessed/15">
              <div className="sm:col-span-5">
                <SelectField
                  name={`lineItems.${index}.lotId`}
                  label="Lot"
                  options={[{ value: '', label: 'Select a lot' }, ...lotOptions]}
                />
              </div>
              <div className="sm:col-span-3">
                <NumberField name={`lineItems.${index}.quantityLbs`} label="Qty (lb)" min={1} />
              </div>
              <div className="sm:col-span-3">
                <NumberField name={`lineItems.${index}.unitPriceCents`} label="Price (¢/lb)" min={1} />
              </div>
              <div className="sm:col-span-1 flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="mb-0.5 px-2 py-2 text-xs font-semibold text-danger hover:bg-danger-bg rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remove line item"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Save Order
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
