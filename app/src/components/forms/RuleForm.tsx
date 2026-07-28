import React from 'react';
import { useForm, FormProvider, useController, useFieldArray, type DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ruleCreateSchema } from '../../api/schemas';
import { InputField } from '../ui/InputField';
import { SelectField } from '../ui/SelectField';
import { NumberField } from '../ui/NumberField';
import { Plus, Trash2 } from 'lucide-react';
import type { z } from 'zod';
import type { RuleActionType } from '../../types/api';

const actionTypeOptions: { value: RuleActionType; label: string }[] = [
  { value: 'SEND_TEMPLATE', label: 'Send Template' },
  { value: 'EXECUTE_CAMPAIGN_HALT', label: 'Execute Campaign Halt' },
  { value: 'UPDATE_CRM_LIFECYCLE', label: 'Update CRM Lifecycle' },
  { value: 'CREATE_CRM_TASK', label: 'Create CRM Task' },
  { value: 'ADD_SUPPRESSION', label: 'Add Suppression' },
];

const channelOptions = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

export type RuleFormValues = z.input<typeof ruleCreateSchema>;

const emptyDefaults: RuleFormValues = {
  ruleCode: '',
  campaignId: null,
  ruleName: '',
  triggerEvent: '',
  conditionsJson: {},
  actions: [{ actionType: 'SEND_TEMPLATE', delayMinutes: 0 }],
};

const ControlledJsonField: React.FC<{ name: string; label: string }> = ({ name, label }) => {
  const { field, fieldState } = useController({ name });
  const [text, setText] = React.useState(() => JSON.stringify(field.value ?? {}, null, 2));

  // Only sync the textarea from form state when the field holds a valid parsed
  // object. If it currently holds a raw string (invalid JSON while typing), keep
  // the user's text as-is to avoid JSON.stringify corrupting the input.
  React.useEffect(() => {
    if (field.value && typeof field.value === 'object') {
      setText(JSON.stringify(field.value, null, 2));
    }
  }, [field.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setText(next);
    try {
      field.onChange(JSON.parse(next));
    } catch {
      field.onChange(next);
    }
  };

  const handleBlur = () => {
    try {
      field.onChange(JSON.parse(text));
    } catch {
      field.onChange(text);
    }
  };

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">
        {label}
      </label>
      <textarea
        id={name}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans font-mono min-h-[120px] resize-y"
      />
      {fieldState.error?.message && (
        <span className="text-xs text-danger font-sans">{String(fieldState.error.message)}</span>
      )}
    </div>
  );
};

export const RuleForm: React.FC<{
  campaignId?: string | null;
  onSubmit: (data: RuleFormValues) => void | Promise<void>;
  defaultValues?: DefaultValues<RuleFormValues>;
}> = ({ campaignId = null, onSubmit, defaultValues }) => {
  const methods = useForm<RuleFormValues>({
    resolver: zodResolver(ruleCreateSchema),
    defaultValues: defaultValues
      ? { ...emptyDefaults, ...defaultValues, campaignId: campaignId ?? defaultValues.campaignId ?? null }
      : { ...emptyDefaults, campaignId },
  });
  const { fields, append, remove } = useFieldArray({ control: methods.control, name: 'actions' });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...methods.register('campaignId')} />
        <InputField name="ruleCode" label="Rule Code" placeholder="COF-001" />
        <InputField name="ruleName" label="Rule Name" />
        <InputField name="triggerEvent" label="Trigger Event" placeholder="roaster.registered" />
        <ControlledJsonField name="conditionsJson" label="Conditions JSON" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">Actions</span>
            <button
              type="button"
              onClick={() => append({ actionType: 'SEND_TEMPLATE', delayMinutes: 0 })}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-navy bg-navy/10 hover:bg-navy/20 rounded-md transition-colors"
            >
              <Plus size={14} />
              Add Action
            </button>
          </div>

          {fields.length === 0 && (
            <div className="text-sm text-muted font-sans">At least one action is required.</div>
          )}

          {fields.map((field, index) => (
            <div key={field.id} className="border border-border rounded-lg p-3 space-y-3 bg-recessed/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink font-sans">Action {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-1 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors"
                  aria-label={`Remove action ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <SelectField
                name={`actions.${index}.actionType`}
                label="Action Type"
                options={actionTypeOptions}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField
                  name={`actions.${index}.templateId`}
                  label="Template ID"
                  placeholder="Optional UUID"
                />
                <SelectField
                  name={`actions.${index}.channel`}
                  label="Channel"
                  options={channelOptions}
                />
              </div>
              <NumberField
                name={`actions.${index}.delayMinutes`}
                label="Delay Minutes"
                min={0}
              />
              <ControlledJsonField
                name={`actions.${index}.payload`}
                label="Payload JSON"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="submit" className="px-4 py-2 bg-navy text-white rounded-md text-sm font-semibold">
            Save
          </button>
        </div>
      </form>
    </FormProvider>
  );
};
