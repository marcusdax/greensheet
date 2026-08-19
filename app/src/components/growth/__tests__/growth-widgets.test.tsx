import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  WtrChart,
  KitFunnelChart,
  CacByChannelChart,
  HazardHeatmap,
  KFactorGauge,
  CampaignLiftChart,
} from '../index';
import type { WtrPoint } from '../../../types/api';
import type {
  GrowthFunnelPoint,
  GrowthKFactorPoint,
  GrowthCampaignLiftPoint,
} from '../../../stores/selectors/analytics-selectors';
import type { CacChannelRow, HazardHeatmapRow } from '../../../types/api';

describe('Growth widgets', () => {
  beforeEach(() => {
    global.ResizeObserver = class ResizeObserver {
      constructor(private callback: (entries: Array<{ contentRect: DOMRectReadOnly }>) => void) {}
      observe(target: Element) {
        const rect = target.getBoundingClientRect();
        this.callback([{ contentRect: rect }]);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wtrData: WtrPoint[] = [
    { week: 'W01', wtr: 0.42, movingAverage: 0.4 },
    { week: 'W02', wtr: 0.45, movingAverage: 0.43 },
  ];

  const funnelData: GrowthFunnelPoint[] = [
    { stage: 'Kit Sent', count: 1000, conversionRate: 100 },
    { stage: 'Delivered', count: 920, conversionRate: 92 },
    { stage: 'Feedback', count: 414, conversionRate: 45 },
    { stage: 'First Order', count: 166, conversionRate: 40 },
  ];

  const cacData: CacChannelRow[] = [
    { channel: 'Paid Social', cac: 425, spend: 5000, newAccounts: 12 },
    { channel: 'Organic Search', cac: 120, spend: 0, newAccounts: 30 },
  ];

  const hazardData: HazardHeatmapRow[] = [
    { segment: 'micro', tier: 'T3', count: 12, avgHazard: 0.2 },
    { segment: 'boutique', tier: 'T3', count: 8, avgHazard: 0.55 },
    { segment: 'commercial', tier: 'T3', count: 4, avgHazard: 0.85 },
    { segment: 'micro', tier: 'T2', count: 6, avgHazard: 0.35 },
    { segment: 'boutique', tier: 'T2', count: 5, avgHazard: 0.65 },
    { segment: 'commercial', tier: 'T2', count: 3, avgHazard: 0.9 },
    { segment: 'micro', tier: 'T1', count: 2, avgHazard: 0.1 },
    { segment: 'boutique', tier: 'T1', count: 2, avgHazard: 0.5 },
    { segment: 'commercial', tier: 'T1', count: 1, avgHazard: 0.75 },
  ];

  const kFactorData: GrowthKFactorPoint = {
    current: 0.58,
    target: 0.6,
    gap: 0.02,
  };

  const campaignData: GrowthCampaignLiftPoint[] = [
    {
      campaignName: 'COF-001 Welcome',
      lift: 0.12,
      probability: 0.97,
      isSignificant: true,
    },
    {
      campaignName: 'COF-002 Feedback',
      lift: 0.08,
      probability: 0.91,
      isSignificant: false,
    },
  ];

  it('WtrChart renders title and week label', () => {
    const { container } = render(<WtrChart title="Weekly Tasting Rate" data={wtrData} />);
    expect(container).toHaveTextContent('Weekly Tasting Rate');
    expect(container).toHaveTextContent('W01');
  });

  it('KitFunnelChart renders title and stage label', () => {
    const { container } = render(<KitFunnelChart title="Kit Funnel" data={funnelData} />);
    expect(container).toHaveTextContent('Kit Funnel');
    expect(container).toHaveTextContent(/Kit\s?Sent/);
  });

  it('CacByChannelChart renders title, channel and ceiling label', () => {
    const { container } = render(<CacByChannelChart title="CAC by Channel" data={cacData} />);
    expect(container).toHaveTextContent('CAC by Channel');
    expect(container).toHaveTextContent(/Paid\s?Social/);
    expect(container).toHaveTextContent('Ceiling $500');
  });

  it('HazardHeatmap renders title and a hazard value', () => {
    const { container } = render(<HazardHeatmap title="Hazard Heatmap" data={hazardData} />);
    expect(container).toHaveTextContent('Hazard Heatmap');
    expect(container).toHaveTextContent('0.20');
  });

  it('KFactorGauge renders title and current value', () => {
    const { container } = render(<KFactorGauge title="K-Factor" data={kFactorData} />);
    expect(container).toHaveTextContent('K-Factor');
    expect(container).toHaveTextContent('0.58');
  });

  it('CampaignLiftChart renders title and campaign name', () => {
    const { container } = render(<CampaignLiftChart title="Campaign Lift" data={campaignData} />);
    expect(container).toHaveTextContent('Campaign Lift');
    expect(container).toHaveTextContent(/COF-001\s?Welcome/);
  });
});
