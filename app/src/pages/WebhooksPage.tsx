import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Eye, EyeOff, Copy, X } from 'lucide-react';
import { useWebhooks, useUi, useRootStore } from '../stores/root-store';
import { WebhookForm, type WebhookFormValues } from '../components/forms/WebhookForm';
import { Modal } from '../components/ui/Modal';
import type { WebhookDelivery, WebhookSubscription } from '../types/api';

const STATUS_FILTERS: { value: WebhookSubscription['status'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'failing', label: 'Failing' },
];

const getStatusBadgeClass = (status: WebhookSubscription['status']) => {
  switch (status) {
    case 'active': return 'bg-success-bg text-success border-success/15';
    case 'paused': return 'bg-warning-bg text-warning border-warning/15';
    case 'failing': return 'bg-danger-bg text-danger border-danger/15';
    default: return 'bg-recessed text-muted border-border';
  }
};

const getDeliveryStatusBadgeClass = (status: WebhookDelivery['status']) => {
  switch (status) {
    case 'delivered': return 'bg-success-bg text-success border-success/15';
    case 'pending': return 'bg-info-bg text-info border-info/15';
    case 'failed': return 'bg-warning-bg text-warning border-warning/15';
    case 'exhausted': return 'bg-danger-bg text-danger border-danger/15';
    default: return 'bg-recessed text-muted border-border';
  }
};

