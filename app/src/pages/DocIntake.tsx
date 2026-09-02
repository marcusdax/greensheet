import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanLine, Upload, Undo2 } from "lucide-react";
import { toast } from "sonner";

type ExtractField = { value: string | number | null; confidence: number };
type ExtractResponse = {
  doc_type: "lot_offer" | "cmr_shipping";
  fields: Record<string, ExtractField>;
  low_confidence: string[];
  model: string;
};

function confidenceChip(confidence: number) {
  const pct = `${Math.round(confidence * 100)}%`;
  if (confidence >= 0.9) return <span className="font-mono text-[11px] rounded px-1.5 py-0.5 bg-[#4F6958] text-white">{pct}</span>;
  if (confidence >= 0.7) return <span className="font-mono text-[11px] rounded px-1.5 py-0.5 bg-[#947642] text-white">{pct}</span>;
  return <span className="font-mono text-[11px] rounded px-1.5 py-0.5 bg-[#B3261E] text-white">{pct}</span>;
}

function FieldInput({
  label,
  field,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  field: ExtractField | undefined;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const confidence = field?.confidence ?? 0;
  const low = confidence < 0.7;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        {field && confidenceChip(confidence)}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={low ? "border-[#B3261E] focus-visible:ring-[#B3261E]" : ""}
      />
    </div>
  );
}

