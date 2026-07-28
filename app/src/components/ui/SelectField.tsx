import React from 'react';
import { useFormContext } from 'react-hook-form';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export const SelectField: React.FC<SelectFieldProps> = ({ name, label, options, ...rest }) => {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</label>
      <select id={name} {...register(name)} {...rest} className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error?.message && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
