import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCentsPerLb } from "@contracts/constants";
import { Plus, Archive, DollarSign } from "lucide-react";
import { toast } from "sonner";

function cupScoreBadge(score: number) {
  if (score >= 88) return "bg-[#16382a] text-white";
  if (score >= 85) return "bg-[#2f6b4a] text-white";
  if (score >= 83) return "bg-[#d9a441] text-[#16382a]";
  return "bg-muted text-foreground";
}

export default function Catalog() {
  const utils = trpc.useUtils();
  const { data: lots } = trpc.catalog.list.useQuery();
  const [open, setOpen] = useState(false);
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

  return (
    <Layout>
      <PageHeader
        title="Green Coffee Catalog"
        sub="Lots, SCA cup scores, spot inventory — money stored as integer cents"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Register lot</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>RegisterLot</DialogTitle></DialogHeader>
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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lots?.map((lot) => (
          <Card key={lot.id} className={lot.status === "retired" ? "opacity-55" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">{lot.name}</CardTitle>
                <Badge className={cupScoreBadge(lot.cupScore)}>{lot.cupScore.toFixed(1)} SCA</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {lot.region} · {lot.origin} · {lot.elevationMeters} m
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{lot.processMethod}</Badge>
                <Badge variant="outline">{lot.varietal}</Badge>
                {lot.status === "retired" && <Badge variant="destructive">retired</Badge>}
              </div>
              <p className="text-xs italic text-muted-foreground">{lot.flavorNotes}</p>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-primary">{formatCentsPerLb(lot.pricePerLbCents)}</span>
                <span className={lot.availableLbs < 500 ? "text-destructive font-medium" : ""}>
                  {lot.availableLbs.toLocaleString()} lbs spot
                </span>
              </div>
              <div className="h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (lot.availableLbs / Math.max(1, lot.totalProductionLbs)) * 100)}%` }}
                />
              </div>
              {lot.status === "active" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPriceLot({ id: lot.id, price: lot.pricePerLbCents / 100, name: lot.name })}
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" /> Price
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => retire.mutate({ lotId: lot.id })}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Retire
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!priceLot} onOpenChange={(o) => !o && setPriceLot(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>UpdateLotPricing — {priceLot?.name}</DialogTitle></DialogHeader>
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
