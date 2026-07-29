import React, { useEffect, useMemo, useState } from 'react';
import { Plus, MessageSquareText, Package } from 'lucide-react';
import { useSamples, useCatalog, useCrm, useUi, useRootStore } from '../stores/root-store';
import { SampleKitForm } from '../components/forms/SampleKitForm';
import { FeedbackForm } from '../components/forms/FeedbackForm';
import { Modal } from '../components/ui/Modal';
import type { SampleKit, SampleKitCreate, SampleFeedback } from '../types/api';

const statusTimeline: SampleKit['status'][] = [
  'requested',
  'assembling',
  'shipped',
  'delivered',
  'feedback_pending',
  'feedback_received',
];

const statusLabel = (status: SampleKit['status']) => {
  switch (status) {
    case 'requested': return 'Requested';
    case 'assembling': return 'Assembling';
    case 'shipped': return 'Shipped';
    case 'delivered': return 'Delivered';
    case 'feedback_pending': return 'Feedback Pending';
    case 'feedback_received': return 'Feedback Received';
    case 'exception': return 'Exception';
    default: return status;
  }
};

export const SampleKitsPage: React.FC = () => {
  const { kits, loading, loadKits, createKit, submitFeedback } = useSamples();
  const { lots, loadLots } = useCatalog();
  const { roasters, loadRoasters } = useCrm();
  const { pushToast } = useUi();

  const [requestOpen, setRequestOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);

  useEffect(() => {
    void loadKits();
  }, [loadKits]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  useEffect(() => {
    void loadRoasters();
  }, [loadRoasters]);

  const selectedKit = useMemo(() => kits.find((k) => k.id === selectedKitId) ?? null, [kits, selectedKitId]);

  const roasterOptions = useMemo(
    () => roasters.map((r) => ({ value: r.id, label: r.roasterName })),
    [roasters],
  );

  const lotOptions = useMemo(
    () => lots.map((l) => ({ value: l.id, label: `${l.origin} — ${l.varietal ?? 'Unknown'}` })),
    [lots],
  );

  const clearError = () => {
    useRootStore.setState((state) => ({ samples: { ...state.samples, error: null } }));
  };

  const handleCreate = async (data: SampleKitCreate) => {
    clearError();
    const created = await createKit(data);
    if (created) {
      pushToast({ kind: 'success', message: 'Sample kit requested' });
      setRequestOpen(false);
    } else {
      const error = useRootStore.getState().samples.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to request sample kit' });
    }
  };

  const handleFeedback = async (data: SampleFeedback) => {
    clearError();
    const updated = await submitFeedback(data);
    if (updated) {
      pushToast({ kind: 'success', message: 'Feedback submitted' });
      setFeedbackOpen(false);
      setSelectedKitId(null);
    } else {
      const error = useRootStore.getState().samples.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to submit feedback' });
    }
  };

  const openFeedback = (kit: SampleKit) => {
    setSelectedKitId(kit.id);
    setFeedbackOpen(true);
  };

  const currentStatusIndex = (status: SampleKit['status']) =>
    statusTimeline.findIndex((s) => s === status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">SAMPLE KITS</span>
          <h1 className="text-3xl font-display font-medium text-ink">Sample Kits</h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            Request, track, and collect feedback on green coffee sample kits shipped to roasters.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRequestOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
        >
          <Plus size={16} />
          Request Sample Kit
        </button>
      </div>

      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-sans border-collapse">
            <thead>
              <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
                <th className="px-4 py-3">ROASTER</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">REQUESTED</th>
                <th className="px-4 py-3">TRACKING</th>
                <th className="px-4 py-3 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {kits.map((kit) => {
                const roaster = roasters.find((r) => r.id === kit.roasterId);
                return (
                  <tr key={kit.id} className="hover:bg-hover/10 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-bold text-xs">
                          <Package size={16} />
                        </div>
                        <div>
                          <span className="font-semibold text-ink block">{roaster?.roasterName ?? kit.roasterId}</span>
                          <span className="text-[10px] overline text-subtle tracking-wider font-sans">{kit.lots.length} lots</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider bg-info-bg text-info border-info/15">
                        {statusLabel(kit.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted font-mono text-xs">
                      {new Date(kit.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-muted font-mono text-xs">
                      {kit.trackingNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => openFeedback(kit)}
                        disabled={!kit.feedbackToken || kit.status === 'feedback_received'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-border hover:bg-recessed disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={`Leave feedback for ${roaster?.roasterName ?? 'kit'}`}
                      >
                        <MessageSquareText size={14} />
                        Feedback
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {kits.length === 0 && !loading && (
            <div className="p-8 text-center text-muted font-sans">No sample kits yet.</div>
          )}
        </div>
      </div>

      {selectedKit && (
        <div className="bg-surface rounded-lg border border-border-strong p-5 shadow-e2 space-y-4">
          <h2 className="text-lg font-display font-medium text-ink">Status Timeline</h2>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {statusTimeline.map((status, index) => {
              const activeIndex = currentStatusIndex(selectedKit.status);
              const isActive = index <= activeIndex;
              return (
                <React.Fragment key={status}>
                  <div className={`flex flex-col items-center min-w-[96px] text-center ${isActive ? 'text-teal' : 'text-muted'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-teal border-teal text-white' : 'bg-surface border-border text-muted'}`}>
                      {index + 1}
                    </div>
                    <span className="text-[10px] font-sans mt-1 leading-tight">{statusLabel(status)}</span>
                  </div>
                  {index < statusTimeline.length - 1 && (
                    <div className={`flex-1 h-0.5 min-w-[16px] ${index < activeIndex ? 'bg-teal' : 'bg-border'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request Sample Kit"
        size="lg"
      >
        <SampleKitForm
          onSubmit={handleCreate}
          roasterOptions={roasterOptions}
          lotOptions={lotOptions}
        />
      </Modal>

      <Modal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={`Submit Feedback${selectedKit ? ` — ${roasters.find((r) => r.id === selectedKit.roasterId)?.roasterName ?? ''}` : ''}`}
        size="md"
      >
        <FeedbackForm onSubmit={handleFeedback} kit={selectedKit} />
      </Modal>
    </div>
  );
};
