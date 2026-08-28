import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, MessageSquare, Users, OctagonX, Zap } from "lucide-react";
import { toast } from "sonner";

const ACTION_ICON: Record<string, typeof Mail> = {
  SEND_EMAIL: Mail,
  SEND_SMS: MessageSquare,
  UPDATE_CRM_LIFECYCLE: Users,
  EXECUTE_CAMPAIGN_HALT: OctagonX,
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800",
  halted: "bg-slate-200 text-slate-700",
  lifecycle_updated: "bg-red-100 text-red-800",
  converted: "bg-amber-100 text-amber-800",
};

export default function Campaigns() {
  const utils = trpc.useUtils();
  const { data } = trpc.campaigns.overview.useQuery();
  const { data: dispatches } = trpc.campaigns.dispatches.useQuery();

  const toggle = trpc.campaigns.toggleRule.useMutation({
    onSuccess: () => {
      utils.campaigns.overview.invalidate();
      utils.analytics.dashboard.invalidate();
      toast.success("Rule toggled — campaigns.rule_toggled");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        title="Campaigns & Automation"
        sub="Policy engine — whenever an event arrives, armed rules evaluate conditions and dispatch actions"
      />

      <div className="space-y-6">
        {data?.campaigns.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <Badge className={c.status === "active" ? "bg-emerald-100 text-emerald-800" : ""}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {c.rules.map((r) => {
                  const Icon = ACTION_ICON[r.action] ?? Zap;
                  return (
                    <div key={r.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold">{r.ruleCode}</span>
                        <Switch
                          checked={r.active}
                          onCheckedChange={(active) => toggle.mutate({ ruleId: r.id, active })}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-mono">{r.triggerEvent}</span>
                        <span>→</span>
                        <span>{r.action}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.conditionSummary}</p>
                      <p className="text-xs">
                        <span className="font-semibold">{r.dispatchCount}</span>{" "}
                        <span className="text-muted-foreground">dispatches</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dispatch Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Roaster</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.ruleCode}</TableCell>
                    <TableCell className="text-xs capitalize">{d.channel}</TableCell>
                    <TableCell className="text-xs">{d.roasterName}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={d.subject}>{d.subject}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${STATUS_STYLE[d.status] ?? ""}`}>{d.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {dispatches?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No dispatches yet — deliver a sample kit to fire COF-001.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
