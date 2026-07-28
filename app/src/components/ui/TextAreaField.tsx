import React from 'react';
import { useFormContext } from 'react-hook-form';

interface TextAreaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({ name, label, ...rest }) => {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs font-sans font-semibold text-muted uppercase tracking-wider">{label}</label>
      <textarea id={name} {...register(name)} {...rest} className="w-full px-3 py-2 border border-border-interactive rounded-md bg-surface text-ink text-sm focus:border-teal font-sans min-h-[80px] resize-y" />
      {error && <span className="text-xs text-danger font-sans">{String(error.message)}</span>}
    </div>
  );
};
