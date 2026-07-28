import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { fmtCurrency } from '../i18n/format';

interface RoasterAccount {
  id: string;
  name: string;
  segment: 'micro' | 'boutique' | 'commercial';
  status: 'active' | 'trial' | 'dormant' | 'churned';
  churnRisk: number; // 0.0 to 1.0
  ltv: number; // dollars
  cac: number; // dollars
  paybackMonths: number;
  lastOrderDaysAgo: number;
  totalOrders: number;
  interventions: {
    type: 'email_campaign' | 'sales_call' | 'discount_offer' | 'survey';
    date: string;
    outcome: 'retained' | 'churned' | 'pending';
    notes: string;
  }[];
}

const ROASTERS_DATA: RoasterAccount[] = [
  {
    id: 'r_001',
    name: 'Blue Bottle Coffee',
    segment: 'commercial',
    status: 'active',
    churnRisk: 0.12,
    ltv: 124500,
    cac: 850,
    paybackMonths: 4,
    lastOrderDaysAgo: 5,
    totalOrders: 42,
    interventions: [
      { type: 'sales_call', date: '2025-06-10', outcome: 'retained', notes: 'Scheduled annual contract renewal meeting.' }
    ]
  },
  {
    id: 'r_002',
    name: 'Heart Coffee Roasters',
    segment: 'boutique',
    status: 'active',
    churnRisk: 0.28,
    ltv: 24500,
    cac: 380,
    paybackMonths: 6,
    lastOrderDaysAgo: 14,
    totalOrders: 18,
    interventions: [
      { type: 'email_campaign', date: '2025-06-15', outcome: 'retained', notes: 'FOB price threshold alert sent.' }
    ]
  },
  {
    id: 'r_003',
    name: 'Coava Coffee Roasters',
    segment: 'boutique',
    status: 'dormant',
    churnRisk: 0.74,
    ltv: 18200,
    cac: 420,
    paybackMonths: 8,
    lastOrderDaysAgo: 45,
    totalOrders: 12,
    interventions: [
      { type: 'discount_offer', date: '2025-06-20', outcome: 'pending', notes: 'Offered 10% sample kit discount on Nyeri Kenya lot.' },
      { type: 'sales_call', date: '2025-05-18', outcome: 'retained', notes: 'Initial check-in regarding quality dissatisfaction.' }
    ]
  },
  {
    id: 'r_004',
    name: 'Metric Coffee Co.',
    segment: 'micro',
    status: 'trial',
    churnRisk: 0.45,
    ltv: 4200,
    cac: 120,
    paybackMonths: 3,
    lastOrderDaysAgo: 3,
    totalOrders: 3,
    interventions: [
      { type: 'survey', date: '2025-06-25', outcome: 'pending', notes: 'Onboarding survey sent via automatic flow.' }
    ]
  },
  {
    id: 'r_005',
    name: 'Stumptown Coffee',
    segment: 'commercial',
    status: 'churned',
    churnRisk: 0.95,
    ltv: 95400,
    cac: 850,
    paybackMonths: 9,
    lastOrderDaysAgo: 120,
    totalOrders: 31,
    interventions: [
      { type: 'discount_offer', date: '2025-04-12', outcome: 'churned', notes: 'Attempted save offer. No response.' }
    ]
  }
];

