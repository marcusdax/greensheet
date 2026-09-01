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
  Legend,
} from "recharts";

const EVENT_COLORS: Record<string, string> = {
  catalog: "bg-[#3E6B50] text-white",
  crm: "bg-[#2A6E73] text-white",
  samples: "bg-[#C9A34A] text-[#16323E]",
  sample_kit: "bg-[#C9A34A] text-[#16323E]",
  feedback: "bg-[#C9A34A] text-[#16323E]",
  campaigns: "bg-[#8C3B34] text-white",
  order: "bg-[#16323E] text-[#F6F1E7]",
  warehouse: "bg-[#4A3527] text-white",
  qc: "bg-[#3E6B50]/80 text-white",
  partners: "bg-[#C9A34A]/80 text-[#16323E]",
  comms: "bg-[#2A6E73]/80 text-white",
  growth: "bg-[#8C3B34]/80 text-white",
  education: "bg-[#4A3527]/80 text-white",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "#16323E",
  whatsapp: "#25D366",
  sms: "#C9A34A",
  crm: "#4F6958",
  system: "#94a3b8",
};

const TIER_COLORS: Record<string, string> = { "1": "#d9a441", "2": "#f97316", "3": "#dc2626" };

const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const { data } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 5000 });

  if (!data) {
    return (
      <Layout>
        <PageHeader title="Dashboard" sub="Loading platform telemetry…" />
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

  const channelData = Object.entries(channelDist).map(([channel, count]) => ({
    name: channel,
    value: count,
  }));
  const tierData = Object.entries(exceptionsByTier)
    .filter(([, v]) => v > 0)
    .map(([tier, count]) => ({ name: `Tier ${tier}`, value: count, tier }));

  return (
    <Layout>
      <PageHeader
        title="Greensheet Operations Dashboard"
        sub="Trade, comms, warehouse & partner telemetry · live domain event stream"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold leading-none">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
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
          <CardContent className="h-64">
            {revenueSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
<AreaChart data={revenueSeries} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                   <defs>
                     <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="#16323E" stopOpacity={0.35} />
                       <stop offset="100%" stopColor="#16323E" stopOpacity={0.02} />
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="#D9D3C9" />
                   <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                   <YAxis yAxisId="rev" tickFormatter={(v: number) => usd(v)} tick={{ fontSize: 11 }} width={70} />
                   <YAxis yAxisId="ord" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                   <Tooltip
                     formatter={(value: number | string, name: string) =>
                       name === "Revenue" ? [usd(Number(value)), name] : [value, name]
                     }
                   />
                   <Legend />
                   <Area yAxisId="rev" type="monotone" dataKey="revenueCents" name="Revenue" stroke="#16323E" fill="url(#rev)" strokeWidth={2} />
                   <Bar yAxisId="ord" dataKey="orders" name="Orders" fill="#C9A341" radius={[3, 3, 0, 0]} />
                 </AreaChart>
              </ResponsiveContainer>
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
                  <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} label={(p) => `${p.name} ${p.value}`} fontSize={11}>
                    {channelData.map((d) => (
                      <Cell key={d.name} fill={CHANNEL_COLORS[d.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D3C9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="lotName" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number | string) => [`${Number(v).toLocaleString()} lbs`, "Sold"]} />
                  <Bar dataKey="lbs" fill="#16323E" radius={[0, 3, 3, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e1d8" vertical={false} />
                  <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Sessions" fill="#d9a441" radius={[3, 3, 0, 0]} />
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
                  <Pie data={tierData} dataKey="value" nameKey="name" outerRadius={80} label={(p) => `${p.name} (${p.value})`} fontSize={11}>
                    {tierData.map((d) => (
                      <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
                    ))}
                  </Pie>
                  <Tooltip />
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
                  <span className="font-semibold">{f.value}</span>
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
                <span className="font-semibold">{count}</span>
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
                <span className="font-semibold">{count}</span>
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
                  <span className={r.churnRiskScore >= 0.7 ? "text-destructive font-semibold" : ""}>
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
                <span className={`rounded px-2 py-0.5 text-xs font-mono ${EVENT_COLORS[e.eventType.split(".")[0]] ?? "bg-gray-100"}`}>
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
