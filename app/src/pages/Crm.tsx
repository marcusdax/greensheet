import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, LIFECYCLE_STAGES } from "@contracts/constants";
import { Plus, RefreshCw, PhoneCall, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const STAGE_STYLE: Record<string, string> = {
  trial: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  dormant: "bg-slate-200 text-slate-700",
  needs_attention: "bg-red-100 text-red-800",
  churned: "bg-slate-800 text-white",
};

export default function Crm() {
  const utils = trpc.useUtils();
  const { data: rows } = trpc.crm.list.useQuery();
  const [open, setOpen] = useState(false);
  const invalidate = () => utils.crm.list.invalidate();

  const register = trpc.crm.register.useMutation({
    onSuccess: () => { invalidate(); setOpen(false); toast.success("Roaster registered — crm.roaster_registered"); },
    onError: (e) => toast.error(e.message),
  });
  const setLifecycle = trpc.crm.setLifecycle.useMutation({
    onSuccess: () => { invalidate(); toast.success("Lifecycle updated"); },
    onError: (e) => toast.error(e.message),
  });
  const startIntervention = trpc.crm.startIntervention.useMutation({
    onSuccess: () => { invalidate(); toast.success("Intervention started"); },
    onError: (e) => toast.error(e.message),
  });
  const resolve = trpc.crm.resolveIntervention.useMutation({
    onSuccess: () => { invalidate(); utils.analytics.dashboard.invalidate(); toast.success("Intervention resolved"); },
    onError: (e) => toast.error(e.message),
  });
  const setWhatsapp = trpc.crm.setWhatsapp.useMutation({
    onSuccess: () => { invalidate(); toast.success("WhatsApp number saved"); },
    onError: (e) => toast.error(e.message),
  });
  const rescore = trpc.crm.rescoreChurn.useMutation({
    onSuccess: (r) => { invalidate(); utils.analytics.dashboard.invalidate(); toast.success(`Re-scored — ${r.flagged} crossed the 0.70 threshold`); },
    onError: (e) => toast.error(e.message),
  });

  const onRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    register.mutate({
      roasterName: String(f.get("roasterName")),
      contactName: String(f.get("contactName")),
      email: String(f.get("email")),
      companySize: String(f.get("companySize")) as "micro" | "small" | "medium" | "large",
      segment: String(f.get("segment")),
      referralCode: String(f.get("referralCode") ?? "") || undefined,
    });
  };

  return (
    <Layout>
      <PageHeader
        title="CRM — Roaster Accounts"
        sub="Lifecycle stages, LTV/CAC economics, churn hazard scores"
        actions={
          <>
            <Button variant="outline" onClick={() => rescore.mutate()} disabled={rescore.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Re-score churn
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Register roaster</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>RegisterRoaster</DialogTitle></DialogHeader>
                <form onSubmit={onRegister} className="space-y-3">
                  <div><Label>Roastery name</Label><Input name="roasterName" required placeholder="Blue Lantern Coffee Roasters" /></div>
                  <div><Label>Contact person</Label><Input name="contactName" required /></div>
                  <div><Label>Email</Label><Input name="email" type="email" required /></div>
                  <div>
                    <Label>Company size</Label>
                    <Select name="companySize" defaultValue="small">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["micro", "small", "medium", "large"].map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Segment</Label><Input name="segment" defaultValue="specialty_micro" /></div>
                  <div><Label>Referral code (optional)</Label><Input name="referralCode" placeholder="GIVEKIT-…" /></div>
                  <Button className="w-full" type="submit" disabled={register.isPending}>Register</Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roaster</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead className="w-40">Churn risk</TableHead>
                <TableHead>LTV</TableHead>
                <TableHead>CAC</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.roasterName}</div>
                    <div className="text-xs text-muted-foreground">{r.contactName} · {r.email}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {r.nurtureHalted && <Badge variant="outline" className="text-[10px]">nurture halted (COF-005)</Badge>}
                      {r.whatsappNumber ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">
                          <MessageCircle className="h-2.5 w-2.5 mr-0.5" /> {r.whatsappNumber}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground"
                          onClick={() => {
                            const num = window.prompt(`WhatsApp number for ${r.roasterName} (E.164, e.g. +15551234567)`);
                            if (num) setWhatsapp.mutate({ roasterId: r.id, whatsappNumber: num.trim() });
                          }}
                        >
                          <MessageCircle className="h-2.5 w-2.5 mr-0.5" /> add WhatsApp
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{r.segment}<br /><span className="text-muted-foreground capitalize">{r.companySize}</span></TableCell>
                  <TableCell>
                    <Select
                      value={r.lifecycleStatus}
                      onValueChange={(v) => setLifecycle.mutate({ roasterId: r.id, stage: v as (typeof LIFECYCLE_STAGES)[number] })}
                    >
                      <SelectTrigger className={`h-7 text-xs w-36 ${STAGE_STYLE[r.lifecycleStatus]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIFECYCLE_STAGES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.churnRiskScore * 100} className={`h-2 flex-1 ${r.churnRiskScore >= 0.7 ? "[&>div]:bg-destructive" : ""}`} />
                      <span className="text-xs w-8">{r.churnRiskScore.toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatCents(r.ltvCents)}</TableCell>
                  <TableCell className="text-sm">{formatCents(r.cacCents)}</TableCell>
                  <TableCell className="text-sm">{r.orderCount}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => startIntervention.mutate({ roasterId: r.id, interventionType: "sales_call", reason: "Manual CSM outreach" })}
                      >
                        <PhoneCall className="h-3 w-3 mr-1" /> Intervene
                      </Button>
                      {r.interventions.filter((i) => i.outcome === "pending").map((i) => (
                        <span key={i.id} className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Mark retained"
                            onClick={() => resolve.mutate({ interventionId: i.id, outcome: "retained" })}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Mark churned"
                            onClick={() => resolve.mutate({ interventionId: i.id, outcome: "churned" })}>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}