export const RoastersPage: React.FC = () => {
  const { t, i18n } = useTranslation(['catalog', 'common']);
  const currentLocale = i18n.language;

  // Selected Roaster for Detail View
  const [selectedRoasterId, setSelectedRoasterId] = useState<string | null>('r_003'); // Default to dormant/at-risk for demonstration
  
  const selectedRoaster = ROASTERS_DATA.find((r) => r.id === selectedRoasterId);

  // Helper to determine Churn Risk Color representation
  const getChurnRiskDetails = (risk: number) => {
    let color = '';
    let label = '';
    
    if (risk < 0.20) {
      color = 'bg-leaf/20 text-leaf border-leaf/10';
      label = t('roasters.risk.low', 'Low');
    } else if (risk < 0.40) {
      color = 'bg-gold-100 text-gold-text border-gold/10';
      label = t('roasters.risk.moderate', 'Moderate');
    } else if (risk < 0.60) {
      color = 'bg-warning-bg text-warning border-warning/10';
      label = t('roasters.risk.elevated', 'Elevated');
    } else if (risk < 0.80) {
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

  return (
    <div className="space-y-6">
      {/* View Header */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Accounts List Table */}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {ROASTERS_DATA.map((roaster) => {
                  const isSelected = selectedRoasterId === roaster.id;
                  const riskInfo = getChurnRiskDetails(roaster.churnRisk);

                  return (
                    <tr
                      key={roaster.id}
                      onClick={() => setSelectedRoasterId(roaster.id)}
                      className={`hover:bg-hover/10 cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal/5' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="px-4 py-3.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-roast text-white flex items-center justify-center font-bold text-xs">
                          {roaster.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-ink block">{roaster.name}</span>
                          <span className="text-[10px] overline text-subtle tracking-wider font-sans capitalize">{roaster.segment}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 border text-2xs rounded-full font-sans uppercase font-bold tracking-wider ${getStatusBadge(roaster.status)}`}>
                          {roaster.status}
                        </span>
                      </td>

                      {/* Churn Risk */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-full text-xs font-mono font-semibold leading-none shadow-sm bg-surface">
                          <span className={`w-2 h-2 rounded-full ${riskInfo.color.split(' ')[0]}`} />
                          <span className="figure text-ink">{Math.round(roaster.churnRisk * 100)}%</span>
                          <span className="text-subtle font-sans font-medium">({riskInfo.label})</span>
                        </div>
                      </td>

                      {/* LTV */}
                      <td className="px-4 py-3.5 text-right font-mono figure-strong text-ink">
                        {fmtCurrency(currentLocale).format(roaster.ltv)}
                      </td>

                      {/* CAC */}
                      <td className="px-4 py-3.5 text-right font-mono figure text-muted">
                        {fmtCurrency(currentLocale).format(roaster.cac)}
                      </td>

                      {/* Payback */}
                      <td className="px-4 py-3.5 text-center font-mono figure text-ink">
                        {roaster.paybackMonths} mo
                      </td>

                      {/* Last order */}
                      <td className="px-4 py-3.5 text-center font-mono figure text-muted">
                        {roaster.lastOrderDaysAgo}d ago
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Account Detail view */}
        <div className="lg:col-span-1 space-y-6">
          {selectedRoaster ? (
            <div className="bg-surface rounded-lg border border-border-strong p-5 shadow-e2 space-y-5 relative">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-roast text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedRoaster.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink leading-tight font-sans">
                      {selectedRoaster.name}
                    </h2>
                    <span className="text-xs text-muted font-sans capitalize">{selectedRoaster.segment} Sourcing Account</span>
                  </div>
                </div>
              </div>

              {/* Churn Risk Score Banner (Alert when >= 0.70) */}
              {selectedRoaster.churnRisk >= 0.70 ? (
                <div className="p-4 bg-danger-bg border border-danger rounded-lg flex gap-3 text-xs">
                  <AlertTriangle className="text-danger shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1.5">
                    <p className="font-bold text-danger leading-none">
                      AT RISK ACCELERATION FLAG
                    </p>
                    <p className="text-ink font-sans leading-snug">
                      This customer has reached a churn hazard score of {Math.round(selectedRoaster.churnRisk * 100)}%. We recommend immediate sales intervention with a custom Nyeri Kenya lot sample.
                    </p>
                    <button 
                      onClick={() => alert(`Logging discount save offer task for ${selectedRoaster.name}`)}
                      className="px-2.5 py-1 bg-danger hover:bg-danger/90 text-white rounded-md font-sans font-semibold mt-1 shadow-sm active:scale-95 transition-all"
                    >
                      Trigger Intervention Offer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-recessed/30 border border-border rounded-lg flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted">CHURN RISK METRIC</span>
                  <span className="font-mono figure text-ink font-bold">{Math.round(selectedRoaster.churnRisk * 100)}%</span>
                </div>
              )}

              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">LTV</span>
                  <span className="figure-strong text-lg text-ink font-bold">{fmtCurrency(currentLocale).format(selectedRoaster.ltv)}</span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">CAC</span>
                  <span className="figure-strong text-lg text-ink font-bold">{fmtCurrency(currentLocale).format(selectedRoaster.cac)}</span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">PAYBACK</span>
                  <span className="figure-strong text-lg text-ink font-bold">{selectedRoaster.paybackMonths} mo</span>
                </div>
                <div className="bg-recessed/20 border border-border p-3 rounded-lg text-center">
                  <span className="overline text-[9px] text-muted block mb-0.5">TOTAL ORDERS</span>
                  <span className="figure-strong text-lg text-ink font-bold">{selectedRoaster.totalOrders}</span>
                </div>
              </div>

              {/* Interventions Log list */}
              <div className="space-y-3">
                <h3 className="overline text-xs text-muted font-bold">INTERVENTION TIMELINE</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {selectedRoaster.interventions.map((item, idx) => (
                    <div key={idx} className="p-3 bg-surface border border-border rounded-lg space-y-1.5 text-xs font-sans">
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
                  ))}
                </div>
              </div>

              {/* Log Intervention Action Button */}
              <button 
                onClick={() => alert(`Logging new sales intervention call for ${selectedRoaster.name}`)}
                className="w-full py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 hover:shadow-e2 active:scale-95 transition-all text-center"
              >
                Log Sales Call / Email
              </button>

            </div>
          ) : (
            <div className="bg-surface/50 rounded-lg border border-dashed border-border p-12 text-center text-muted">
              Select a roaster to view details
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
