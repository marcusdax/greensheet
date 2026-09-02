import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
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
import { FlaskConical, Archive, Plus, Skull } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_STATUS: Record<string, string> = {
  sealed: "bg-emerald-100 text-emerald-800",
  opened: "bg-amber-100 text-amber-800",
  destroyed: "bg-slate-200 text-slate-700",
  lost: "bg-red-100 text-red-800",
};

const VERDICT_STYLE: Record<string, string> = {
  within_tolerance: "bg-emerald-100 text-emerald-800",
  outside_tolerance: "bg-orange-100 text-orange-800",
  red_flag: "bg-red-100 text-red-800",
};

const RED_FLAGS = [
  "musty_moldy",
  "sour_vinegary",
  "phenolic_medicinal",
  "visible_mold",
  "gray_blue_discoloration",
  "insect_damage_over_2pct",
  "rancid_stale",
] as const;

const ATTRIBUTES = [
  ["fragrance", "Fragrance / Aroma"],
  ["flavor", "Flavor"],
  ["aftertaste", "Aftertaste"],
  ["acidity", "Acidity"],
  ["body", "Body"],
  ["balance", "Balance"],
  ["uniformity", "Uniformity"],
  ["cleanliness", "Clean Cup"],
  ["sweetness", "Sweetness"],
  ["overall", "Overall"],
] as const;

