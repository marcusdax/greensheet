import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ResponsiveContainer, ComposedChart, LineChart, Line, Area, 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
  ReferenceLine
} from 'recharts';
import { TrendingUp, Layers, ShieldAlert, Award } from 'lucide-react';

// Benchmark Data: Acme's cup quality rating vs peer quantiles
const BENCHMARK_DATA = [
  { month: 'Jan', quantileLow: 82, quantileHigh: 88, median: 84, you: 85 },
  { month: 'Feb', quantileLow: 82, quantileHigh: 88, median: 84.5, you: 86 },
  { month: 'Mar', quantileLow: 83, quantileHigh: 89, median: 85, you: 87.5 },
  { month: 'Apr', quantileLow: 83, quantileHigh: 89, median: 85, you: 87.2 },
  { month: 'May', quantileLow: 84, quantileHigh: 90, median: 86, you: 88.5 },
  { month: 'Jun', quantileLow: 84, quantileHigh: 91, median: 86.5, you: 90.5 }
];

// LTV:CAC Scatter Data
const SCATTER_DATA = [
  { cac: 100, ltv: 3000, name: 'Micro A' },
  { cac: 150, ltv: 5000, name: 'Micro B' },
  { cac: 250, ltv: 12000, name: 'Boutique A' },
  { cac: 300, ltv: 18000, name: 'Boutique B' },
  { cac: 400, ltv: 24500, name: 'Coava' },
  { cac: 600, ltv: 55000, name: 'Commercial A' },
  { cac: 850, ltv: 124500, name: 'Blue Bottle' }
];

// Inventory Forecast Data
const INVENTORY_DATA = [
  { date: '06-01', actual: 4500 },
  { date: '06-08', actual: 3800 },
  { date: '06-15', actual: 3200 },
  { date: '06-22', actual: 2600 },
  { date: '06-29', actual: 2100 },
  { date: '07-06', forecast: 1600, confidenceLow: 1200, confidenceHigh: 2000 },
  { date: '07-13', forecast: 1100, confidenceLow: 700, confidenceHigh: 1500 },
  { date: '07-20', forecast: 800, confidenceLow: 400, confidenceHigh: 1200 },
  { date: '07-27', forecast: 600, confidenceLow: 200, confidenceHigh: 1000 }
];

// Churn Survival Data
const SURVIVAL_DATA = [
  { week: 0, survival: 100, ciLow: 100, ciHigh: 100 },
  { week: 4, survival: 95, ciLow: 92, ciHigh: 98 },
  { week: 8, survival: 91, ciLow: 87, ciHigh: 95 },
  { week: 12, survival: 88, ciLow: 83, ciHigh: 92 },
  { week: 16, survival: 82, ciLow: 76, ciHigh: 88 },
  { week: 20, survival: 79, ciLow: 72, ciHigh: 85 },
  { week: 24, survival: 75, ciLow: 67, ciHigh: 82 }
];

// Cohorts Heatmap Matrix Data (6 Cohorts x 6 Weeks)
const COHORT_ROWS = [
  { name: 'Jan 2025', size: 42, values: [100, 92, 88, 85, 82, 80] },
  { name: 'Feb 2025', size: 38, values: [100, 90, 85, 82, 79, null] },
  { name: 'Mar 2025', size: 45, values: [100, 95, 91, 88, null, null] },
  { name: 'Apr 2025', size: 31, values: [100, 88, 82, null, null, null] },
  { name: 'May 2025', size: 52, values: [100, 96, null, null, null, null] },
  { name: 'Jun 2025', size: 40, values: [100, null, null, null, null, null] }
];

