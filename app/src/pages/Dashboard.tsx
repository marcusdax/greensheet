import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCents } from "@contracts/constants";
import {
  Activity,
  Coffee,
  DollarSign,
  Megaphone,
  ShoppingCart,
  Users,
  AlertTriangle,
  Trophy,
  Handshake,
  MousePointerClick,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// Domain chips on the event stream — brand tint surfaces (tokens §status + brand tints).
const EVENT_COLORS: Record<string, string> = {
  catalog: "bg-success-soft text-success",
  crm: "bg-info-soft text-info",
  samples: "bg-gold-100 text-gold-600",
  sample_kit: "bg-gold-100 text-gold-600",
  feedback: "bg-gold-100 text-gold-600",
  campaigns: "bg-teal-100 text-teal-700",
  order: "bg-navy/[0.08] text-navy",
  warehouse: "bg-clay-soft text-clay",
  qc: "bg-roast-100 text-roast",
  partners: "bg-warning-soft text-warning",
  comms: "bg-info-soft text-info",
  growth: "bg-cherry-100 text-cherry",
  education: "bg-muted text-muted-foreground",
};

// Categorical channel palette — validated with the dataviz six-checks script
// (all-pairs CVD ΔE 9.8, normal ΔE 17.1 on #FDFBF5); "system" takes the
// neutral Other slot. Donut renders in this fixed order with direct labels.
const CHANNEL_ORDER = ["email", "sms", "whatsapp", "crm", "system"] as const;
const CHANNEL_COLORS: Record<string, string> = {
  email: "#128A78",
  sms: "#C9A34A",
  whatsapp: "#3468C0",
  crm: "#B03A30",
  system: "#8A8272",
};

// Severity ramp for exception tiers — validated (adjacent CVD ΔE 15.2, normal 16.9).
const TIER_COLORS: Record<string, string> = { "1": "#D4A94C", "2": "#C0641F", "3": "#8C2F26" };

// Shared chart chrome — parchment surface, decorative-border grid, muted ink ticks.
const GRID_STROKE = "#D8CFBB";
const TICK = { fontSize: 11, fill: "#5C5546" } as const;
const TOOLTIP_STYLE = {
  background: "#FDFBF5",
  border: "1px solid #D8CFBB",
  borderRadius: 10,
  boxShadow: "0 8px 24px -8px rgba(14, 26, 34, 0.18)",
  fontSize: 12,
  color: "#221D16",
} as const;

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const { data } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 5000 });

  if (!data) {
    return (
      <Layout>
        <PageHeader title="Operations Dashboard" sub="Loading platform telemetry…" />
      </Layout>
    );
  }

  const {
    kpis,
    funnel,
    lifecycleDist,
    churnRiskList,
    events,
    revenueSeries,
    channelDist,
    orderStatusDist,
    exceptionsByTier,
    lotPerformance,
    scoreBuckets,
  } = data;
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.value));

  const kpiCards = [
    { label: "Active lots", value: kpis.activeLots, icon: Coffee },
    { label: "Roaster accounts", value: kpis.totalRoasters, icon: Users },
    { label: "Orders", value: kpis.totalOrders, icon: ShoppingCart },
    { label: "Delivered revenue", value: formatCents(kpis.deliveredRevenueCents), icon: DollarSign },
    { label: "Pipeline value", value: formatCents(kpis.pipelineCents), icon: Activity },
    { label: "Messages sent", value: kpis.messagesSent, icon: Megaphone },
    { label: "Conversions", value: kpis.conversions, icon: Trophy },
    { label: "High churn risk", value: kpis.highRisk, icon: AlertTriangle },
    { label: "Open exceptions", value: kpis.openExceptions, icon: AlertTriangle },
    { label: "Pricing clicks", value: kpis.pricingClicks, icon: MousePointerClick },
    { label: "Floor accrued", value: formatCents(kpis.floorAccruedCents), icon: Handshake },
    { label: "Rev-share accrued", value: formatCents(kpis.revenueShareAccruedCents), icon: Handshake },
  ];

  // Fixed entity order keeps donut adjacency (and color identity) stable across refreshes.
  const channelDistMap = channelDist as Record<string, number>;
  const channelData = CHANNEL_ORDER.filter((c) => (channelDistMap[c] ?? 0) > 0).map((channel) => ({
    name: channel,
    value: channelDistMap[channel],
  }));
  const tierData = Object.entries(exceptionsByTier)
    .filter(([, v]) => v > 0)
    .map(([tier, count]) => ({ name: `Tier ${tier}`, value: count, tier }));

  return (
    <Layout>
      <PageHeader
        title="Operations Dashboard"
        sub="Trade, comms, warehouse & partner telemetry · live domain event stream"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="font-display text-[1.35rem] font-semibold leading-none tracking-tight">{value}</div>
                <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue + channel row */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue & order volume</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {revenueSeries.length > 0 ? (
              /* Two synced panels sharing one x-domain — never a dual-axis chart. */
              <div className="h-full flex flex-col">
                <div className="overline-label mb-1">Revenue</div>
                <div className="flex-[3] min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueSeries} syncId="revops" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16323E" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#16323E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="day" hide />
                      <YAxis tickFormatter={(v: number) => usd(v)} tick={TICK} width={70} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number | string) => [usd(Number(value)), "Revenue"]}
                      />
                      <Area type="monotone" dataKey="revenueCents" name="Revenue" stroke="#16323E" fill="url(#rev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="overline-label mt-2 mb-1">Orders</div>
                <div className="flex-[2] min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueSeries} syncId="revops" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="day" tick={TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={TICK} width={70} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="orders" name="Orders" fill="#A8842E" radius={[3, 3, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <EmptyChart label="No orders yet — revenue appears here as orders are placed." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dispatch volume by channel</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="#FDFBF5"
                    strokeWidth={2}
                    label={(p) => `${p.name} ${p.value}`}
                    fontSize={11}
                  >
                    {channelData.map((d) => (
                      <Cell key={d.name} fill={CHANNEL_COLORS[d.name] ?? "#8A8272"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No dispatches yet." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lot performance + quality + exceptions row */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top lots by lbs sold</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {lotPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lotPerformance} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="lotName" width={110} tick={{ fontSize: 10, fill: "#5C5546" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number | string) => [`${Number(v).toLocaleString()} lbs`, "Sold"]} />
                  <Bar dataKey="lbs" fill="#128A78" radius={[0, 3, 3, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No line items yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cup score distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {scoreBuckets.some((b) => b.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreBuckets} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="band" tick={TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Sessions" fill="#A8842E" radius={[3, 3, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No cupping sessions yet — record one in the QC Lab." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exceptions by tier</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {tierData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="#FDFBF5"
                    strokeWidth={2}
                    label={(p) => `${p.name} (${p.value})`}
                    fontSize={11}
                  >
                    {tierData.map((d) => (
                      <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No warehouse exceptions on record." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel + lifecycle + churn + order status row */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Campaign funnel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{f.stage}</span>
                  <span className="font-semibold font-mono text-[13px]">{f.value}</span>
                </div>
                <Progress value={(f.value / maxFunnel) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">CRM lifecycle</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(lifecycleDist).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-sm">
                <Badge variant="outline" className="capitalize">{stage.replace("_", " ")}</Badge>
                <span className="font-semibold font-mono text-[13px]">{count}</span>
              </div>
            ))}
            {Object.keys(lifecycleDist).length === 0 && (
              <p className="text-sm text-muted-foreground">No roasters yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Order status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(orderStatusDist).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between text-sm">
                <Badge variant="outline" className="capitalize">{stage}</Badge>
                <span className="font-semibold font-mono text-[13px]">{count}</span>
              </div>
            ))}
            {Object.keys(orderStatusDist).length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Churn risk watch (threshold 0.70)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {churnRiskList.map((r) => (
              <div key={r.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="truncate mr-2">{r.roasterName}</span>
                  <span className={`font-mono text-[13px] ${r.churnRiskScore >= 0.7 ? "text-destructive font-semibold" : ""}`}>
                    {r.churnRiskScore.toFixed(2)}
                  </span>
                </div>
                <Progress
                  value={r.churnRiskScore * 100}
                  className={`h-2 ${r.churnRiskScore >= 0.7 ? "[&>div]:bg-destructive" : ""}`}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Domain event stream (outbox)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-sm border-b border-border/60 pb-1.5">
                <span className={`rounded px-2 py-0.5 text-xs font-mono ${EVENT_COLORS[e.eventType.split(".")[0]] ?? "bg-muted text-muted-foreground"}`}>
                  {e.eventType}
                </span>
                <span className="text-muted-foreground text-xs">
                  {e.aggregateType} #{e.aggregateId}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet — request a sample kit or place an order.</p>}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-6">
      {label}
    </div>
  );
}