export const WebhooksPage: React.FC = () => {
  const { t } = useTranslation(['common']);
  const {
    webhooks,
    deliveries,
    loading,
    lastCreatedSecret,
    loadWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    loadDeliveries,
    clearSecret,
  } = useWebhooks();
  const { pushToast } = useUi();

  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WebhookSubscription['status'] | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookSubscription | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const selectedWebhook = useMemo(
    () => webhooks.find((w) => w.id === selectedWebhookId) || null,
    [webhooks, selectedWebhookId],
  );

  const filteredWebhooks = useMemo(() => {
    if (statusFilter === 'all') return webhooks;
    return webhooks.filter((w) => w.status === statusFilter);
  }, [webhooks, statusFilter]);

  useEffect(() => {
    void loadWebhooks({ status: statusFilter === 'all' ? undefined : [statusFilter] });
  }, [loadWebhooks, statusFilter]);

  useEffect(() => {
    if (selectedWebhookId) {
      void loadDeliveries(selectedWebhookId);
    }
  }, [loadDeliveries, selectedWebhookId]);

  useEffect(() => {
    if (!selectedWebhookId && webhooks.length > 0) {
      setSelectedWebhookId(webhooks[0].id);
    }
  }, [webhooks, selectedWebhookId]);

  useEffect(() => {
    if (lastCreatedSecret) {
      setShowSecret(false);
    }
  }, [lastCreatedSecret]);

  const clearWebhookError = () => {
    useRootStore.setState((state) => ({ webhooks: { ...state.webhooks, error: null } }));
  };

  const handleOpenAdd = () => {
    setEditingWebhook(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (webhook: WebhookSubscription) => {
    setEditingWebhook(webhook);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingWebhook(null);
  };

  const handleCreate = async (data: WebhookFormValues) => {
    clearWebhookError();
    const created = await createWebhook({
      url: data.url,
      description: data.description,
      events: data.events,
    });
    if (created) {
      pushToast({ kind: 'success', message: 'Webhook created. Save the signing secret now — it will not be shown again.' });
      setSelectedWebhookId(created.id);
      handleCloseModal();
    } else {
      const error = useRootStore.getState().webhooks.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create webhook' });
    }
  };

  const handleUpdate = async (data: WebhookFormValues) => {
    if (!editingWebhook) return;
    clearWebhookError();
    const updated = await updateWebhook(editingWebhook.id, {
      url: data.url,
      events: data.events,
    });
    if (updated) {
      pushToast({ kind: 'success', message: 'Webhook updated' });
      handleCloseModal();
    } else {
      const error = useRootStore.getState().webhooks.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update webhook' });
    }
  };

  const handleToggleStatus = async (webhook: WebhookSubscription) => {
    clearWebhookError();
    const nextStatus = webhook.status === 'active' ? 'paused' : 'active';
    const updated = await updateWebhook(webhook.id, { status: nextStatus });
    if (updated) {
      pushToast({ kind: 'success', message: `Webhook ${nextStatus}` });
    } else {
      const error = useRootStore.getState().webhooks.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update webhook status' });
    }
  };

  const handleDelete = async (id: string) => {
    clearWebhookError();
    const ok = await deleteWebhook(id);
    if (ok) {
      pushToast({ kind: 'success', message: 'Webhook deleted' });
      if (selectedWebhookId === id) {
        setSelectedWebhookId(null);
      }
    } else {
      const error = useRootStore.getState().webhooks.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to delete webhook' });
    }
  };

  const copySecret = () => {
    if (!lastCreatedSecret) return;
    void navigator.clipboard.writeText(lastCreatedSecret);
    pushToast({ kind: 'success', message: 'Signing secret copied' });
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('common:overline', 'INTEGRATIONS')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('common:title', 'Webhooks')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            Subscribe to platform events and inspect delivery logs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
        >
          <Plus size={16} />
          Create Webhook
        </button>
      </div>

      {/* Secret reveal banner */}
      {lastCreatedSecret && (
        <div className="bg-warning-bg border border-warning/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink font-sans">Signing secret revealed</h3>
              <p className="text-xs text-muted font-sans">
                Copy this secret now. For security, it will not be shown again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { clearSecret(); setShowSecret(false); }}
              className="p-1 text-muted hover:text-ink rounded-md"
              aria-label="Dismiss secret"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-surface border border-border rounded-md text-xs font-mono text-ink break-all">
              {showSecret ? lastCreatedSecret : '•'.repeat(Math.min(lastCreatedSecret.length, 40))}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((s) => !s)}
              className="p-2 text-muted hover:text-ink hover:bg-recessed rounded-md"
              aria-label={showSecret ? 'Hide secret' : 'Reveal secret'}
              title={showSecret ? 'Hide secret' : 'Reveal secret'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              type="button"
              onClick={copySecret}
              className="inline-flex items-center gap-1 px-3 py-2 bg-navy text-white rounded-md text-xs font-semibold hover:bg-navy-800"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Status Filter */}
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

      {loading && webhooks.length === 0 ? (
        <div className="p-6 text-muted font-sans">
          {t('common:states.loading', 'Loading…')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Webhook List */}
          <div className="lg:col-span-1 bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden h-fit">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3 text-center">STATUS</th>
                    <th className="px-4 py-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {filteredWebhooks.map((webhook) => {
                    const isSelected = selectedWebhookId === webhook.id;
                    return (
                      <tr
                        key={webhook.id}
                        onClick={() => setSelectedWebhookId(webhook.id)}
                        className={`hover:bg-hover/10 cursor-pointer transition-colors ${isSelected ? 'bg-teal/5' : ''}`}
                      >
                        <td className="px-4 py-3.5">
                          <div>
                            <span className="font-semibold text-ink block truncate max-w-[200px]">{webhook.url}</span>
                            {webhook.description && (
                              <span className="text-xs text-muted block truncate max-w-[200px]">{webhook.description}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleToggleStatus(webhook); }}
                            className={`px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider transition-colors ${getStatusBadgeClass(webhook.status)}`}
                          >
                            {webhook.status}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenEdit(webhook); }}
                              className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                              aria-label={`Edit webhook ${webhook.url}`}
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleDelete(webhook.id); }}
                              className="p-1.5 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors"
                              aria-label={`Delete webhook ${webhook.url}`}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredWebhooks.length === 0 && !loading && (
                <div className="p-8 text-center text-muted font-sans">No webhooks found.</div>
              )}
            </div>
          </div>

          {/* Detail / Delivery Log */}
          <div className="lg:col-span-2 space-y-6">
            {selectedWebhook ? (
              <>
                <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <span className="overline text-xs text-muted block mb-1">SELECTED WEBHOOK</span>
                      <h2 className="text-xl font-display font-medium text-ink break-all">{selectedWebhook.url}</h2>
                      {selectedWebhook.description && (
                        <p className="text-sm text-ink font-sans mt-2">{selectedWebhook.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 border rounded-md text-xs font-semibold uppercase ${getStatusBadgeClass(selectedWebhook.status)}`}>
                        {selectedWebhook.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(selectedWebhook)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                        aria-label={`Edit ${selectedWebhook.url}`}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedWebhook.events.map((event) => (
                      <span key={event} className="px-2 py-0.5 bg-recessed border border-border rounded-full text-[10px] font-semibold text-muted uppercase">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="overline text-xs text-muted font-bold">DELIVERY LOG</h3>
                    <span className="text-xs text-muted font-sans">{deliveries.length} recent</span>
                  </div>
                  {deliveries.length === 0 ? (
                    <div className="text-sm text-muted font-sans">No deliveries recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm font-sans border-collapse">
                        <thead>
                          <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
                            <th className="px-4 py-3">EVENT TYPE</th>
                            <th className="px-4 py-3 text-center">STATUS</th>
                            <th className="px-4 py-3 text-right">ATTEMPTS</th>
                            <th className="px-4 py-3 text-right">LAST CODE</th>
                            <th className="px-4 py-3 text-right">DURATION</th>
                            <th className="px-4 py-3 text-right">LAST ATTEMPT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-sans">
                          {deliveries.map((delivery) => (
                            <tr key={delivery.id}>
                              <td className="px-4 py-3 font-mono text-xs text-ink">{delivery.eventType}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 border rounded-full text-2xs font-semibold uppercase ${getDeliveryStatusBadgeClass(delivery.status)}`}>
                                  {delivery.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono figure text-ink">{delivery.attempts}</td>
                              <td className="px-4 py-3 text-right font-mono figure text-ink">{delivery.lastStatusCode ?? '—'}</td>
                              <td className="px-4 py-3 text-right font-mono figure text-ink">{delivery.durationMs != null ? `${delivery.durationMs}ms` : '—'}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                                {delivery.lastAttemptAt
                                  ? new Date(delivery.lastAttemptAt).toLocaleString()
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-surface/50 rounded-lg border border-dashed border-border p-12 text-center text-muted">
                Select a webhook to view its details and delivery log.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
        size="md"
      >
        <WebhookForm
          onSubmit={editingWebhook ? handleUpdate : handleCreate}
          defaultValues={editingWebhook ? {
            url: editingWebhook.url,
            description: editingWebhook.description,
            events: editingWebhook.events,
            challenge: 'unchanged',
          } : undefined}
        />
      </Modal>
    </div>
  );
};
