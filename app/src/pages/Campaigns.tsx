import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Users, OctagonX, Zap } from "lucide-react";
import { toast } from "sonner";

const ACTION_ICON: Record<string, typeof Mail> = {
  SEND_EMAIL: Mail,
  SEND_SMS: MessageSquare,
  UPDATE_CRM_LIFECYCLE: Users,
  EXECUTE_CAMPAIGN_HALT: OctagonX,
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "outline" | "brass"> = {
  sent: "success",
  halted: "danger",
  lifecycle_updated: "warning",
  converted: "brass",
};

function Medallion({
  done,
  children,
  label,
}: {
  done: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border-2 border-neutral-600 transition-colors duration-fast",
          done ? "bg-oxblood text-paper-50 border-oxblood shadow-e1" : "bg-surface text-muted",
        )}
        aria-label={label}
      >
        {children}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{label}</span>
    </div>
  );
}

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
        {data?.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg">{c.name}</CardTitle>
                <Badge variant={c.status === "active" ? "success" : "outline"}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {c.rules.map((r) => {
                  const Icon = ACTION_ICON[r.action] ?? Zap;
                  const fired = r.dispatchCount > 0;
                  return (
                    <div key={r.id} className="rounded-lg border border-border/80 bg-surface p-4 shadow-e1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-ink">{r.ruleCode}</span>
                        <Switch
                          checked={r.active}
                          aria-label={`${r.ruleCode} armed`}
                          onCheckedChange={(active) => toggle.mutate({ ruleCode: r.ruleCode, active })}
                        />
                      </div>
                      <div className="mt-4 flex items-start justify-between gap-3">
                        <Medallion done label="Trigger">
                          <Zap className="h-4 w-4" aria-hidden="true" />
                        </Medallion>
                        <span className="mt-4 h-[3px] flex-1 rounded-full bg-recessed" aria-hidden="true" />
                        <Medallion done={fired} label="Condition">
                          <Users className="h-4 w-4" aria-hidden="true" />
                        </Medallion>
                        <span className="mt-4 h-[3px] flex-1 rounded-full bg-recessed" aria-hidden="true" />
                        <Medallion done={r.active} label="Action">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </Medallion>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{r.triggerEvent}</span>
                        <span aria-hidden="true">→</span>
                        <span>{r.conditionSummary}</span>
                        <span aria-hidden="true">→</span>
                        <span className="font-mono">{r.action}</span>
                      </div>
                      <p className="mt-3 border-t border-border/70 pt-3 text-xs">
                        <span className="font-mono text-sm font-bold tabular-nums text-ink">{r.dispatchCount}</span>{" "}
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
            <CardTitle className="font-display text-lg">Dispatch Ledger</CardTitle>
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
                      <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>{d.status}</Badge>
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
