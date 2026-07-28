import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Pencil, UserX, Plus } from 'lucide-react';
import { fmtCurrency } from '../i18n/format';
import { useCrm, useUi, useRootStore } from '../stores/root-store';
import { RoasterForm, type RoasterFormValues } from '../components/forms/RoasterForm';
import { InterventionForm, type InterventionFormValues } from '../components/forms/InterventionForm';
import { Modal } from '../components/ui/Modal';
import type { Roaster } from '../types/api';

export const RoastersPage: React.FC = () => {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const currentLocale = i18n.language;

  const { roasters, loading, loadRoasters, createRoaster, updateRoaster, anonymizeRoaster, logIntervention } = useCrm();
  const { pushToast } = useUi();

  const [selectedRoasterId, setSelectedRoasterId] = useState<string | null>(null);
  const [roasterModalOpen, setRoasterModalOpen] = useState(false);
  const [editingRoaster, setEditingRoaster] = useState<Roaster | null>(null);
  const [interventionKey, setInterventionKey] = useState(0);

  useEffect(() => {
    void loadRoasters();
  }, [loadRoasters]);

  useEffect(() => {
    if (!selectedRoasterId && roasters.length > 0) {
      setSelectedRoasterId(roasters[0].id);
    }
  }, [roasters, selectedRoasterId]);

  const clearCrmError = () => {
    useRootStore.setState((state) => ({ crm: { ...state.crm, error: null } }));
  };

  const selectedRoaster = roasters.find((r) => r.id === selectedRoasterId);

  const handleOpenAdd = () => {
    setEditingRoaster(null);
    setRoasterModalOpen(true);
  };

  const handleOpenEdit = (roaster: Roaster) => {
    setEditingRoaster(roaster);
    setRoasterModalOpen(true);
  };

  const handleCloseRoasterModal = () => {
    setRoasterModalOpen(false);
    setEditingRoaster(null);
  };

  const handleCreate = async (data: RoasterFormValues) => {
    clearCrmError();
    const created = await createRoaster(data);
    if (created) {
      pushToast({ kind: 'success', message: 'Roaster created' });
      setSelectedRoasterId(created.id);
      handleCloseRoasterModal();
    } else {
      const error = useRootStore.getState().crm.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create roaster' });
    }
  };

  const handleUpdate = async (data: RoasterFormValues) => {
    if (!editingRoaster) return;
    clearCrmError();
    const patch: Partial<Roaster> = {
      ...data,
      primaryContact: { ...editingRoaster.primaryContact, ...data.primaryContact },
    };
    const updated = await updateRoaster(editingRoaster.id, patch);
    if (updated) {
      pushToast({ kind: 'success', message: 'Roaster updated' });
      handleCloseRoasterModal();
    } else {
      const error = useRootStore.getState().crm.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update roaster' });
    }
  };

  const handleAnonymize = async (id: string) => {
    clearCrmError();
    await anonymizeRoaster(id);
    const error = useRootStore.getState().crm.error;
    if (error) {
      pushToast({ kind: 'error', message: error.detail ?? error.title ?? 'Failed to anonymize roaster' });
    } else {
      pushToast({ kind: 'success', message: 'Roaster anonymized' });
    }
  };

  const handleLogIntervention = async (data: InterventionFormValues) => {
    if (!selectedRoasterId) return;
    clearCrmError();
    const updated = await logIntervention(selectedRoasterId, { ...data, date: new Date().toISOString().split('T')[0] });
    if (updated) {
      pushToast({ kind: 'success', message: 'Intervention logged' });
      setInterventionKey((k) => k + 1);
    } else {
      const error = useRootStore.getState().crm.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to log intervention' });
    }
  };

  const getChurnRiskDetails = (risk: number | null) => {
    const score = risk ?? 0;
    let color = '';
    let label = '';

    if (score < 0.20) {
      color = 'bg-leaf/20 text-leaf border-leaf/10';
      label = t('roasters.risk.low', 'Low');
    } else if (score < 0.40) {
      color = 'bg-gold-100 text-gold-text border-gold/10';
      label = t('roasters.risk.moderate', 'Moderate');
    } else if (score < 0.60) {
      color = 'bg-warning-bg text-warning border-warning/10';
      label = t('roasters.risk.elevated', 'Elevated');
    } else if (score < 0.80) {
      color = 'bg-danger-bg/50 text-danger border-danger/10';
      label = t('roasters.risk.high', 'High');
    } else {
      color = 'bg-danger-bg text-danger border-danger/20';
      label = t('roasters.risk.critical', 'Critical');
    }

    return { color, label };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success-bg text-success border-success/15';
      case 'trial':
        return 'bg-info-bg text-info border-info/15';
      case 'dormant':
        return 'bg-warning-bg text-warning border-warning/15';
      case 'churned':
        return 'bg-recessed text-muted border-border';
      default:
        return 'bg-recessed text-ink border-border';
    }
  };

  if (loading && roasters.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('roasters.overline', 'ACCOUNT & CUSTOMER SUCCESS LEDGER')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('roasters.title', 'Roaster Accounts')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            {t('roasters.subtitle', 'Monitor roaster lifetime value, payback terms, and coordinate retention interventions using the machine learning churn hazard risk matrix.')}
          </p>
        </div>
        <div className="p-6 text-muted font-sans">
          {t('common:states.loading', 'Loading…')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('roasters.overline', 'ACCOUNT & CUSTOMER SUCCESS LEDGER')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('roasters.title', 'Roaster Accounts')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            {t('roasters.subtitle', 'Monitor roaster lifetime value, payback terms, and coordinate retention interventions using the machine learning churn hazard risk matrix.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
        >
          <Plus size={16} />
          Add Roaster
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden h-fit">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-sans border-collapse">
              <thead>
                <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
                  <th className="px-4 py-3">ROASTER</th>
                  <th className="px-4 py-3 text-center">STATUS</th>
                  <th className="px-4 py-3 text-center">CHURN RISK</th>
                  <th className="px-4 py-3 text-right">LTV</th>
                  <th className="px-4 py-3 text-right">CAC</th>
                  <th className="px-4 py-3 text-center">PAYBACK</th>
                  <th className="px-4 py-3 text-center">LAST ORDER</th>
                  <th className="px-4 py-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {roasters.map((roaster) => {
                  const isSelected = selectedRoasterId === roaster.id;
                  const riskInfo = getChurnRiskDetails(roaster.churnRiskScore);

                  return (
                    <tr
                      key={roaster.id}
                      onClick={() => setSelectedRoasterId(roaster.id)}
                      className={`hover:bg-hover/10 cursor-pointer transition-colors ${isSelected ? 'bg-teal/5' : ''}`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-roast text-white flex items-center justify-center font-bold text-xs">
                            {roaster.roasterName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-ink block">{roaster.roasterName}</span>
                            <span className="text-[10px] overline text-subtle tracking-wider font-sans capitalize">{roaster.segment}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider ${getStatusBadge(roaster.status)}`}>
                          {roaster.status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-full text-xs font-mono font-semibold leading-none shadow-sm bg-surface">
                          <span className={`w-2 h-2 rounded-full ${riskInfo.color.split(' ')[0]}`} />
                          <span className="figure text-ink">{Math.round((roaster.churnRiskScore ?? 0) * 100)}%</span>
                          <span className="text-subtle font-sans font-medium">({riskInfo.label})</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono figure-strong text-ink">
                        {roaster.ltvCents != null ? fmtCurrency(currentLocale).format(roaster.ltvCents / 100) : '-'}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono figure text-muted">
                        {roaster.cacCents != null ? fmtCurrency(currentLocale).format(roaster.cacCents / 100) : '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono figure text-ink">
                        {roaster.paybackMonths != null ? `${roaster.paybackMonths} mo` : '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center font-mono figure text-muted">
                        {roaster.daysSinceLastOrder != null ? `${roaster.daysSinceLastOrder}d ago` : '-'}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(roaster); }}
                            className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                            aria-label={`Edit ${roaster.roasterName}`}
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleAnonymize(roaster.id); }}
                            className="p-1.5 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors"
                            aria-label={`Anonymize ${roaster.roasterName}`}
                            title="Anonymize"
                          >
                            <UserX size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {roasters.length === 0 && !loading && (
              <div className="p-8 text-center text-muted font-sans">No roasters found.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {selectedRoaster ? (
            <div className="bg-surface rounded-lg border border-border-strong p-5 shadow-e2 space-y-5 relative">
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-roast text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedRoaster.roasterName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink leading-tight font-sans">
                      {selectedRoaster.roasterName}
                    </h2>
                    <span className="text-xs text-muted font-sans capitalize">{selectedRoaster.segment} Sourcing Account</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedRoaster)}
                    className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                    aria-label={`Edit ${selectedRoaster.roasterName}`}
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAnonymize(selectedRoaster.id)}
                    className="p-1.5 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors"
                    aria-label={`Anonymize ${selectedRoaster.roasterName}`}
                    title="Anonymize"
                  >
                    <UserX size={16} />
                  </button>
                </div>
              </div>

              {(selectedRoaster.churnRiskScore ?? 0) >= 0.70 ? (
                <div className="p-4 bg-danger-bg border border-danger rounded-lg flex gap-3 text-xs">
                  <AlertTriangle className="text-danger shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1.5">
                    <p className="font-bold text-danger leading-none">
                      AT RISK ACCELERATION FLAG
                    </p>
                    <p className="text-ink font-sans leading-snug">
                      This customer has reached a churn hazard score of {Math.round(selectedRoaster.churnRiskScore! * 100)}%. We recommend immediate sales intervention with a custom Nyeri Kenya lot sample.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('intervention-form');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1 bg-danger hover:bg-danger/90 text-white rounded-md font-sans font-semibold mt-1 shadow-sm active:scale-95 transition-all"
                    >
                      Trigger Intervention Offer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-recessed/30 border border-border rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted">CHURN RISK METRIC</span>
                  <span className="font-mono figure text-ink font-bold">{Math.round((selectedRoaster.churnRiskScore ?? 0) * 100)}%</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">LTV</span>
                  <span className="figure-strong text-lg text-ink font-bold">
                    {selectedRoaster.ltvCents != null ? fmtCurrency(currentLocale).format(selectedRoaster.ltvCents / 100) : '-'}
                  </span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">CAC</span>
                  <span className="figure-strong text-lg text-ink font-bold">
                    {selectedRoaster.cacCents != null ? fmtCurrency(currentLocale).format(selectedRoaster.cacCents / 100) : '-'}
                  </span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">PAYBACK</span>
                  <span className="figure-strong text-lg text-ink font-bold">{selectedRoaster.paybackMonths != null ? `${selectedRoaster.paybackMonths} mo` : '-'}</span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">TOTAL ORDERS</span>
                  <span className="figure-strong text-lg text-ink font-bold">{selectedRoaster.totalOrders ?? '-'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="overline text-xs text-muted font-bold">INTERVENTION TIMELINE</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {selectedRoaster.interventions.length > 0 ? selectedRoaster.interventions.map((item) => (
                    <div key={item.id} className="p-3 bg-surface border border-border rounded-lg space-y-1.5 text-xs font-sans">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-teal font-mono uppercase">{item.type.replace('_', ' ')}</span>
                        <span className="text-muted font-mono">{item.date}</span>
                      </div>
                      <p className="text-ink leading-snug">{item.notes}</p>
                      <div className="flex justify-between items-center text-[9px] pt-1">
                        <span className="text-muted">Outcome:</span>
                        <span className={`px-1.5 py-0.5 rounded-sm font-bold uppercase ${
                          item.outcome === 'retained'
                            ? 'bg-success-bg text-success'
                            : item.outcome === 'churned'
                              ? 'bg-danger-bg text-danger'
                              : 'bg-info-bg text-info'
                        }`}>
                          {item.outcome}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-muted font-sans">No interventions yet.</div>
                  )}
                </div>
              </div>

              <div id="intervention-form" className="space-y-3">
                <h3 className="overline text-xs text-muted font-bold">LOG INTERVENTION</h3>
                <InterventionForm
                  key={`${selectedRoasterId}-${interventionKey}`}
                  onSubmit={handleLogIntervention}
                  submitLabel="Log Intervention"
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface/50 rounded-lg border border-dashed border-border p-12 text-center text-muted">
              Select a roaster to view details
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={roasterModalOpen}
        onClose={handleCloseRoasterModal}
        title={editingRoaster ? 'Edit Roaster' : 'Add Roaster'}
        size="md"
      >
        <RoasterForm
          onSubmit={editingRoaster ? handleUpdate : handleCreate}
          defaultValues={editingRoaster ? {
            roasterName: editingRoaster.roasterName,
            segment: editingRoaster.segment,
            status: editingRoaster.status,
            primaryContact: {
              fullName: editingRoaster.primaryContact.fullName,
              email: editingRoaster.primaryContact.email,
              marketingOptIn: editingRoaster.primaryContact.marketingOptIn,
            },
          } : undefined}
        />
      </Modal>
    </div>
  );
};
