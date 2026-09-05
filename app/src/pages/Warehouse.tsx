import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader, money } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Clock, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";

const TIER_STYLE: Record<number, string> = {
  1: "bg-amber-100 text-amber-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-red-100 text-red-800",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  hard_hold: "bg-red-100 text-red-800",
  quarantine: "bg-orange-100 text-orange-800",
  investigating: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
};

const NEXT_STATUSES = ["open", "hard_hold", "quarantine", "investigating"] as const;

export default function Warehouse() {
  const utils = trpc.useUtils();
  const { data: exceptions } = trpc.warehouse.list.useQuery();
  const { data: report } = trpc.warehouse.dailyReport.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();
  const [open, setOpen] = useState(false);

  // Wizard state
  const [kind, setKind] = useState<"seal" | "weight_moisture">("seal");
  const [sealIntact, setSealIntact] = useState(true);
  const [serialMatches, setSerialMatches] = useState(true);
  const [originPhotosMatch, setOriginPhotosMatch] = useState(true);
  const [expectedLbs, setExpectedLbs] = useState("0");
  const [receivedLbs, setReceivedLbs] = useState("0");
  const [moisturePct, setMoisturePct] = useState("11.5");
  const [lotId, setLotId] = useState<string>("");
  const [containerNumber, setContainerNumber] = useState("");
  const [description, setDescription] = useState("");

  const classifyInput =
    kind === "seal"
      ? { kind, sealIntact, serialMatches, originPhotosMatch }
      : {
          kind,
          expectedLbs: Number(expectedLbs) || 0,
          receivedLbs: Number(receivedLbs) || 0,
          moisturePct: Number(moisturePct) || 0,
        };
  const { data: preview } = trpc.warehouse.classify.useQuery(classifyInput);

  const invalidate = () => {
    utils.warehouse.list.invalidate();
    utils.warehouse.dailyReport.invalidate();
  };

  const create = trpc.warehouse.create.useMutation({
    onSuccess: (r) => {
      invalidate();
      setOpen(false);
      setDescription("");
      toast.success(`Exception #${r.id} opened — status ${r.status}, SLA due ${new Date(r.slaDueAt).toLocaleString()}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const advance = trpc.warehouse.advance.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const resolve = trpc.warehouse.resolve.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Exception closed with disposition");
    },
    onError: (e) => toast.error(e.message),
  });

  const submitCreate = () => {
    if (!preview || preview.tier === 0) {
      toast.error("Classification is PASS — no exception to open");
      return;
    }
    if (!description.trim()) {
      toast.error("Description required");
      return;
    }
    create.mutate({
      lotId: lotId ? Number(lotId) : undefined,
      containerNumber,
      exceptionType: kind === "seal" ? "seal_compromise" : "weight_moisture_variance",
      tier: preview.tier as 1 | 2 | 3,
      description,
      actor: "warehouse-ui",
    });
  };

  return (
    <Layout>
      <PageHeader
        title="Warehouse Exceptions"
        sub="Seal, weight & moisture runbooks — tiers, SLAs, dispositions"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#16382a] hover:bg-[#1f4a38]">
                <Plus className="h-4 w-4 mr-1" /> New Exception
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Receiving Classification Wizard</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant={kind === "seal" ? "default" : "outline"} onClick={() => setKind("seal")}>
                    Seal check
                  </Button>
                  <Button
                    variant={kind === "weight_moisture" ? "default" : "outline"}
                    onClick={() => setKind("weight_moisture")}
                  >
                    Weight & moisture
                  </Button>
                </div>

                {kind === "seal" ? (
                  <div className="space-y-3 rounded-md border p-4">
                    {[
                      ["Seal physically intact", sealIntact, setSealIntact],
                      ["Seal serial matches documentation", serialMatches, setSerialMatches],
                      ["Origin photos match", originPhotosMatch, setOriginPhotosMatch],
                    ].map(([label, val, set]) => (
                      <label key={label as string} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={val as boolean} onCheckedChange={(c) => (set as (b: boolean) => void)(c === true)} />
                        {label as string}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 rounded-md border p-4">
                    <div>
                      <Label>Expected lbs</Label>
                      <Input type="number" value={expectedLbs} onChange={(e) => setExpectedLbs(e.target.value)} />
                    </div>
                    <div>
                      <Label>Received lbs</Label>
                      <Input type="number" value={receivedLbs} onChange={(e) => setReceivedLbs(e.target.value)} />
                    </div>
                    <div>
                      <Label>Moisture %</Label>
                      <Input type="number" step="0.1" value={moisturePct} onChange={(e) => setMoisturePct(e.target.value)} />
                    </div>
                    <p className="col-span-3 text-xs text-muted-foreground">
                      Tolerance ±1.5% · hard limit ±2.0% · moisture spec 11.0–12.5% (extreme &lt;10% or &gt;13%)
                    </p>
                  </div>
                )}

                {preview && (
                  <div
                    className={`rounded-md p-3 text-sm font-medium ${
                      preview.tier === 0
                        ? "bg-emerald-50 text-emerald-800"
                        : preview.tier === 3
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {preview.tier === 0 ? (
                      "PASS — lot meets spec, release to inventory"
                    ) : (
                      <>
                        <ShieldAlert className="inline h-4 w-4 mr-1" />
                        Tier {preview.tier} exception — {preview.label}
                        {preview.tier >= 2 && " · starts in HARD HOLD"}
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Lot (optional)</Label>
                    <Select value={lotId} onValueChange={setLotId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Link a catalog lot" />
                      </SelectTrigger>
                      <SelectContent>
                        {(lots ?? []).map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Container #</Label>
                    <Input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Findings, photos taken, parties notified…" />
                </div>
                <Button onClick={submitCreate} disabled={create.isPending || !preview || preview.tier === 0} className="w-full bg-[#16382a] hover:bg-[#1f4a38]">
                  Open exception
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {report && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Opened today</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              T1 {report.openedToday.tier1} · T2 {report.openedToday.tier2} · T3 {report.openedToday.tier3}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Closed today</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              T1 {report.closedToday.tier1} · T2 {report.closedToday.tier2} · T3 {report.closedToday.tier3}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> On hold
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{report.onHold.length}</CardContent>
          </Card>
          <Card className={report.overdue.length > 0 ? "border-red-300" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> SLA overdue
              </CardTitle>
            </CardHeader>
            <CardContent className={`text-2xl font-bold ${report.overdue.length > 0 ? "text-red-600" : ""}`}>
              {report.overdue.length}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SLA due</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Financial</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(exceptions ?? []).map((ex) => {
                const overdue = ex.slaDueAt && new Date(ex.slaDueAt) < new Date() && !["resolved", "closed"].includes(ex.status);
                return (
                  <TableRow key={ex.id}>
                    <TableCell className="font-mono text-xs">{ex.id}</TableCell>
                    <TableCell className="text-sm">{ex.exceptionType.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      <Badge className={TIER_STYLE[ex.tier]}>T{ex.tier}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ex.lotName ?? ex.containerNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[ex.status]}>{ex.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className={`text-xs ${overdue ? "text-red-600 font-semibold" : ""}`}>
                      {ex.slaDueAt ? new Date(ex.slaDueAt).toLocaleDateString() : "—"}
                      {overdue && " · OVERDUE"}
                    </TableCell>
                    <TableCell className="text-sm">{ex.disposition?.replaceAll("_", " ") ?? "—"}</TableCell>
                    <TableCell className="text-sm">{money(ex.financialCents)}</TableCell>
                    <TableCell className="text-right">
                      {!["resolved", "closed"].includes(ex.status) && (
                        <div className="flex justify-end gap-1">
                          <Select onValueChange={(s) => advance.mutate({ exceptionId: ex.id, status: s as (typeof NEXT_STATUSES)[number], note: "", actor: "warehouse-ui" })}>
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue placeholder="Move to…" />
                            </SelectTrigger>
                            <SelectContent>
                              {NEXT_STATUSES.filter((s) => s !== ex.status).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replaceAll("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <ResolveDialog ex={ex} onResolve={(v) => resolve.mutate({ exceptionId: ex.id, ...v })} pending={resolve.isPending} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(exceptions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    No exceptions on record — all inbound lots passing spec.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Layout>
  );
}

const FAULT_PARTY_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["supplier", "Supplier"],
  ["carrier", "Carrier"],
  ["customs", "Customs"],
  ["greensheet", "Auctum"],
  ["indeterminate", "Indeterminate"],
];

function ResolveDialog({
  ex,
  onResolve,
  pending,
}: {
  ex: { id: number; tier: number };
  onResolve: (v: {
    disposition: "release" | "downgrade" | "reject_claim" | "reverify_partition";
    rootCause: string;
    atFaultParty: "supplier" | "carrier" | "customs" | "greensheet" | "indeterminate";
    financialCents: number;
    actor: string;
  }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [disposition, setDisposition] = useState<"release" | "downgrade" | "reject_claim" | "reverify_partition">("release");
  const [atFaultParty, setAtFaultParty] = useState<"supplier" | "carrier" | "customs" | "greensheet" | "indeterminate">("indeterminate");
  const [rootCause, setRootCause] = useState("");
  const [financial, setFinancial] = useState("0");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve exception #{ex.id} (Tier {ex.tier})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Disposition</Label>
            <Select value={disposition} onValueChange={(v) => setDisposition(v as typeof disposition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="release">Release</SelectItem>
                <SelectItem value="downgrade">Downgrade & re-price</SelectItem>
                <SelectItem value="reject_claim">Reject & claim</SelectItem>
                <SelectItem value="reverify_partition">Re-verify & partition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>At-fault party</Label>
            <Select value={atFaultParty} onValueChange={(v) => setAtFaultParty(v as typeof atFaultParty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAULT_PARTY_LABELS.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Root cause{ex.tier >= 2 ? " (required for Tier 2/3)" : ""}</Label>
            <Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          </div>
          <div>
            <Label>Financial impact (USD)</Label>
            <Input type="number" step="0.01" value={financial} onChange={(e) => setFinancial(e.target.value)} />
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={pending || (ex.tier >= 2 && !rootCause.trim())}
            onClick={() => {
              onResolve({
                disposition,
                rootCause,
                atFaultParty,
                financialCents: Math.round(Number(financial) * 100) || 0,
                actor: "commercial-ui",
              });
              setOpen(false);
            }}
          >
            Close with disposition
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
