import React from 'react';
import { useFormContext } from 'react-hook-form';

interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({ name, label, ...rest }) => {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" {...register(name)} {...rest} className="w-4 h-4 rounded border-border-interactive bg-surface text-teal focus:ring-teal" />
        <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</span>
      </label>
      {error && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
