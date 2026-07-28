import React from 'react';
import { useFormContext, useController } from 'react-hook-form';

interface JsonFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
}

export const JsonField: React.FC<JsonFieldProps> = ({ name, label, ...rest }) => {
  const { formState: { errors } } = useFormContext();
  const { field } = useController({
    name,
    rules: {
      validate: (value) => {
        if (value === '' || value === null || value === undefined) return true;
        try {
          JSON.parse(String(value));
          return true;
        } catch (err) {
          return `Invalid JSON: ${(err as Error).message}`;
        }
      }
    }
  });
  const error = errors[name];

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</label>
      <textarea id={name} {...field} {...rest} className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans font-mono min-h-[120px] resize-y" />
      {error?.message && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
