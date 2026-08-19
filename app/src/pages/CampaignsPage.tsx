import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtCurrency } from '../i18n/format';
import {
  Plus, Pencil, Play, Pause, Archive,
  Mail, MessageSquare, Sparkles,
  ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, BarChart, Bar, Cell
} from 'recharts';
import { useCampaigns, useRules, useUi, useRootStore } from '../stores/root-store';
import { CampaignForm, type CampaignFormValues } from '../components/forms/CampaignForm';
import { RuleForm, type RuleFormValues } from '../components/forms/RuleForm';
import { toRuleActions } from '../lib/rule-action-helpers';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { MARKETING_TEMPLATES } from '../api/marketing-data';
import type { Campaign, CampaignCreate, CampaignPatch, CampaignStatus, AutomationRuleCreate, AutomationRule, RuleAction } from '../types/api';

const STATUS_FILTERS: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'retired', label: 'Retired' },
];

interface ABVariant {
  name: string;
  sampleSize: number;
  conversions: number;
  convRate: number;
  ciLower: number;
  ciUpper: number;
  probBest: number;
  status: 'winner' | 'loser' | 'running';
}

interface CampaignRuleMock {
  id: string;
  code: string;
  name: string;
  triggerEvent: string;
  channel: 'email' | 'sms' | 'system';
  subjectA: string;
  subjectB: string;
  openRateA: number;
  openRateB: number;
  status: 'converted' | 'active' | 'idle';
  abData: ABVariant[];
}

const RULE_STATUS_BY_CODE: Record<string, CampaignRuleMock['status']> = {
  'COF-001': 'converted',
  'COF-002': 'active',
  'COF-003': 'idle',
  'COF-004': 'idle',
  'COF-005': 'idle',
};

function findSendTemplate(rule: AutomationRule): RuleAction | undefined {
  return rule.actions.find((a) => a.actionType === 'SEND_TEMPLATE');
}

function findRuleTemplate(rule: AutomationRule) {
  const send = findSendTemplate(rule);
  if (!send?.templateId) return undefined;
  return MARKETING_TEMPLATES.find((t) => t.id === send.templateId);
}

function buildABVariant(
  label: string,
  sampleSize: number,
  rate: number,
  probabilityBest: number,
  status: ABVariant['status'],
): ABVariant {
  const conversions = Math.round(sampleSize * (rate / 100));
  const convRate = (conversions / sampleSize) * 100;
  return {
    name: label,
    sampleSize,
    conversions,
    convRate,
    ciLower: Math.max(0, convRate - 2),
    ciUpper: Math.min(100, convRate + 2),
    probBest: probabilityBest * 100,
    status,
  };
}

function buildCampaignRuleMock(rule: AutomationRule): CampaignRuleMock | null {
  // The A/B panel derives its data from the rule's first SEND_TEMPLATE action
  // (touchpoint 1). Later touchpoints in the same rule are not rendered here.
  const template = findRuleTemplate(rule);
  if (!template) return null;

  const { subjectA, subjectB, metrics, channel } = template;
  const openRateA = metrics.openRateA ?? 0;
  const openRateB = metrics.openRateB ?? null;
  const sampleSize = 600;

  const abData: ABVariant[] = [];

  if (subjectB != null && openRateB != null && channel === 'email') {
    const aWins = openRateA >= openRateB;
    abData.push(buildABVariant(`Variant A (${subjectA.slice(0, 40)}…)`, sampleSize, openRateA, aWins ? 0.68 : 0.32, aWins ? 'winner' : 'loser'));
    abData.push(buildABVariant(`Variant B (${subjectB.slice(0, 40)}…)`, sampleSize, openRateB, aWins ? 0.32 : 0.68, aWins ? 'loser' : 'winner'));
  } else {
    abData.push(buildABVariant(`Variant A (${subjectA.slice(0, 40)}…)`, sampleSize, openRateA, 1.0, 'running'));
  }

  return {
    id: rule.id,
    code: rule.ruleCode,
    name: rule.ruleName,
    triggerEvent: rule.triggerEvent,
    channel,
    subjectA,
    subjectB: subjectB ?? '',
    openRateA,
    openRateB: openRateB ?? 0,
    status: RULE_STATUS_BY_CODE[rule.ruleCode] ?? 'idle',
    abData,
  };
}

