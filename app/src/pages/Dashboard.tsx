import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCents } from "@contracts/constants";
import { Activity, Coffee, DollarSign, Megaphone, ShoppingCart, Users, AlertTriangle, Trophy } from "lucide-react";

const EVENT_COLORS: Record<string, string> = {
  catalog: "bg-emerald-100 text-emerald-800",
  crm: "bg-sky-100 text-sky-800",
  samples: "bg-amber-100 text-amber-800",
  sample_kit: "bg-amber-100 text-amber-800",
  feedback: "bg-amber-100 text-amber-800",
  campaigns: "bg-violet-100 text-violet-800",
  order: "bg-green-100 text-green-800",
};

export default function Dashboard() {
  const { data } = trpc.analytics.dashboard.useQuery(undefined, { refetchInterval: 5000 });

  if (!data) {
    return (
      <Layout>
        <PageHeader title="Dashboard" sub="Loading platform telemetry…" />
      </Layout>
    );
  }

  const { kpis, funnel, lifecycleDist, churnRiskList, events } = data;
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
  ];

  return (
    <Layout>
      <PageHeader title="Greensheet Operations Dashboard" sub="COF-001–005 nurture funnel · live domain event stream" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

      <div className="grid md:grid-cols-3 gap-4 mb-6">
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
