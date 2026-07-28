import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCampaign } from '../stores/root-store';
import { 
  Mail, MessageSquare, Sparkles, 
  ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, BarChart, Bar, Cell
} from 'recharts';

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

interface CampaignRule {
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

const CAMPAIGN_RULES: CampaignRule[] = [
  {
    id: 'cof_001',
    code: 'COF-001',
    name: 'Welcome Series',
    triggerEvent: 'roaster.registered',
    channel: 'email',
    subjectA: 'Explore Specialty Lots on Greensheet',
    subjectB: 'Source Traceable Green Coffee Direct',
    openRateA: 64.2,
    openRateB: 58.7,
    status: 'converted',
    abData: [
      { name: 'Variant A (Subject A)', sampleSize: 1240, conversions: 198, convRate: 15.96, ciLower: 14.2, ciUpper: 17.8, probBest: 97.4, status: 'winner' },
      { name: 'Variant B (Subject B)', sampleSize: 1245, conversions: 142, convRate: 11.40, ciLower: 9.8, ciUpper: 13.1, probBest: 2.6, status: 'loser' }
    ]
  },
  {
    id: 'cof_002',
    code: 'COF-002',
    name: 'Kit Follow-up',
    triggerEvent: 'sample_kit.delivered',
    channel: 'email',
    subjectA: 'Your sample kit has arrived! Let\'s cup.',
    subjectB: 'Share your feedback on the latest samples',
    openRateA: 72.8,
    openRateB: 75.3,
    status: 'active',
    abData: [
      { name: 'Variant A (Subject A)', sampleSize: 620, conversions: 112, convRate: 18.06, ciLower: 15.3, ciUpper: 21.0, probBest: 38.5, status: 'running' },
      { name: 'Variant B (Subject B)', sampleSize: 618, conversions: 128, convRate: 20.71, ciLower: 17.9, ciUpper: 23.8, probBest: 61.5, status: 'running' }
    ]
  },
  {
    id: 'cof_003',
    code: 'COF-003',
    name: 'Score Report',
    triggerEvent: 'lot.score_published',
    channel: 'email',
    subjectA: 'New 90+ SCA Lot Released',
    subjectB: 'Fresh Arrivals: SCA Cupping Scores inside',
    openRateA: 84.1,
    openRateB: 88.5,
    status: 'idle',
    abData: [
      { name: 'Variant A (Subject A)', sampleSize: 310, conversions: 68, convRate: 21.93, ciLower: 17.8, ciUpper: 26.5, probBest: 12.0, status: 'loser' },
      { name: 'Variant B (Subject B)', sampleSize: 315, conversions: 94, convRate: 29.84, ciLower: 25.1, ciUpper: 34.9, probBest: 88.0, status: 'winner' }
    ]
  },
  {
    id: 'cof_004',
    code: 'COF-004',
    name: 'SMS Alerts',
    triggerEvent: 'lot.out_of_stock',
    channel: 'sms',
    subjectA: 'SMS Variant A: Lot [Origin] is 90% reserved.',
    subjectB: 'SMS Variant B: Alert: Only [Lbs] remaining of [Origin].',
    openRateA: 95.0,
    openRateB: 97.2,
    status: 'idle',
    abData: [
      { name: 'Variant A (Standard SMS)', sampleSize: 850, conversions: 42, convRate: 4.94, ciLower: 3.7, ciUpper: 6.4, probBest: 5.5, status: 'loser' },
      { name: 'Variant B (Urgency Alert)', sampleSize: 848, conversions: 78, convRate: 9.20, ciLower: 7.5, ciUpper: 11.2, probBest: 94.5, status: 'winner' }
    ]
  },
  {
    id: 'cof_005',
    code: 'COF-005',
    name: 'Suppression CRM',
    triggerEvent: 'roaster.dormant_30d',
    channel: 'system',
    subjectA: 'Log CRM Intervention Task',
    subjectB: 'Trigger 10% Save Offer Workflow',
    openRateA: 100,
    openRateB: 100,
    status: 'idle',
    abData: [
      { name: 'Variant A (Task Assignment)', sampleSize: 140, conversions: 35, convRate: 25.00, ciLower: 18.5, ciUpper: 32.7, probBest: 50.0, status: 'running' },
      { name: 'Variant B (Automatic Coupon)', sampleSize: 142, conversions: 36, convRate: 25.35, ciLower: 18.8, ciUpper: 33.1, probBest: 50.0, status: 'running' }
    ]
  }
];

const MOCK_LINE_DATA = [
  { name: 'Week 1', opens: 400, clicks: 240, conversions: 120 },
  { name: 'Week 2', opens: 600, clicks: 360, conversions: 180 },
  { name: 'Week 3', opens: 800, clicks: 480, conversions: 240 },
  { name: 'Week 4', opens: 1100, clicks: 700, conversions: 350 },
  { name: 'Week 5', opens: 1400, clicks: 920, conversions: 480 },
  { name: 'Week 6', opens: 1800, clicks: 1240, conversions: 620 }
];

export const CampaignsPage: React.FC = () => {
  const { t } = useTranslation(['campaigns', 'common']);
  const { activeStep, setActiveStep } = useCampaign();
  
  const currentRule = CAMPAIGN_RULES[activeStep] || CAMPAIGN_RULES[0];

  return (
    <div className="space-y-6">
      {/* View Header */}
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

      {/* 1. Rule Stepper */}
      <div className="bg-surface p-5 rounded-lg border border-border shadow-e1">
        <div className="relative flex items-center justify-between max-w-3xl mx-auto py-2">
          {/* Connector Line */}
          <div className="absolute left-4 right-4 h-0.5 bg-recessed z-0" />

          {CAMPAIGN_RULES.map((rule, idx) => {
            const isSelected = activeStep === idx;
            const isConverted = rule.status === 'converted';
            const isActive = rule.status === 'active';
            
            let medallionClass = 'bg-recessed text-muted border-transparent';
            if (isConverted) medallionClass = 'bg-gold text-ink font-bold border-gold shadow-sm';
            else if (isActive) medallionClass = 'bg-navy text-white border-navy shadow-sm';
            else if (isSelected) medallionClass = 'bg-navy text-white border-navy shadow-sm';

            return (
              <button
                key={rule.id}
                onClick={() => setActiveStep(idx)}
                className="relative z-10 flex flex-col items-center group focus-visible:ring-1 focus-visible:ring-teal"
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all ${medallionClass} ${
                  isSelected ? 'scale-110 ring-2 ring-teal/30' : 'group-hover:border-border-strong'
                }`}>
                  {isConverted ? '★' : idx + 1}
                </div>
                <span className="text-[10px] font-mono mt-1 text-muted group-hover:text-ink font-bold">
                  {rule.code}
                </span>
                <span className="hidden sm:block text-[9px] text-subtle max-w-[80px] text-center leading-none mt-0.5">
                  {rule.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
          <span className="overline text-[10px] text-muted block mb-1">TOTAL SENT</span>
          <div className="figure-strong text-2xl text-ink font-bold">24,580</div>
          <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight size={10} /> +12%
          </span>
        </div>
        <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
          <span className="overline text-[10px] text-muted block mb-1">OPEN RATE</span>
          <div className="figure-strong text-2xl text-ink font-bold">78.5%</div>
          <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight size={10} /> +2.1%
          </span>
        </div>
        <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
          <span className="overline text-[10px] text-muted block mb-1">CLICK RATE (CTR)</span>
          <div className="figure-strong text-2xl text-ink font-bold">42.3%</div>
          <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight size={10} /> +1.4%
          </span>
        </div>
        <div className="bg-surface p-4 rounded-lg border border-border shadow-e1">
          <span className="overline text-[10px] text-muted block mb-1">CONVERSION RATE</span>
          <div className="figure-strong text-2xl text-ink font-bold">18.6%</div>
          <span className="text-[10px] text-danger font-semibold flex items-center gap-0.5 mt-1 font-mono">
            <ArrowDownRight size={10} /> -0.5%
          </span>
        </div>
        <div className="col-span-2 lg:col-span-1 bg-surface p-4 rounded-lg border border-border shadow-e1">
          <span className="overline text-[10px] text-muted block mb-1">ATTRIBUTED REVENUE</span>
          <div className="figure-strong text-2xl text-ink font-bold">$125,400</div>
          <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 mt-1 font-mono">
            <ArrowUpRight size={10} /> +18.4%
          </span>
        </div>
      </div>

      {/* Main Campaign Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Rule Details & A/B performance */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 2. Rule Detail Card */}
          <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="overline text-xs text-muted block mb-1">TRIGGER EVENT</span>
                <span className="px-2.5 py-1 bg-recessed border border-border text-ink rounded-md font-mono text-xs">
                  {currentRule.triggerEvent}
                </span>
              </div>
              <div>
                <span className="overline text-xs text-muted block mb-1 text-right">CHANNEL</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                  currentRule.channel === 'email' 
                    ? 'bg-teal/10 text-teal border border-teal/20' 
                    : currentRule.channel === 'sms' 
                      ? 'bg-leaf/10 text-leaf border border-leaf/20'
                      : 'bg-recessed text-muted border border-border'
                }`}>
                  {currentRule.channel === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                  <span className="capitalize">{currentRule.channel}</span>
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="overline text-xs text-muted">A/B TEST SUBJECTS</h3>
              <div className="space-y-3 bg-recessed/10 p-4 rounded-lg border border-border">
                {/* Subject A */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-ink">Variant A</span>
                    <span className="figure text-teal">{currentRule.openRateA}% open rate</span>
                  </div>
                  <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/40">
                    "{currentRule.subjectA}"
                  </p>
                  <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                    <div className="h-full bg-teal" style={{ width: `${currentRule.openRateA}%` }} />
                  </div>
                </div>

                {/* Subject B */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="font-bold text-ink">Variant B</span>
                    <span className="figure text-teal">{currentRule.openRateB}% open rate</span>
                  </div>
                  <p className="text-sm text-ink font-sans pl-2 border-l-2 border-teal/20">
                    "{currentRule.subjectB}"
                  </p>
                  <div className="h-1.5 w-full bg-recessed rounded-full overflow-hidden">
                    <div className="h-full bg-teal/55" style={{ width: `${currentRule.openRateB}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. A/B Results Table */}
          <div className="bg-surface p-5 rounded-lg border border-border-strong shadow-e1 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="overline text-xs text-muted font-bold">BAYESIAN A/B TEST REPORT</h3>
              <span className="text-[10px] font-mono text-success bg-success-bg px-2 py-0.5 rounded-full border border-success/15 flex items-center gap-1 font-bold">
                <Sparkles size={10} /> {currentRule.code} EXPERIMENT
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
                  {currentRule.abData.map((v) => {
                    const isWinner = v.status === 'winner';
                    const isLoser = v.status === 'loser';
                    return (
                      <tr 
                        key={v.name} 
                        className={`border-b border-border ${
                          isWinner ? 'bg-success-bg/30' : ''
                        }`}
                      >
                        <td className="py-3 font-semibold text-ink">{v.name}</td>
                        <td className="py-3 text-right font-mono figure text-ink">{v.sampleSize.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono figure text-ink">{v.conversions}</td>
                        <td className={`py-3 text-right font-mono figure-strong text-ink ${isWinner ? 'text-success' : ''}`}>{v.convRate.toFixed(2)}%</td>
                        <td className="py-3 text-center font-mono text-xs text-muted">
                          [{v.ciLower.toFixed(1)}% – {v.ciUpper.toFixed(1)}%]
                        </td>
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

            {/* Posterior Means Bar Chart */}
            <div className="pt-4 border-t border-border space-y-2">
              <span className="overline text-[10px] text-muted block mb-1">POSTERIOR CONVERSION RATE ESTIMATES (MEAN)</span>
              <div className="h-28 bg-recessed/10 rounded-md border border-border/50 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentRule.abData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" domain={[0, 40]} hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Bar dataKey="convRate" fill="#2A6E73" radius={[0, 4, 4, 0]} barSize={16}>
                      {currentRule.abData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.status === 'winner' ? '#C9A34A' : '#2A6E73'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Engagement Over Time chart */}
        <div className="lg:col-span-1 space-y-6">
          {/* 4. Engagement Over Time */}
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
                  <Line 
                    type="monotone" 
                    dataKey="opens" 
                    stroke="#16323E" 
                    strokeWidth={2}
                    dot={{ fill: '#16323E', r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Opens"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#2A6E73" 
                    strokeWidth={2}
                    dot={{ fill: '#2A6E73', r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Clicks"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#C9A34A" 
                    strokeWidth={2}
                    dot={{ fill: '#C9A34A', r: 3 }}
                    activeDot={{ r: 5 }}
                    name="Conversions"
                  />
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

          {/* Quick automation log */}
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
    </div>
  );
};
