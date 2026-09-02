import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanLine, Upload, Undo2 } from "lucide-react";
import { ScannerSurface } from "@/components/ScannerSurface";
import { ReviewPane, type ReviewField } from "@/components/ReviewPane";
import { toast } from "sonner";

type ExtractField = { value: string | number | null; confidence: number };
type ExtractResponse = {
  doc_type: "lot_offer" | "cmr_shipping";
  fields: Record<string, ExtractField>;
  low_confidence: string[];
  model: string;
};




/**
 * The review form, per document type.
 *
 * `name` must match what the extractor returns AND what FIELD_CRITICALITY in
 * contracts/ocr-schemas.ts keys on — that is how a cup score ends up requiring
 * an explicit human touch here without this file knowing anything about ADR-04.
 */
const LOT_OFFER_FIELDS: { name: string; label: string; type?: string }[] = [
  { name: "name", label: "Lot name" },
  { name: "origin", label: "Origin" },
  { name: "region", label: "Region" },
  { name: "varietal", label: "Varietal" },
  { name: "processMethod", label: "Process" },
  { name: "elevation_meters", label: "Elevation (m)", type: "number" },
  { name: "cupScore", label: "Cup score", type: "number" },
  { name: "unitPrice", label: "Price $/lb", type: "number" },
  { name: "cost_per_lb_usd", label: "Cost $/lb", type: "number" },
  { name: "quantity", label: "Available (lbs)", type: "number" },
  { name: "total_production_lbs", label: "Total production (lbs)", type: "number" },
  { name: "notes", label: "Flavor notes" },
];

const CMR_FIELDS: { name: string; label: string; type?: string }[] = [
  { name: "counterpartyName", label: "Consignor" },
  { name: "consignee", label: "Consignee" },
  { name: "container_number", label: "Container #" },
  { name: "seal_number", label: "Seal #" },
  { name: "quantity", label: "Gross weight (lbs)", type: "number" },
  { name: "shipped_date", label: "Shipped (YYYY-MM-DD)" },
  { name: "arrival_date", label: "Arrived (YYYY-MM-DD)" },
];

/**
 * The extractor speaks snake_case; FIELD_CRITICALITY is keyed on the camelCase
 * domain names. Mapping here rather than renaming either side keeps the OCR
 * service's contract and the gating contract independently versionable.
 */
const EXTRACTOR_ALIAS: Record<string, string> = {
  processMethod: "process_method",
  cupScore: "cup_score",
  unitPrice: "price_per_lb_usd",
  quantity: "available_lbs",
  counterpartyName: "consignor",
  notes: "flavor_notes",
};

function extractorKey(name: string): string {
  return EXTRACTOR_ALIAS[name] ?? name;
}

export default function DocIntake() {
  const utils = trpc.useUtils();
  const [file, setFile] = useState<File | null>(null);
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
    setFile(null);
  }

  function str(field: ExtractField | undefined): string {
    return field?.value != null ? String(field.value) : "";
  }

  async function onExtract() {
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

  const set = (name: string) => (v: string) =>
    setForm((f) => ({ ...f, [extractorKey(name)]: v }));

  const reviewFields: ReviewField[] = (
    result?.doc_type === "cmr_shipping" ? CMR_FIELDS : LOT_OFFER_FIELDS
  ).map((f) => {
    const key = extractorKey(f.name);
    return {
      ...f,
      value: form[key] ?? "",
      confidence: result?.fields[key]?.confidence,
    };
  });

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
            <ScannerSurface
              busy={extracting}
              onFile={(f) => {
                setFile(f);
                setPreviewUrl(f.type === "application/pdf" ? null : URL.createObjectURL(f));
                setResult(null);
              }}
              onClear={reset}
              prompt="Photograph or drop the offer sheet or CMR note"
            />
            <Button onClick={onExtract} disabled={extracting || !file}>
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
            ) : (
              <ReviewPane
                imageUrl={previewUrl}
                fields={reviewFields}
                onChange={(name, value) => set(name)(value)}
                onAccept={result.doc_type === "lot_offer" ? commitLotOffer : commitCmr}
                onReject={reset}
                onReprocess={onExtract}
                acceptLabel={
                  result.doc_type === "lot_offer"
                    ? "Accept & register lot"
                    : "Accept & record intake"
                }
                busy={registerLot.isPending || recordIntake.isPending || extracting}
              />
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