export default function DocIntake() {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<"lot_offer" | "cmr_shipping">("lot_offer");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: intakes } = trpc.warehouse.intakes.useQuery(undefined, {
    enabled: docType === "cmr_shipping" || result?.doc_type === "cmr_shipping",
  });

  const registerLot = trpc.catalog.register.useMutation({
    onSuccess: () => {
      utils.catalog.list.invalidate();
      reset();
      toast.success("Lot registered from document — catalog.lot_registered emitted");
    },
    onError: (e) => toast.error(e.message),
  });
  const recordIntake = trpc.warehouse.recordIntake.useMutation({
    onSuccess: () => {
      utils.warehouse.intakes.invalidate();
      reset();
      toast.success("Shipment intake recorded — warehouse.intake_recorded emitted");
    },
    onError: (e) => toast.error(e.message),
  });

  function reset() {
    setResult(null);
    setForm({});
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function str(field: ExtractField | undefined): string {
    return field?.value != null ? String(field.value) : "";
  }

  async function onExtract() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a photo first");
      return;
    }
    setExtracting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("doc_type", docType);
      const res = await fetch("/api/docintake/extract", {
        method: "POST",
        body,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? json.detail ?? `Extraction failed (${res.status})`);
        return;
      }
      const extraction = json as ExtractResponse;
      setResult(extraction);
      const initial: Record<string, string> = {};
      for (const [name, field] of Object.entries(extraction.fields)) initial[name] = str(field);
      setForm(initial);
      if (extraction.low_confidence.length > 0) {
        toast.warning(`Check the flagged fields: ${extraction.low_confidence.join(", ")}`);
      }
    } catch {
      toast.error("GS-DOC-1006 · could not reach the intake proxy");
    } finally {
      setExtracting(false);
    }
  }

  function commitLotOffer() {
    registerLot.mutate({
      name: form.name ?? "",
      origin: form.origin ?? "",
      region: form.region ?? "",
      varietal: form.varietal ?? "",
      processMethod: form.process_method ?? "",
      elevationMeters: Math.round(Number(form.elevation_meters) || 0),
      cupScore: Number(form.cup_score) || 0,
      pricePerLbCents: Math.round((Number(form.price_per_lb_usd) || 0) * 100),
      costPerLbCents: Math.round((Number(form.cost_per_lb_usd) || 0) * 100),
      availableLbs: Math.round(Number(form.available_lbs) || 0),
      totalProductionLbs: Math.round(Number(form.total_production_lbs) || 0),
      flavorNotes: form.flavor_notes ?? "",
    });
  }

  function commitCmr() {
    recordIntake.mutate({
      lotId: null,
      consignor: form.consignor ?? "",
      consignee: form.consignee ?? "",
      containerNumber: form.container_number ?? "",
      sealNumber: form.seal_number ?? "",
      grossWeightLbs: Math.round(Number(form.gross_weight_lbs) || 0),
      shippedAt: form.shipped_date || null,
      arrivedAt: form.arrival_date || null,
      source: "docintake",
      extractionJson: result ? JSON.stringify(result.fields) : null,
    });
  }

  const set = (name: string) => (v: string) => setForm((f) => ({ ...f, [name]: v }));
  const field = (name: string) => result?.fields[name];

  return (
    <Layout>
      <PageHeader
        title="Doc Intake"
        sub="Photograph an offer sheet or CMR note — extraction drafts the record, a human confirms every field"
      />

      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1 · Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Document type</Label>
              <Select
                value={docType}
                onValueChange={(v) => {
                  setDocType(v as typeof docType);
                  reset();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lot_offer">Supplier offer sheet → Catalog lot</SelectItem>
                  <SelectItem value="cmr_shipping">CMR / shipping doc → Warehouse intake</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Photo (JPEG/PNG/WebP, ≤10 MB — resize phone shots to ≤2000px)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPreviewUrl(f ? URL.createObjectURL(f) : null);
                  setResult(null);
                }}
              />
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="document preview"
                className="max-h-72 rounded-md border border-border object-contain"
              />
            )}
            <Button onClick={onExtract} disabled={extracting}>
              <Upload className="h-4 w-4 mr-1" />
              {extracting ? "Extracting…" : "Extract fields"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Extraction runs on the doc-intake service (claude-opus-5 vision). Confidence is
              model-asserted — nothing commits without your review.
            </p>
          </CardContent>
        </Card>

        <Card className={result ? "" : "opacity-50"}>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2 · Review & commit</CardTitle>
            {result && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Start over
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="py-14 text-center">
                <ScanLine className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Extracted fields appear here for review.</p>
              </div>
            ) : result.doc_type === "lot_offer" ? (
              <div className="space-y-3">
                <FieldInput label="Lot name" field={field("name")} value={form.name ?? ""} onChange={set("name")} />
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Origin" field={field("origin")} value={form.origin ?? ""} onChange={set("origin")} />
                  <FieldInput label="Region" field={field("region")} value={form.region ?? ""} onChange={set("region")} />
                  <FieldInput label="Varietal" field={field("varietal")} value={form.varietal ?? ""} onChange={set("varietal")} />
                  <FieldInput label="Process" field={field("process_method")} value={form.process_method ?? ""} onChange={set("process_method")} />
                  <FieldInput label="Elevation (m)" type="number" field={field("elevation_meters")} value={form.elevation_meters ?? ""} onChange={set("elevation_meters")} />
                  <FieldInput label="Cup score" type="number" field={field("cup_score")} value={form.cup_score ?? ""} onChange={set("cup_score")} />
                  <FieldInput label="Price $/lb" type="number" field={field("price_per_lb_usd")} value={form.price_per_lb_usd ?? ""} onChange={set("price_per_lb_usd")} />
                  <FieldInput label="Cost $/lb" type="number" field={field("cost_per_lb_usd")} value={form.cost_per_lb_usd ?? ""} onChange={set("cost_per_lb_usd")} />
                  <FieldInput label="Available (lbs)" type="number" field={field("available_lbs")} value={form.available_lbs ?? ""} onChange={set("available_lbs")} />
                  <FieldInput label="Total production (lbs)" type="number" field={field("total_production_lbs")} value={form.total_production_lbs ?? ""} onChange={set("total_production_lbs")} />
                </div>
                <FieldInput label="Flavor notes" field={field("flavor_notes")} value={form.flavor_notes ?? ""} onChange={set("flavor_notes")} />
                <Button className="w-full" onClick={commitLotOffer} disabled={registerLot.isPending}>
                  {registerLot.isPending ? "Registering…" : "Confirm & register lot"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Consignor" field={field("consignor")} value={form.consignor ?? ""} onChange={set("consignor")} />
                  <FieldInput label="Consignee" field={field("consignee")} value={form.consignee ?? ""} onChange={set("consignee")} />
                  <FieldInput label="Container #" field={field("container_number")} value={form.container_number ?? ""} onChange={set("container_number")} />
                  <FieldInput label="Seal #" field={field("seal_number")} value={form.seal_number ?? ""} onChange={set("seal_number")} />
                  <FieldInput label="Gross weight (lbs)" type="number" field={field("gross_weight_lbs")} value={form.gross_weight_lbs ?? ""} onChange={set("gross_weight_lbs")} />
                  <FieldInput label="Shipped (YYYY-MM-DD)" field={field("shipped_date")} value={form.shipped_date ?? ""} onChange={set("shipped_date")} />
                  <FieldInput label="Arrived (YYYY-MM-DD)" field={field("arrival_date")} value={form.arrival_date ?? ""} onChange={set("arrival_date")} />
                </div>
                <Button className="w-full" onClick={commitCmr} disabled={recordIntake.isPending}>
                  {recordIntake.isPending ? "Recording…" : "Confirm & record intake"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Weight variance against expectations? Open the Warehouse receiving wizard after
                  recording — Runbook 2 classification lives there.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(docType === "cmr_shipping" || (intakes && intakes.length > 0)) && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recorded intakes</CardTitle>
          </CardHeader>
          <CardContent>
            {!intakes || intakes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No shipment intakes recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Container</TableHead>
                    <TableHead>Seal</TableHead>
                    <TableHead>Consignor → Consignee</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intakes.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.containerNumber || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{i.sealNumber || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {i.consignor || "—"} → {i.consignee || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {i.grossWeightLbs.toLocaleString()} lbs
                      </TableCell>
                      <TableCell>
                        <Badge variant={i.source === "docintake" ? "default" : "outline"}>{i.source}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(i.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
