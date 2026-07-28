import React from 'react';
import { useController, useFormContext } from 'react-hook-form';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  name: string;
  label: string;
  options: MultiSelectOption[];
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ name, label, options }) => {
  const { field } = useController({ name });
  const { formState: { errors } } = useFormContext();
  const error = errors[name];
  const values = (field.value || []) as string[];

  const toggle = (value: string) => {
    if (values.includes(value)) {
      field.onChange(values.filter((v) => v !== value));
    } else {
      field.onChange([...values, value]);
    }
  };

  return (
    <div className="space-y-1">
      <span className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</span>
      <div className="space-y-1">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="w-4 h-4 rounded border-border-interactive bg-surface text-teal focus:ring-teal"
            />
            <span className="text-sm text-ink font-sans">{option.label}</span>
          </label>
        ))}
      </div>
      {error && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
