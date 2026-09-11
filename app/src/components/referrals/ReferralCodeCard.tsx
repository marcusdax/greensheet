import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { useReferrals } from '../../stores/root-store';
import { useReferralCode } from '../../stores/selectors/referral-selectors';
import { FormProvider, useForm } from 'react-hook-form';
import { InputField } from '../ui/InputField';

interface CustomCodeForm {
  requestedCode: string;
}

export const ReferralCodeCard: React.FC<{ accountId: string }> = ({ accountId }) => {
  const { t } = useTranslation('referrals');
  const code = useReferralCode();
  const { loadCode, createCode } = useReferrals();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const methods = useForm<CustomCodeForm>({ defaultValues: { requestedCode: '' } });

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateCustom = async (values: CustomCodeForm) => {
    setError(null);
    const res = await createCode(accountId, values.requestedCode || undefined);
    if ('problem' in res) {
      setError(res.problem.detail ?? t('code.error', 'Failed to create code'));
    } else {
      await loadCode(accountId);
      methods.reset();
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 shadow-e1">
      <h2 className="font-display text-xl text-ink mb-4">{t('code.title', 'Your Referral Code')}</h2>
      {code ? (
        <div className="flex items-center gap-3 mb-4">
          <code className="text-2xl font-mono bg-recessed px-4 py-2 rounded-md">{code.code}</code>
          <button
            onClick={handleCopy}
            className="p-2 rounded-md hover:bg-recessed text-muted hover:text-ink transition-colors"
            aria-label={t('code.copy', 'Copy code')}
          >
            {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      ) : (
        <p className="text-muted mb-4">{t('code.loading', 'Loading…')}</p>
      )}
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(handleCreateCustom)} className="flex gap-2 items-end">
          <InputField
            name="requestedCode"
            label={t('code.customLabel', 'Custom code label (optional)')}
            placeholder="GS-MYCODE-42"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-navy text-white rounded-md hover:bg-navy-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('code.createCustom', 'Create Custom Code')}
          </button>
        </form>
      </FormProvider>
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
    </div>
  );
};