export default function QcLab() {
  const utils = trpc.useUtils();
  const { data: samples } = trpc.qc.samples.useQuery();
  const { data: cuppings } = trpc.qc.cuppings.useQuery();
  const invalidate = () => {
    utils.qc.samples.invalidate();
    utils.qc.cuppings.invalidate();
  };

  return (
    <Layout>
      <PageHeader
        kicker="Folio 03 — The Proof"
        title="QC Lab"
        sub="Retained samples & CQI cupping standards — integrity trail from pull to destruction"
        actions={
          <div className="flex gap-2">
            <PullSampleDialog onDone={invalidate} />
            <CuppingDialog onDone={invalidate} />
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4" /> Retained Samples
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot code</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(samples ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.lotCode}</TableCell>
                    <TableCell className="text-sm">{s.bagPosition}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={SAMPLE_STATUS[s.status]}>{s.status}</Badge>
                        {s.hasActiveException && (
                          <Badge className="bg-red-100 text-red-800">exception</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-sm ${s.openedCount > 5 ? "text-red-600 font-semibold" : ""}`}>
                      {s.openedCount}×{s.openedCount > 5 && " compromised"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.destructionEligibleAt ? new Date(s.destructionEligibleAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(s.status === "sealed" || s.status === "opened") && (
                        <div className="flex justify-end gap-1">
                          <AccessDialog sampleId={s.id} onDone={invalidate} />
                          <DestroyDialog
                            sampleId={s.id}
                            blocked={s.hasActiveException}
                            onDone={invalidate}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(samples ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No retained samples yet — pull one from the next receiving run.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" /> Cupping Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Δ Ref</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Panel</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cuppings ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.lotCode}</TableCell>
                    <TableCell className="font-semibold">{c.totalScore.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">
                      {c.deltaVsReference != null ? `${c.deltaVsReference > 0 ? "+" : ""}${c.deltaVsReference.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {c.verdict ? (
                        <Badge className={VERDICT_STYLE[c.verdict]}>{c.verdict.replaceAll("_", " ")}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.isPanel ? "3-cupper" : "single"}</TableCell>
                    <TableCell className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {(cuppings ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No cupping sessions recorded.
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

function PullSampleDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [lotCode, setLotCode] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [pulledBy, setPulledBy] = useState("");
  const [storageLocation, setStorageLocation] = useState("Cabinet A");
  const { data: options } = trpc.qc.referenceOptions.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();
  const [lotId, setLotId] = useState<string>("");

  const pull = trpc.qc.pullSample.useMutation({
    onSuccess: (r) => {
      toast.success(`Sample #${r.id} pulled & sealed — destruction eligible ${new Date(r.destructionEligibleAt).toLocaleDateString()}`);
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Pull sample
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pull retained sample (middle bag, tamper-evident)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Catalog lot</Label>
            <Select
              value={lotId}
              onValueChange={(v) => {
                setLotId(v);
                const opt = (options ?? []).find((o) => o.lotCode === `LOT-${v}`);
                if (opt) setLotCode(opt.lotCode);
                const lot = (lots ?? []).find((l) => String(l.id) === v);
                if (lot) setLotCode(`LOT-${lot.id}`);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Link lot" />
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
            <Label>Lot code</Label>
            <Input value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder="LOT-1 or VN-26-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Container #</Label>
              <Input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} />
            </div>
            <div>
              <Label>Storage location</Label>
              <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Pulled by (dual verification at pull time)</Label>
            <Input value={pulledBy} onChange={(e) => setPulledBy(e.target.value)} />
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={pull.isPending || !lotCode.trim() || !pulledBy.trim()}
            onClick={() =>
              pull.mutate({
                lotId: lotId ? Number(lotId) : undefined,
                lotCode,
                containerNumber,
                bagPosition: "middle",
                pulledBy,
                storageLocation,
              })
            }
          >
            Pull & seal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessDialog({ sampleId, onDone }: { sampleId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [accessedBy, setAccessedBy] = useState("");
  const [purpose, setPurpose] = useState("");
  const [grams, setGrams] = useState("30");

  const log = trpc.qc.logAccess.useMutation({
    onSuccess: (r) => {
      toast.success(`Access logged — opened ${r.openedCount}×${r.heavilyCompromised ? " · HEAVILY COMPROMISED" : ""}`);
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          Open
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log sample access</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Accessed by</Label>
            <Input value={accessedBy} onChange={(e) => setAccessedBy(e.target.value)} />
          </div>
          <div>
            <Label>Purpose</Label>
            <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Cupping for exception #12…" />
          </div>
          <div>
            <Label>Quantity (g)</Label>
            <Input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={log.isPending || !accessedBy.trim() || !purpose.trim()}
            onClick={() => log.mutate({ sampleId, accessedBy, purpose, quantityGrams: Number(grams) || 0 })}
          >
            Log access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DestroyDialog({ sampleId, blocked, onDone }: { sampleId: number; blocked: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"shredded" | "incinerated" | "donated">("shredded");
  const [witness1, setWitness1] = useState("");
  const [witness2, setWitness2] = useState("");

  const destroy = trpc.qc.destroySample.useMutation({
    onSuccess: () => {
      toast.success("Sample destroyed under dual-witness protocol");
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={blocked} title={blocked ? "Blocked — active exception on this lot" : ""}>
          <Skull className="h-3 w-3 mr-1" /> Destroy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dual-witness destruction</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shredded">Shredded</SelectItem>
                <SelectItem value="incinerated">Incinerated</SelectItem>
                <SelectItem value="donated">Donated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Witness 1</Label>
            <Input value={witness1} onChange={(e) => setWitness1(e.target.value)} />
          </div>
          <div>
            <Label>Witness 2 (must differ)</Label>
            <Input value={witness2} onChange={(e) => setWitness2(e.target.value)} />
          </div>
          <Button
            variant="destructive"
            className="w-full"
            disabled={destroy.isPending || !witness1.trim() || !witness2.trim() || witness1 === witness2}
            onClick={() => destroy.mutate({ sampleId, method, witness1, witness2 })}
          >
            Destroy sample
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CuppingDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [lotCode, setLotCode] = useState("");
  const [cuppers, setCuppers] = useState("");
  const [isPanel, setIsPanel] = useState(false);
  const [referenceScore, setReferenceScore] = useState("");
  const [exceptionTier, setExceptionTier] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(ATTRIBUTES.map(([k]) => [k, k === "overall" ? "8.00" : "8.00"])),
  );
  const [flags, setFlags] = useState<string[]>([]);
  const { data: options } = trpc.qc.referenceOptions.useQuery();

  const record = trpc.qc.recordCupping.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Cupping recorded — total ${r.totalScore.toFixed(2)}${r.verdict ? ` · ${r.verdict.replaceAll("_", " ")}` : ""}${r.verdict === "red_flag" ? " · ESCALATED TO TIER-3 REVIEW" : ""}`,
      );
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const total = ATTRIBUTES.reduce((s, [k]) => s + (Number(scores[k]) || 0), 0);

  const submit = () => {
    record.mutate({
      lotCode,
      isPanel,
      cuppers,
      fragrance: Number(scores.fragrance),
      flavor: Number(scores.flavor),
      aftertaste: Number(scores.aftertaste),
      acidity: Number(scores.acidity),
      body: Number(scores.body),
      balance: Number(scores.balance),
      uniformity: Number(scores.uniformity),
      cleanliness: Number(scores.cleanliness),
      sweetness: Number(scores.sweetness),
      overall: Number(scores.overall),
      referenceScore: referenceScore ? Number(referenceScore) : undefined,
      exceptionTier: exceptionTier === "none" ? undefined : (Number(exceptionTier) as 1 | 2 | 3),
      redFlags: flags as (typeof RED_FLAGS)[number][],
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#16382a] hover:bg-[#1f4a38]">
          <FlaskConical className="h-4 w-4 mr-1" /> Record cupping
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CQI 10-Attribute Scorecard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Lot</Label>
              <Select
                value={lotCode}
                onValueChange={(v) => {
                  setLotCode(v);
                  const opt = (options ?? []).find((o) => o.lotCode === v);
                  if (opt?.cupScore) setReferenceScore(String(opt.cupScore));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Reference lot" />
                </SelectTrigger>
                <SelectContent>
                  {(options ?? []).map((o) => (
                    <SelectItem key={o.lotCode} value={o.lotCode}>
                      {o.name} ({o.cupScore})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cuppers</Label>
              <Input value={cuppers} onChange={(e) => setCuppers(e.target.value)} placeholder="A. Quesada, R. Ito…" />
            </div>
            <div>
              <Label>Reference score</Label>
              <Input type="number" step="0.25" value={referenceScore} onChange={(e) => setReferenceScore(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPanel} onCheckedChange={(c) => setIsPanel(c === true)} />
              3-cupper panel (mandatory for Tier 2/3)
            </label>
            <div className="flex items-center gap-2">
              <Label>Exception tier</Label>
              <Select value={exceptionTier} onValueChange={setExceptionTier}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="1">Tier 1 (±2.0)</SelectItem>
                  <SelectItem value="2">Tier 2 (±1.5)</SelectItem>
                  <SelectItem value="3">Tier 3 (±1.0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm">
              Total: <span className="font-bold">{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {ATTRIBUTES.map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step="0.25"
                  min={key === "overall" ? 0 : 6}
                  max={10}
                  value={scores[key]}
                  onChange={(e) => setScores((s) => ({ ...s, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Red flags (any flag → automatic Tier-3 escalation)</Label>
            <div className="grid grid-cols-4 gap-2">
              {RED_FLAGS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={flags.includes(f)}
                    onCheckedChange={(c) =>
                      setFlags((cur) => (c === true ? [...cur, f] : cur.filter((x) => x !== f)))
                    }
                  />
                  {f.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={record.isPending || !lotCode || !cuppers.trim()}
            onClick={submit}
          >
            Record session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