export const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation(['catalog', 'common']);

  // Heatmap background color allocator (leaf -> gold scale)
  const getHeatmapColor = (val: number | null) => {
    if (val === null) return 'bg-transparent text-subtle/30';
    if (val === 100) return 'bg-leaf text-white';
    if (val >= 90) return 'bg-leaf/80 text-white';
    if (val >= 85) return 'bg-leaf/60 text-ink';
    if (val >= 80) return 'bg-gold/40 text-gold-text';
    return 'bg-warning-bg text-warning';
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col gap-1">
        <span className="overline text-xs text-muted tracking-wider">
          {t('analytics.overline', 'PORTFOLIO INTELLIGENCE')}
        </span>
        <h1 className="text-3xl font-display font-medium text-ink">
          {t('analytics.title', 'Intelligence & Analytics')}
        </h1>
        <p className="text-sm text-muted font-sans max-w-2xl">
          {t('analytics.subtitle', 'Strategic analytics detailing coffee lot performance benchmarks, customer retention cohorts, and supply forecasts.')}
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Benchmark Chart */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="overline text-xs text-muted font-bold">CUP QUALITY BENCHMARK</h3>
              <p className="text-xs text-subtle font-sans mt-0.5">SCA score comparison vs peer market quantiles</p>
            </div>
            <Award className="text-gold" size={16} />
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={BENCHMARK_DATA}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
                <XAxis dataKey="month" stroke="#8A8272" fontSize={10} tickLine={false} />
                <YAxis domain={[80, 95]} stroke="#8A8272" fontSize={10} tickLine={false} />
                <Tooltip
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
                
                {/* Quantile Area Band */}
                <Area 
                  type="monotone" 
                  dataKey="quantileHigh" 
                  stroke="none" 
                  fill="#DCEAEA" 
                  fillOpacity={0.6}
                  name="Top 90% Quantile"
                />
                <Area 
                  type="monotone" 
                  dataKey="quantileLow" 
                  stroke="none" 
                  fill="#F6F1E7" 
                  fillOpacity={0.8}
                  name="Bottom 10% Quantile"
                />
                
                {/* Median Line */}
                <Line 
                  type="monotone" 
                  dataKey="median" 
                  stroke="#2A6E73" 
                  strokeWidth={1.5} 
                  dot={false}
                  name="Market Median"
                />
                
                {/* Your Position (Gold Diamond) */}
                <Line 
                  type="monotone" 
                  dataKey="you" 
                  stroke="#C9A34A" 
                  strokeWidth={0}
                  dot={{ fill: '#C9A34A', stroke: '#16323E', strokeWidth: 1.5, r: 5 }}
                  name="Your Lot Average"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-[10px] font-mono text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-100 inline-block" /> Peer Quantile Band</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal inline-block" /> Market Median</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gold border border-navy inline-block" /> You (Outstanding)</span>
          </div>
        </div>

        {/* 2. Cohort Retention Heatmap */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="overline text-xs text-muted font-bold">COHORT RETENTION HEATMAP</h3>
              <p className="text-xs text-subtle font-sans mt-0.5">Percentage of roasters returning by weekly cohort</p>
            </div>
            <Layers className="text-leaf" size={16} />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border border-border font-sans text-xs">
              <thead>
                <tr className="bg-recessed/20 border-b border-border text-muted">
                  <th className="px-3 py-2 text-left font-semibold">Cohort</th>
                  <th className="px-2 py-2 font-semibold">Size</th>
                  <th className="px-2 py-2 font-semibold">Wk 0</th>
                  <th className="px-2 py-2 font-semibold">Wk 1</th>
                  <th className="px-2 py-2 font-semibold">Wk 2</th>
                  <th className="px-2 py-2 font-semibold">Wk 3</th>
                  <th className="px-2 py-2 font-semibold">Wk 4</th>
                  <th className="px-2 py-2 font-semibold">Wk 5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {COHORT_ROWS.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-2.5 text-left font-sans text-ink font-semibold">{row.name}</td>
                    <td className="px-2 py-2.5 text-muted figure">{row.size}</td>
                    {row.values.map((val, idx) => (
                      <td 
                        key={idx} 
                        className={`px-2 py-2.5 border-l border-border figure font-bold ${getHeatmapColor(val)}`}
                      >
                        {val !== null ? `${val}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center gap-4 text-[10px] font-sans text-muted">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-leaf inline-block" /> 100% Retained</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-leaf/60 inline-block" /> 85%+ Retained</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gold/45 inline-block" /> 80%+ Retained</span>
          </div>
        </div>

        {/* 3. LTV:CAC Scatter Chart */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="overline text-xs text-muted font-bold">LTV TO CAC RATIO SCATTER</h3>
              <p className="text-xs text-subtle font-sans mt-0.5">Roaster account acquisition efficiency mapping</p>
            </div>
            <TrendingUp className="text-navy" size={16} />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 10, right: 20, bottom: 20, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
                <XAxis 
                  type="number" 
                  dataKey="cac" 
                  name="CAC" 
                  unit="$" 
                  stroke="#8A8272" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  type="number" 
                  dataKey="ltv" 
                  name="LTV" 
                  unit="$" 
                  stroke="#8A8272" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ 
                    backgroundColor: '#16323E', 
                    borderColor: '#16323E',
                    borderRadius: '6px',
                    color: '#FDFBF5',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '11px'
                  }}
                />
                
                {/* 3:1 LTV:CAC Reference Line threshold */}
                <ReferenceLine 
                  stroke="#8C3B34" 
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  label={{ 
                    value: '3x LTV:CAC floor', 
                    fill: '#8C3B34', 
                    fontSize: 9, 
                    position: 'top' 
                  }}
                />

                <Scatter 
                  name="Roaster Accounts" 
                  data={SCATTER_DATA} 
                  fill="#16323E" 
                  shape="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Inventory Forecast */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="overline text-xs text-muted font-bold">INVENTORY FORECAST & TELEMETRY</h3>
              <p className="text-xs text-subtle font-sans mt-0.5">Physical coffee volume depletion curve (in Lbs)</p>
            </div>
            <ShieldAlert className="text-cherry" size={16} />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={INVENTORY_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
                <XAxis dataKey="date" stroke="#8A8272" fontSize={10} tickLine={false} />
                <YAxis stroke="#8A8272" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#16323E', 
                    borderColor: '#16323E',
                    borderRadius: '6px',
                    color: '#FDFBF5',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '11px'
                  }}
                />

                {/* Confidence cone Area */}
                <Area 
                  type="monotone" 
                  dataKey="confidenceHigh" 
                  stroke="none" 
                  fill="#DCEAEA" 
                  fillOpacity={0.5} 
                />
                <Area 
                  type="monotone" 
                  dataKey="confidenceLow" 
                  stroke="none" 
                  fill="#FDFBF5" 
                  fillOpacity={0.8} 
                />

                {/* Actual Line (solid navy) */}
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#16323E" 
                  strokeWidth={2.5} 
                  dot={{ fill: '#16323E', r: 3 }}
                  name="Actual Inventory"
                />

                {/* Forecast Line (dashed teal) */}
                <Line 
                  type="monotone" 
                  dataKey="forecast" 
                  stroke="#2A6E73" 
                  strokeDasharray="4 4" 
                  strokeWidth={2} 
                  dot={{ fill: '#2A6E73', r: 3 }}
                  name="Forecasted Depletion"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-[10px] font-sans text-muted">
            <span className="flex items-center gap-1 font-mono"><span className="w-3 h-0.5 bg-navy inline-block" /> Solid Navy = Actuals</span>
            <span className="flex items-center gap-1 font-mono"><span className="w-3 h-0.5 bg-teal border-t border-dashed inline-block" /> Dashed Teal = Forecast</span>
            <span className="flex items-center gap-1 font-mono"><span className="w-3 h-3 bg-teal-100/50 inline-block" /> Teal Cone = Confidence Range</span>
          </div>
        </div>

        {/* 5. Churn Survival Curve */}
        <div className="bg-surface p-5 rounded-lg border border-border shadow-e1 space-y-4 lg:col-span-2">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="overline text-xs text-muted font-bold">CHURN SURVIVAL CURVE</h3>
              <p className="text-xs text-subtle font-sans mt-0.5">Roaster retention probability over weeks (ML hazard prediction)</p>
            </div>
            <TrendingUp className="text-cherry" size={16} />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={SURVIVAL_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8CFBB" />
                <XAxis dataKey="week" stroke="#8A8272" fontSize={10} tickLine={false} />
                <YAxis stroke="#8A8272" fontSize={10} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#16323E', 
                    borderColor: '#16323E',
                    borderRadius: '6px',
                    color: '#FDFBF5',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '11px'
                  }}
                />
                
                {/* Confidence Interval band */}
                <Area 
                  type="monotone" 
                  dataKey="ciHigh" 
                  stroke="none" 
                  fill="#F9E6E2" 
                  fillOpacity={0.4} 
                  name="CI Upper"
                />
                <Area 
                  type="monotone" 
                  dataKey="ciLow" 
                  stroke="none" 
                  fill="#FDFBF5" 
                  fillOpacity={0.8} 
                  name="CI Lower"
                />

                {/* Survival Curve line */}
                <Line 
                  type="monotone" 
                  dataKey="survival" 
                  stroke="#8C3B34" 
                  strokeWidth={2.5} 
                  dot={{ fill: '#8C3B34', r: 3 }}
                  name="Survival Rate"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 text-[10px] font-sans text-muted">
            <span className="flex items-center gap-1 font-mono"><span className="w-3 h-0.5 bg-cherry inline-block" /> Solid Cherry = Survival Rate</span>
            <span className="flex items-center gap-1 font-mono"><span className="w-3 h-3 bg-danger-bg inline-block" /> Cherry Shading = 95% Confidence Band</span>
          </div>
        </div>

      </div>
    </div>
  );
};
