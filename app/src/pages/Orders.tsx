import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatCents, formatCentsPerLb, FLAT_SHIPPING_CENTS, ORDER_TRANSITIONS, type OrderStatus } from "@contracts/constants";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-slate-200 text-slate-700",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function Orders() {
  const utils = trpc.useUtils();
  const { data: orders } = trpc.orders.list.useQuery();
  const { data: roasters } = trpc.crm.list.useQuery();
  const { data: lots } = trpc.catalog.list.useQuery();

  const [open, setOpen] = useState(false);
  const [roasterId, setRoasterId] = useState("");
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("50");
  const [idemKey, setIdemKey] = useState<string>(() => crypto.randomUUID());

  const invalidate = () => {
    utils.orders.list.invalidate();
    utils.catalog.list.invalidate();
    utils.crm.list.invalidate();
    utils.campaigns.dispatches.invalidate();
    utils.analytics.dashboard.invalidate();
  };

  const create = trpc.orders.create.useMutation({
    onSuccess: (r) => {
      invalidate();
      setIdemKey(crypto.randomUUID());
      const orderNumber = r.order?.orderNumber ?? "order";
      if (r.replayed) {
        toast.info(`Idempotent replay — returned existing ${orderNumber}`);
      } else {
        toast.success(
          r.order?.firstOrder
            ? `${orderNumber} created — first order: COF-005 halted nurture + logged conversion`
            : `${orderNumber} created — inventory reserved`,
        );
        setOpen(false);
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const advance = trpc.orders.advance.useMutation({
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(
        v.target === "cancelled"
          ? "Order cancelled — reservation released (saga compensation)"
          : v.target === "delivered"
            ? "Order delivered — LTV recalculated"
            : `Order → ${v.target}`,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const activeLots = lots?.filter((l) => l.status === "active") ?? [];
  const selectedLot = activeLots.find((l) => String(l.id) === lotId);
  const qtyNum = Number(qty) || 0;
  const totalCents = selectedLot ? qtyNum * selectedLot.pricePerLbCents + FLAT_SHIPPING_CENTS : 0;

  return (
    <Layout>
      <PageHeader
        title="Orders"
        sub="Idempotent creation · inventory reservation · cancel compensation · first-order COF-005 conversion"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New order</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>CreateOrder</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Roaster</Label>
                  <Select value={roasterId} onValueChange={setRoasterId}>
                    <SelectTrigger><SelectValue placeholder="Select roaster" /></SelectTrigger>
                    <SelectContent>
                      {roasters?.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.roasterName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lot</Label>
                  <Select value={lotId} onValueChange={setLotId}>
                    <SelectTrigger><SelectValue placeholder="Select lot" /></SelectTrigger>
                    <SelectContent>
                      {activeLots.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name} — {formatCentsPerLb(l.pricePerLbCents)} · {l.availableLbs} lbs avail
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity (lbs)</Label>
                  <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                {selectedLot && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Coffee</span><span>{formatCents(qtyNum * selectedLot.pricePerLbCents)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Flat shipping</span><span>{formatCents(FLAT_SHIPPING_CENTS)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCents(totalCents)}</span></div>
                  </div>
                )}
                <div>
                  <Label>Idempotency key</Label>
                  <div className="flex gap-2">
                    <Input value={idemKey} readOnly className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setIdemKey(crypto.randomUUID())}>
                      New
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Re-submitting with the same key returns the existing order instead of duplicating it.
                  </p>
                </div>
                <Button
                  className="w-full"
                  disabled={!roasterId || !lotId || qtyNum < 1 || create.isPending}
                  onClick={() =>
                    create.mutate({
                      roasterId: Number(roasterId),
                      lotId: Number(lotId),
                      quantityLbs: qtyNum,
                      idempotencyKey: idemKey,
                    })
                  }
                >
                  Place order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Order book</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Roaster</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <span className="font-mono text-sm">{o.orderNumber}</span>
                    {o.firstOrder && (
                      <Badge className="ml-2 bg-amber-100 text-amber-800 text-[10px]">
                        <Star className="h-2.5 w-2.5 mr-0.5" /> first
                      </Badge>
                    )}
                    <div className="text-[11px] text-muted-foreground">{new Date(o.createdAt).toLocaleString()}</div>
                  </TableCell>
                  <TableCell className="text-sm">{o.roasterName}</TableCell>
                  <TableCell className="text-xs">
                    {o.lines.map((l) => (
                      <div key={l.id}>{l.quantityLbs} lbs · {l.lotName} @ {formatCentsPerLb(l.unitPriceCents)}</div>
                    ))}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{formatCents(o.totalCents)}</TableCell>
                  <TableCell>
                    <Badge className={`capitalize ${STATUS_STYLE[o.status]}`}>{o.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDER_TRANSITIONS[o.status].map((t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant={t === "cancelled" ? "destructive" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => advance.mutate({ orderId: o.id, target: t as "shipped" | "delivered" | "cancelled" })}
                        >
                          → {t}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orders?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No orders yet — the first order for a roaster fires COF-005 and halts the nurture sequence.
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