const MOCK_LINE_DATA = [
  { name: 'Week 1', opens: 400, clicks: 240, conversions: 120 },
  { name: 'Week 2', opens: 600, clicks: 360, conversions: 180 },
  { name: 'Week 3', opens: 800, clicks: 480, conversions: 240 },
  { name: 'Week 4', opens: 1100, clicks: 700, conversions: 350 },
  { name: 'Week 5', opens: 1400, clicks: 920, conversions: 480 },
  { name: 'Week 6', opens: 1800, clicks: 1240, conversions: 620 }
];

const getStatusBadgeClass = (status: CampaignStatus) => {
  switch (status) {
    case 'active': return 'bg-success-bg text-success border-success/15';
    case 'paused': return 'bg-warning-bg text-warning border-warning/15';
    case 'retired': return 'bg-recessed text-muted border-border';
    default: return 'bg-info-bg text-info border-info/15';
  }
};

export const CampaignsPage: React.FC = () => {
  const { t } = useTranslation(['campaigns', 'common']);

  const {
    campaigns, loading: campaignsLoading, performance,
    loadCampaigns, createCampaign, updateCampaign, activateCampaign, pauseCampaign, retireCampaign, loadPerformance,
  } = useCampaigns();
  const { rules, loadRules, createRule } = useRules();
  const { pushToast } = useUi();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [activeRuleIndex, setActiveRuleIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  const campaignRules = useMemo(
    () => rules.filter((r) => r.campaignId === selectedCampaignId),
    [rules, selectedCampaignId]
  );

  const activeRule = campaignRules[activeRuleIndex] || null;
  const currentRuleMock = activeRule ? buildCampaignRuleMock(activeRule) : null;

  useEffect(() => {
    void loadCampaigns({ status: statusFilter === 'all' ? undefined : [statusFilter] });
  }, [loadCampaigns, statusFilter]);

  useEffect(() => {
    if (selectedCampaignId) {
      void loadRules({ campaignId: selectedCampaignId });
      void loadPerformance(selectedCampaignId);
    }
  }, [loadRules, loadPerformance, selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    setActiveRuleIndex(0);
  }, [selectedCampaignId]);

  const clearCampaignError = () => {
    useRootStore.setState((state) => ({ campaigns: { ...state.campaigns, error: null } }));
  };

  const clearRuleError = () => {
    useRootStore.setState((state) => ({ rules: { ...state.rules, error: null } }));
  };

  const handleOpenAddCampaign = () => {
    setEditingCampaign(null);
    setCampaignModalOpen(true);
  };

  const handleOpenEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleCloseCampaignModal = () => {
    setCampaignModalOpen(false);
    setEditingCampaign(null);
  };

  const handleCreateCampaign = async (data: CampaignFormValues) => {
    clearCampaignError();
    const { status: _status, ...rest } = data;
    const createPayload: CampaignCreate = {
      ...rest,
      targetAudience: data.targetAudience
        ? { ...data.targetAudience, segments: data.targetAudience.segments ?? [] }
        : { segments: [] },
    };
    const created = await createCampaign(createPayload);
    if (created) {
      pushToast({ kind: 'success', message: 'Campaign created' });
      setSelectedCampaignId(created.id);
      handleCloseCampaignModal();
    } else {
      const error = useRootStore.getState().campaigns.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create campaign' });
    }
  };

  const handleUpdateCampaign = async (data: CampaignFormValues) => {
    if (!editingCampaign) return;
    clearCampaignError();
    const patch: CampaignPatch = {
      name: data.name,
      description: data.description,
      status: data.status,
    };
    if (data.targetAudience) {
      patch.targetAudience = {
        ...data.targetAudience,
        segments: data.targetAudience.segments ?? [],
      };
    }
    const updated = await updateCampaign(editingCampaign.id, patch);
    if (updated) {
      pushToast({ kind: 'success', message: 'Campaign updated' });
      handleCloseCampaignModal();
    } else {
      const error = useRootStore.getState().campaigns.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update campaign' });
    }
  };

  const handleLifecycle = async (action: 'activate' | 'pause' | 'retire', id: string) => {
    clearCampaignError();
    let result: Campaign | null = null;
    let message = '';
    switch (action) {
      case 'activate':
        result = await activateCampaign(id);
        message = 'Campaign activated';
        break;
      case 'pause':
        result = await pauseCampaign(id);
        message = 'Campaign paused';
        break;
      case 'retire':
        result = await retireCampaign(id);
        message = 'Campaign retired';
        break;
    }
    if (result) {
      pushToast({ kind: 'success', message });
    } else {
      const error = useRootStore.getState().campaigns.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to update campaign status' });
    }
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
      setRuleDrawerOpen(false);
    } else {
      const error = useRootStore.getState().rules.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create rule' });
    }
  };

  const renderLifecycleButtons = (campaign: Campaign) => {
    const buttons: React.ReactNode[] = [];
    if (campaign.status === 'draft' || campaign.status === 'paused') {
      buttons.push(
        <button
          key="activate"
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleLifecycle('activate', campaign.id); }}
          className="p-1.5 text-muted hover:text-success hover:bg-success-bg rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-teal"
          aria-label={`${t('activate')} ${campaign.name}`}
          title={t('activate')}
        >
          <Play size={16} />
        </button>
      );
    }
    if (campaign.status === 'active') {
      buttons.push(
        <button
          key="pause"
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleLifecycle('pause', campaign.id); }}
          className="p-1.5 text-muted hover:text-warning hover:bg-warning-bg rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-teal"
          aria-label={`Pause ${campaign.name}`}
          title="Pause"
        >
          <Pause size={16} />
        </button>
      );
    }
    if (campaign.status === 'active' || campaign.status === 'paused' || campaign.status === 'draft') {
      buttons.push(
        <button
          key="retire"
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleLifecycle('retire', campaign.id); }}
          className="p-1.5 text-muted hover:text-danger hover:bg-danger-bg rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-teal"
          aria-label={`${t('retire')} ${campaign.name}`}
          title={t('retire')}
        >
          <Archive size={16} />
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">
            {t('campaigns.overline', 'GROWTH MARKETING HUB')}
          </span>
          <h1 className="text-3xl font-display font-medium text-ink">
            {t('campaigns.title', 'Campaign Intelligence')}
          </h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            {t('campaigns.subtitle', 'Configure automated marketing workflows and inspect Bayesian A/B campaign variant analytics.')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddCampaign}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all focus-visible:ring-2 focus-visible:ring-teal"
        >
          <Plus size={16} />
          {t('create')}
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-teal ${
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

      {campaignsLoading && campaigns.length === 0 ? (
        <div className="p-6 text-muted font-sans">
          {t('common:states.loading', 'Loading…')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign List */}
          <div className="lg:col-span-1 bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden h-fit">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs overline text-muted bg-recessed/15">
                    <th className="px-4 py-3">CAMPAIGN</th>
                    <th className="px-4 py-3 text-center">STATUS</th>
                    <th className="px-4 py-3 text-center">RULES</th>
                    <th className="px-4 py-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-sans">
                  {campaigns.map((campaign) => {
                    const isSelected = selectedCampaignId === campaign.id;
                    return (
                      <tr
                        key={campaign.id}
                        onClick={() => setSelectedCampaignId(campaign.id)}
                        className={`hover:bg-hover/10 cursor-pointer transition-colors ${isSelected ? 'bg-teal/5' : ''}`}
                      >
                        <td className="px-4 py-3.5">
                          <div>
                            <span className="font-semibold text-ink block">{campaign.name}</span>
                            <span className="text-[10px] overline text-subtle tracking-wider font-sans">{campaign.slug}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider ${getStatusBadgeClass(campaign.status)}`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono figure text-ink">
                          {campaign.ruleCodes.length}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleOpenEditCampaign(campaign); }}
                              className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors"
                              aria-label={`Edit ${campaign.name}`}
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            {renderLifecycleButtons(campaign)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {campaigns.length === 0 && !campaignsLoading && (
                <div className="p-8 text-center text-muted font-sans">No campaigns found.</div>
              )}
            </div>
          </div>

          {/* Designer / Performance */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCampaign ? (
              <>
                {/* Campaign Detail Header */}
                <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <span className="overline text-xs text-muted block mb-1">SELECTED CAMPAIGN</span>
                      <h2 className="text-xl font-display font-medium text-ink">{selectedCampaign.name}</h2>
                      <p className="text-sm text-muted font-sans">{selectedCampaign.slug}</p>
                      {selectedCampaign.description && (
                        <p className="text-sm text-ink font-sans mt-2">{selectedCampaign.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 border rounded-md text-xs font-semibold uppercase ${getStatusBadgeClass(selectedCampaign.status)}`}>
                        {selectedCampaign.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditCampaign(selectedCampaign)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-recessed rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-teal"
                        aria-label={`Edit ${selectedCampaign.name}`}
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {renderLifecycleButtons(selectedCampaign)}
                      <button
                        type="button"
                        onClick={() => setRuleDrawerOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-navy text-white rounded-md hover:bg-navy-800 transition-colors focus-visible:ring-2 focus-visible:ring-teal"
                      >
                        <Plus size={14} />
                        Rule
                      </button>
                    </div>
                  </div>

                  {selectedCampaign.targetAudience?.segments && selectedCampaign.targetAudience.segments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCampaign.targetAudience.segments.map((segment) => (
                        <span key={segment} className="px-2 py-0.5 bg-recessed border border-border rounded-full text-[10px] font-semibold text-muted uppercase">
                          {segment}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* KPI Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
                    <span className="overline text-[10px] text-muted block mb-1">TOTAL SENT</span>
                    <div className="figure-strong text-2xl text-ink font-bold">{performance?.sent?.toLocaleString() ?? '—'}</div>
                    <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
                      <ArrowUpRight size={10} /> +12%
                    </span>
                  </div>
                  <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
                    <span className="overline text-[10px] text-muted block mb-1">OPEN RATE</span>
                    <div className="figure-strong text-2xl text-ink font-bold">{performance?.openRate != null ? `${(performance.openRate * 100).toFixed(1)}%` : '—'}</div>
                    <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
                      <ArrowUpRight size={10} /> +2.1%
                    </span>
                  </div>
                  <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
                    <span className="overline text-[10px] text-muted block mb-1">CLICK RATE (CTR)</span>
                    <div className="figure-strong text-2xl text-ink font-bold">{performance?.clickRate != null ? `${(performance.clickRate * 100).toFixed(1)}%` : '—'}</div>
                    <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
                      <ArrowUpRight size={10} /> +1.4%
                    </span>
                  </div>
                  <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
                    <span className="overline text-[10px] text-muted block mb-1">CONVERSION RATE</span>
                    <div className="figure-strong text-2xl text-ink font-bold">{performance?.conversionRate != null ? `${(performance.conversionRate * 100).toFixed(1)}%` : '—'}</div>
                    <span className="text-[10px] text-danger font-semibold flex items-center gap-0.5 mt-1 font-mono">
                      <ArrowDownRight size={10} /> -0.5%
                    </span>
                  </div>
                  <div className="col-span-2 lg:col-span-1 bg-surface p-4 rounded-lg border border-border shadow-e1">
                    <span className="overline text-[10px] text-muted block mb-1">ATTRIBUTED REVENUE</span>
                    <div className="figure-strong text-2xl text-ink font-bold">
                      {performance?.attributedRevenueCents != null
                        ? fmtCurrency('en-US').format(performance.attributedRevenueCents / 100)
                        : '—'}
                    </div>
                    <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
                      <ArrowUpRight size={10} /> +18.4%
                    </span>
                  </div>
                </div>

                {/* Rule Stepper */}
                <div className="bg-surface p-5 rounded-lg border border-border shadow-e1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="overline text-xs text-muted font-bold">RULE SEQUENCE</span>
                    <span className="text-xs text-muted font-sans">{campaignRules.length} rule(s)</span>
                  </div>
                  {campaignRules.length === 0 ? (
                    <div className="text-sm text-muted font-sans">
                      No rules yet. Add a rule to build the campaign sequence.
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-between max-w-3xl mx-auto py-2">
                      <div className="absolute left-4 right-4 h-0.5 bg-recessed z-0" />
                      {campaignRules.map((rule, idx) => {
                        const isSelected = activeRuleIndex === idx;
                        const ruleStatus = RULE_STATUS_BY_CODE[rule.ruleCode] ?? 'idle';
                        const isConverted = ruleStatus === 'converted';
                        const isActive = ruleStatus === 'active';

                        let medallionClass = 'bg-recessed text-muted border-transparent';
                        if (isConverted) medallionClass = 'bg-gold text-ink font-bold border-gold shadow-sm';
                        else if (isActive) medallionClass = 'bg-navy text-white border-navy shadow-sm';
                        else if (isSelected) medallionClass = 'bg-navy text-white border-navy shadow-sm';

                        return (
                          <button
                            key={rule.id}
                            onClick={() => setActiveRuleIndex(idx)}
                            className="relative z-10 flex flex-col items-center group focus-visible:ring-1 focus-visible:ring-teal"
                          >
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all ${medallionClass} ${
                              isSelected ? 'scale-110 ring-2 ring-teal/30' : 'group-hover:border-border-strong'
                            }`}>
                              {isConverted ? '★' : idx + 1}
                            </div>
                            <span className="text-[10px] font-mono mt-1 text-muted group-hover:text-ink font-bold">
                              {rule.ruleCode}
                            </span>
                            <span className="hidden sm:block text-[9px] text-subtle max-w-[80px] text-center leading-none mt-0.5">
                              {rule.ruleName}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rule Detail + A/B Performance */}
                {activeRule && currentRuleMock ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="overline text-xs text-muted block mb-1">TRIGGER EVENT</span>
                            <span className="px-2.5 py-1 bg-recessed border border-border text-ink rounded-md font-mono text-xs">
                              {activeRule.triggerEvent}
                            </span>
                          </div>
                          <div>
                            <span className="overline text-xs text-muted block mb-1 text-right">CHANNEL</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                              currentRuleMock.channel === 'email'
                                ? 'bg-teal/10 text-teal border border-teal/20'
                                : currentRuleMock.channel === 'sms'
                                  ? 'bg-leaf/10 text-leaf border border-leaf/20'
                                  : 'bg-recessed text-muted border border-border'
                            }`}>
                              {currentRuleMock.channel === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                              <span className="capitalize">{currentRuleMock.channel}</span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="overline text-xs text-muted">A/B TEST SUBJECTS</h3>
                          <div className="space-y-3 bg-recessed/10 p-4 rounded-lg border border-border">
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="font-bold text-ink">Variant A</span>
                                <span className="figure text-teal">{currentRuleMock.openRateA}% open rate</span>
                              </div>
                              <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/40">
                                "{currentRuleMock.subjectA}"
                              </p>
                              <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                                <div className="h-full bg-teal" style={{ width: `${Math.min(100, currentRuleMock.openRateA)}%` }} />
                              </div>
                            </div>
                            {currentRuleMock.channel === 'email' && currentRuleMock.subjectB && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs font-mono">
                                  <span className="font-bold text-ink">Variant B</span>
                                  <span className="figure text-teal">{currentRuleMock.openRateB}% open rate</span>
                                </div>
                                <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/20">
                                  "{currentRuleMock.subjectB}"
                                </p>
                                <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                                  <div className="h-full bg-teal/55" style={{ width: `${Math.min(100, currentRuleMock.openRateB)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface p-5 rounded-lg border border-border-strong shadow-e1 space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="overline text-xs text-muted font-bold">BAYESIAN A/B TEST REPORT</h3>
                          <span className="text-[10px] font-mono text-success bg-success-bg px-2 py-0.5 rounded-full border border-success/15 flex items-center gap-1 font-bold">
                            <Sparkles size={10} /> {currentRuleMock.code} EXPERIMENT
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-sm font-sans border-collapse text-left">
                            <thead>
                              <tr className="border-b border-border text-xs overline text-muted">
                                <th className="py-2">VARIANT</th>
                                <th className="py-2 text-right">SAMPLE</th>
                                <th className="py-2 text-right">CONV</th>
                                <th className="py-2 text-right">CONV RATE</th>
                                <th className="py-2 text-center">95% CI</th>
                                <th className="py-2 text-right">PROB BEST</th>
                                <th className="py-2 text-center">STATUS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentRuleMock.abData.map((v) => {
                                const isWinner = v.status === 'winner';
                                const isLoser = v.status === 'loser';
                                return (
                                  <tr key={v.name} className={`border-b border-border ${isWinner ? 'bg-success-bg/30' : ''}`}>
                                    <td className="py-3 font-semibold text-ink">{v.name}</td>
                                    <td className="py-3 text-right font-mono figure text-ink">{v.sampleSize.toLocaleString()}</td>
                                    <td className="py-3 text-right font-mono figure text-ink">{v.conversions}</td>
                                    <td className={`py-3 text-right font-mono figure-strong text-ink ${isWinner ? 'text-success' : ''}`}>{v.convRate.toFixed(2)}%</td>
                                    <td className="py-3 text-center font-mono text-xs text-muted">[{v.ciLower.toFixed(1)}% – {v.ciUpper.toFixed(1)}%]</td>
                                    <td className="py-3 text-right font-mono figure-strong text-ink">{(v.probBest).toFixed(1)}%</td>
                                    <td className="py-3 text-center">
                                      {isWinner && (
                                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gold text-ink text-[10px] font-bold rounded-sm border border-gold-600/10">
                                          ★ Winner
                                        </span>
                                      )}
                                      {isLoser && (
                                        <span className="px-2 py-0.5 bg-recessed text-muted text-[10px] rounded-sm">
                                          Loser
                                        </span>
                                      )}
                                      {v.status === 'running' && (
                                        <span className="px-2 py-0.5 bg-info-bg text-info text-[10px] rounded-sm border border-info/10">
                                          Running
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="pt-4 border-t border-border space-y-2">
                          <span className="overline text-[10px] text-muted block mb-1">POSTERIOR CONVERSION RATE ESTIMATES (MEAN)</span>
                          <div className="h-28 bg-recessed/10 rounded-md border border-border/50 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={currentRuleMock.abData}
                                layout="vertical"
                                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                              >
                                <XAxis type="number" domain={[0, 40]} hide />
                                <YAxis dataKey="name" type="category" hide />
                                <Bar dataKey="convRate" fill="#2A6E73" radius={[0, 4, 4, 0]} barSize={16}>
                                  {currentRuleMock.abData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.status === 'winner' ? '#C9A34A' : '#2A6E73'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                      <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
                        <div className="flex justify-between items-center border-b border-border pb-3">
                          <h3 className="overline text-xs text-muted font-bold">ENGAGEMENT OVER TIME</h3>
                          <button className="text-muted hover:text-ink transition-colors" title="Reload Stats">
                            <RefreshCw size={12} />
                          </button>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={MOCK_LINE_DATA}
                              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
                              <XAxis dataKey="name" stroke="#8A8272" fontSize={10} tickLine={false} />
                              <YAxis stroke="#8A8272" fontSize={10} tickLine={false} />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: '#16323E',
                                  borderColor: '#16323E',
                                  borderRadius: '6px',
                                  color: '#FDFBF5',
                                  fontFamily: 'IBM Plex Mono',
                                  fontSize: '11px'
                                }}
                                itemStyle={{ color: '#FDFBF5' }}
                              />
                              <Line type="monotone" dataKey="opens" stroke="#16323E" strokeWidth={2} dot={{ fill: '#16323E', r: 3 }} activeDot={{ r: 5 }} name="Opens" />
                              <Line type="monotone" dataKey="clicks" stroke="#2A6E73" strokeWidth={2} dot={{ fill: '#2A6E73', r: 3 }} activeDot={{ r: 5 }} name="Clicks" />
                              <Line type="monotone" dataKey="conversions" stroke="#C9A34A" strokeWidth={2} dot={{ fill: '#C9A34A', r: 3 }} activeDot={{ r: 5 }} name="Conversions" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono border-t border-border pt-4">
                          <div className="flex flex-col">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-navy mx-auto mb-1" />
                            <span className="text-muted">Opens</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal mx-auto mb-1" />
                            <span className="text-muted">Clicks</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gold mx-auto mb-1" />
                            <span className="text-muted">Conversions</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-3">
                        <h3 className="overline text-xs text-muted font-bold">AUTOMATION LOG</h3>
                        <div className="space-y-2 font-mono text-[10px] leading-tight">
                          <div className="flex justify-between text-muted">
                            <span>[10:24:12] Welcome email dispatched</span>
                            <span className="text-info font-bold">COF-001</span>
                          </div>
                          <div className="flex justify-between text-muted">
                            <span>[09:15:30] SMS urgent trigger logged</span>
                            <span className="text-warning font-bold">COF-004</span>
                          </div>
                          <div className="flex justify-between text-muted">
                            <span>[08:02:44] Suppression filter applied</span>
                            <span className="text-subtle font-bold">COF-005</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface p-8 rounded-lg border border-border text-center text-muted font-sans">
                    {campaignRules.length > 0
                      ? 'Select a rule with matching mock data to view performance analytics.'
                      : 'Add rules to this campaign to start building the automation sequence.'}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-surface/50 rounded-lg border border-dashed border-border p-12 text-center text-muted">
                Select a campaign to view the designer and analytics.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={campaignModalOpen}
        onClose={handleCloseCampaignModal}
        title={editingCampaign ? 'Edit Campaign' : t('create')}
        size="md"
      >
        <CampaignForm
          onSubmit={editingCampaign ? handleUpdateCampaign : handleCreateCampaign}
          defaultValues={editingCampaign ? {
            slug: editingCampaign.slug,
            name: editingCampaign.name,
            description: editingCampaign.description,
            status: editingCampaign.status,
            targetAudience: editingCampaign.targetAudience,
          } : undefined}
        />
      </Modal>

      <Drawer
        isOpen={ruleDrawerOpen}
        onClose={() => setRuleDrawerOpen(false)}
        title="Add Rule"
        size="lg"
      >
        {selectedCampaign ? (
          <RuleForm
            campaignId={selectedCampaign.id}
            onSubmit={handleCreateRule}
          />
        ) : (
          <div className="text-muted font-sans">Select a campaign first.</div>
        )}
      </Drawer>
    </div>
  );
};
