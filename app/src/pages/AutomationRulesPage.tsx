import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useRules, useUi, useRootStore } from '../stores/root-store';
import { RuleForm, type RuleFormValues } from '../components/forms/RuleForm';
import { toRuleActions, fromRuleActions } from '../lib/rule-action-helpers';
import { Modal } from '../components/ui/Modal';
import { DataTable } from '../components/ui/DataTable';
import type { AutomationRule, AutomationRuleCreate, AutomationRulePatch, RuleStatus } from '../types/api';

const STATUS_FILTERS: { value: RuleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'armed', label: 'Armed' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
];

const getStatusBadgeClass = (status: RuleStatus) => {
  switch (status) {
    case 'armed': return 'bg-success-bg text-success border-success/15';
    case 'paused': return 'bg-warning-bg text-warning border-warning/15';
    case 'retired': return 'bg-recessed text-muted border-border';
    default: return 'bg-info-bg text-info border-info/15';
  }
};

const ruleToFormValues = (rule: AutomationRule): RuleFormValues => ({
  ruleCode: rule.ruleCode,
  campaignId: rule.campaignId,
  ruleName: rule.ruleName,
  triggerEvent: rule.triggerEvent,
  conditionsJson: rule.conditionsJson,
  actions: fromRuleActions(rule.actions),
});

export const AutomationRulesPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const { rules, loading, loadRules, createRule, updateRule, deleteRule } = useRules();
  const { pushToast } = useUi();

  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const triggerEvents = useMemo(() => {
    const events = new Set(rules.map((r) => r.triggerEvent));
    return Array.from(events).sort();
  }, [rules]);

  const filteredRules = useMemo(() => {
    let result = rules;
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (triggerFilter !== 'all') {
      result = result.filter((r) => r.triggerEvent === triggerFilter);
    }
    return result;
  }, [rules, statusFilter, triggerFilter]);

  const clearRuleError = () => {
    useRootStore.setState((state) => ({ rules: { ...state.rules, error: null } }));
  };

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setFormModalOpen(false);
    setEditingRule(null);
  };

  const handleOpenDelete = (rule: AutomationRule) => {
    setDeleteTarget(rule);
  };

  const handleCloseDelete = () => {
    setDeleteTarget(null);
  };

  const handleCreateRule = async (data: RuleFormValues) => {
    clearRuleError();
    const createPayload: AutomationRuleCreate = {
      ...data,
      campaignId: data.campaignId ?? null,
      conditionsJson: data.conditionsJson ?? {},
      actions: toRuleActions(data.actions),
    };
    const created = await createRule(createPayload);
    if (created) {
      pushToast({ kind: 'success', message: 'Rule created' });
      handleCloseFormModal();
    } else {
      const error = useRootStore.getState().rules.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create rule' });
    }
  };

  const handleUpdateRule = async (data: RuleFormValues) => {
    if (!editingRule) return;
    clearRuleError();
    const patch: AutomationRulePatch = {
      ruleCode: data.ruleCode,
      ruleName: data.ruleName,
      triggerEvent: data.triggerEvent,
      campaignId: data.campaignId ?? null,
      conditionsJson: data.conditionsJson,
      actions: toRuleActions(data.actions),
      status: editingRule.status,
    };
    const updated = await updateRule(editingRule.id, patch);
    if (updated) {
      pushToast({ kind: 'success', message: 'Rule updated' });
      handleCloseFormModal();
    } else {
      const error = useRootStore.getState().rules.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update rule' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    clearRuleError();
    const deleted = await deleteRule(deleteTarget.id);
    if (deleted) {
      pushToast({ kind: 'success', message: 'Rule deleted' });
    } else {
      const error = useRootStore.getState().rules.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to delete rule' });
    }
    handleCloseDelete();
  };

  const columns = useMemo(() => [
    {
      key: 'ruleCode',
      header: 'Rule Code',
      accessor: (row: AutomationRule) => (
        <span className="font-mono text-xs font-semibold text-ink">{row.ruleCode}</span>
      ),
    },
    {
      key: 'ruleName',
      header: 'Name',
      accessor: (row: AutomationRule) => <span className="font-sans text-sm text-ink">{row.ruleName}</span>,
    },
    {
      key: 'triggerEvent',
      header: 'Trigger Event',
      accessor: (row: AutomationRule) => (
        <span className="font-mono text-xs text-teal bg-teal/10 px-2 py-1 rounded-md border border-teal/20">{row.triggerEvent}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row: AutomationRule) => (
        <span className={`px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider ${getStatusBadgeClass(row.status)}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'campaign',
      header: 'Campaign',
      accessor: (row: AutomationRule) => (
        <span className="text-sm text-muted font-sans">{row.campaignId ?? 'Standalone'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (row: AutomationRule) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
            className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
            aria-label={`Edit ${row.ruleName}`}
            title="Edit"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleOpenDelete(row); }}
            className="p-1.5 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors"
            aria-label={`Delete ${row.ruleName}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">AUTOMATION HUB</span>
          <h1 className="text-3xl font-display font-medium text-ink">Automation Rules</h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            Manage event-triggered automation rules across campaigns and standalone workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
        >
          <Plus size={16} />
          Create Rule
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-navy text-white'
                    : 'bg-surface border border-border text-muted hover:text-ink hover:border-border-strong'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="trigger-filter" className="text-xs font-semibold text-muted uppercase tracking-wider">Trigger</label>
          <select
            id="trigger-filter"
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold border border-border bg-surface text-ink focus:border-teal"
          >
            <option value="all">All triggers</option>
            {triggerEvents.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        {loading && rules.length === 0 ? (
          <div className="p-6 text-muted font-sans">{t('common:states.loading', 'Loading…')}</div>
        ) : (
          <DataTable
            data={filteredRules}
            columns={columns}
            keyExtractor={(row) => row.id}
            emptyMessage={
              <div className="text-center">
                <p className="text-muted font-sans">No rules match the selected filters.</p>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('all'); setTriggerFilter('all'); }}
                  className="mt-2 text-xs font-semibold text-teal hover:text-navy"
                >
                  Clear filters
                </button>
              </div>
            }
          />
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={handleCloseFormModal}
        title={editingRule ? 'Edit Rule' : 'Create Rule'}
        size="lg"
      >
        <RuleForm
          campaignId={editingRule ? editingRule.campaignId : null}
          onSubmit={editingRule ? handleUpdateRule : handleCreateRule}
          defaultValues={editingRule ? ruleToFormValues(editingRule) : undefined}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={handleCloseDelete}
        title="Delete Rule"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-danger-bg rounded-full text-danger">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-ink font-sans">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget?.ruleName}</span>?
              </p>
              <p className="text-xs text-muted font-sans">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseDelete}
              className="px-4 py-2 text-sm font-semibold text-muted hover:text-ink bg-surface border border-border rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              className="px-4 py-2 text-sm font-semibold text-white bg-danger hover:bg-danger-600 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
