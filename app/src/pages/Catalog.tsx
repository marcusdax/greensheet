import { useMemo, useState } from "react";
import { Search, Plus, Archive, Download } from "lucide-react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CupScoreBadge } from "@/components/ui/cup-score-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCentsPerLb } from "@contracts/constants";
import { toast } from "sonner";

export default function Catalog() {
  const utils = trpc.useUtils();
  const { data: lots } = trpc.catalog.list.useQuery();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [process, setProcess] = useState("all");
  const [minCup, setMinCup] = useState("all");
  const [priceLot, setPriceLot] = useState<{ id: number; price: number; name: string } | null>(null);

  const register = trpc.catalog.register.useMutation({
    onSuccess: () => {
      utils.catalog.list.invalidate();
      setOpen(false);
      toast.success("Lot registered — catalog.lot_registered emitted");
    },
    onError: (e) => toast.error(e.message),
  });
  const adjust = trpc.catalog.adjustPrice.useMutation({
    onSuccess: () => {
      utils.catalog.list.invalidate();
      setPriceLot(null);
      toast.success("Price updated — catalog.price_changed emitted");
    },
    onError: (e) => toast.error(e.message),
  });
  const retire = trpc.catalog.retire.useMutation({
    onSuccess: () => {
      utils.catalog.list.invalidate();
      toast.success("Lot retired — catalog.lot_retired emitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const onRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    register.mutate({
      name: String(f.get("name")),
      origin: String(f.get("origin")),
      region: String(f.get("region")),
      varietal: String(f.get("varietal")),
      processMethod: String(f.get("processMethod")),
      elevationMeters: Number(f.get("elevationMeters")),
      cupScore: Number(f.get("cupScore")),
      pricePerLbCents: Math.round(Number(f.get("price")) * 100),
      costPerLbCents: Math.round(Number(f.get("cost")) * 100),
      availableLbs: Number(f.get("availableLbs")),
      totalProductionLbs: Number(f.get("totalProductionLbs")),
      flavorNotes: String(f.get("flavorNotes") ?? ""),
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lots ?? [])
      .filter((l) => (process === "all" ? true : l.processMethod === process))
      .filter((l) => (minCup === "all" ? true : l.cupScore >= Number(minCup)))
      .filter((l) =>
        q ? `${l.name} ${l.origin} ${l.region} ${l.flavorNotes ?? ""}`.toLowerCase().includes(q) : true,
      );
  }, [lots, query, process, minCup]);

  const processes = useMemo(
    () => Array.from(new Set((lots ?? []).map((l) => l.processMethod))).sort(),
    [lots],
  );

  const exportCsv = () => {
    const rows = [
      ["lot", "name", "origin", "region", "process", "cup", "price_per_lb_$", "cost_per_lb_$", "available_lbs", "total_lbs", "status"],
      ...filtered.map((l) => [
        String(l.id),
        l.name,
        l.origin,
        l.region,
        l.processMethod,
        l.cupScore.toFixed(1),
        (l.pricePerLbCents / 100).toFixed(2),
        (l.costPerLbCents / 100).toFixed(2),
        String(l.availableLbs),
        String(l.totalProductionLbs),
        l.status,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auctum-catalog.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <PageHeader
        title="Green Coffee Catalog"
        overline="Auctum · Source"
        sub="Lots, SCA cup scores, spot inventory — money stored as integer cents"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Register lot</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto border-border/80">
              <DialogHeader><DialogTitle className="font-display text-xl">Register a lot</DialogTitle></DialogHeader>
              <form onSubmit={onRegister} className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Lot name</Label><Input name="name" required placeholder="Yirgacheffe G1 — Kochere" /></div>
                <div><Label>Origin</Label><Input name="origin" required placeholder="Ethiopia" /></div>
                <div><Label>Region</Label><Input name="region" required placeholder="Gedeo Zone" /></div>
                <div><Label>Varietal</Label><Input name="varietal" required placeholder="Heirloom" /></div>
                <div><Label>Process</Label><Input name="processMethod" required placeholder="Washed" /></div>
                <div><Label>Elevation (m)</Label><Input name="elevationMeters" type="number" required defaultValue={1800} /></div>
                <div><Label>SCA cup score</Label><Input name="cupScore" type="number" step="0.25" required defaultValue={85} /></div>
                <div><Label>Price $/lb</Label><Input name="price" type="number" step="0.01" required defaultValue={5.5} /></div>
                <div><Label>Cost $/lb</Label><Input name="cost" type="number" step="0.01" required defaultValue={3.2} /></div>
                <div><Label>Available (lbs)</Label><Input name="availableLbs" type="number" required defaultValue={3000} /></div>
                <div><Label>Total production (lbs)</Label><Input name="totalProductionLbs" type="number" required defaultValue={6000} /></div>
                <div className="col-span-2"><Label>Flavor notes</Label><Input name="flavorNotes" placeholder="Jasmine, bergamot, peach" /></div>
                <Button className="col-span-2" type="submit" disabled={register.isPending}>
                  {register.isPending ? "Registering…" : "Register lot"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lots, origins, regions…"
            className="h-10 w-full rounded-md border border-neutral-300 bg-background pl-9 pr-3 text-sm text-ink outline-none focus-visible:border-oxblood focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-1"
          />
        </div>
        <select
          value={process}
          onChange={(e) => setProcess(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 bg-background px-3 text-sm text-ink outline-none focus-visible:border-oxblood"
          aria-label="Filter by process"
        >
          <option value="all">Any process</option>
          {processes.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={minCup}
          onChange={(e) => setMinCup(e.target.value)}
          className="h-10 rounded-md border border-neutral-300 bg-background px-3 text-sm text-ink outline-none focus-visible:border-oxblood"
          aria-label="Minimum cup score"
        >
          <option value="all">Any cup score</option>
          {[86, 88, 90].map((v) => <option key={v} value={v}>{v === 90 ? "90+" : `${v}+`}</option>)}
        </select>
        <Button variant="outline" onClick={exportCsv} title="Export filtered rows as CSV">
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <p className="mb-3 text-caption text-muted-foreground" aria-live="polite">
        {filtered.length} lot{filtered.length === 1 ? "" : "s"} on this ledger page.
      </p>

      <div className="overflow-hidden rounded-lg border border-border/80 bg-surface shadow-e1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead className="hidden lg:table-cell">Process</TableHead>
              <TableHead className="text-right">Cup</TableHead>
              <TableHead className="text-right">$/lb</TableHead>
              <TableHead className="hidden md:table-cell text-right">Margin</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="hidden xl:table-cell">Status</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((lot, i) => {
              const margin = lot.pricePerLbCents - lot.costPerLbCents;
              return (
                <TableRow key={lot.id} className={lot.status === "retired" ? "opacity-55" : ""}>
                  <TableCell className="font-mono tabular-nums text-muted">{i + 1}</TableCell>
                  <TableCell>
                    <span className="font-medium text-ink">
                      {lot.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{lot.region}</span>
                  </TableCell>
                  <TableCell className="text-muted">{lot.origin}</TableCell>
                  <TableCell className="hidden lg:table-cell"><Badge variant="outline">{lot.processMethod}</Badge></TableCell>
                  <TableCell className="text-right"><CupScoreBadge score={lot.cupScore} /></TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums text-ink">
                    {formatCentsPerLb(lot.pricePerLbCents)}
                  </TableCell>
                  <TableCell className={`hidden md:table-cell text-right font-mono tabular-nums ${margin < 0 ? "text-danger" : "text-sage"}`}>
                    {margin < 0 ? "▲" : ""}{formatCentsPerLb(margin)}
                  </TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${lot.availableLbs < 500 ? "text-danger" : "text-muted"}`}>
                    {lot.availableLbs.toLocaleString()}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {lot.status === "retired" ? <Badge variant="danger">Retired</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {lot.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setPriceLot({ id: lot.id, price: lot.pricePerLbCents / 100, name: lot.name })}>
                            Price
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => retire.mutate({ lotId: lot.id })}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!priceLot} onOpenChange={(o) => !o && setPriceLot(null)}>
        <DialogContent className="max-w-sm border-border/80">
          <DialogHeader><DialogTitle className="font-display text-xl">Update pricing — {priceLot?.name}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (priceLot)
                adjust.mutate({
                  lotId: priceLot.id,
                  newPriceCents: Math.round(Number(f.get("price")) * 100),
                  reason: String(f.get("reason")),
                });
            }}
            className="space-y-3"
          >
            <div><Label>New price $/lb</Label><Input name="price" type="number" step="0.01" defaultValue={priceLot?.price} required /></div>
            <div><Label>Reason</Label><Input name="reason" required placeholder="C-market rally / clearance" /></div>
            <p className="text-xs text-muted-foreground">Pricing below cost is legal (clearance) but emits catalog.margin_floor_breached.</p>
            <Button type="submit" className="w-full" disabled={adjust.isPending}>Update price</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}