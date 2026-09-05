import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader, money } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DispositionLedger,
  PartnerProtections,
} from "@/components/DispositionPanel";
import {
  Handshake,
  Plus,
  Receipt,
  FileSignature,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

const TIER_LABEL: Record<string, string> = {
  tier_a: "Tier A",
  tier_b: "Tier B",
  tier_c: "Tier C",
};
const TIER_STYLE: Record<string, string> = {
  tier_a: "bg-[#16382a] text-white",
  tier_b: "bg-[#d9a441] text-[#16382a]",
  tier_c: "bg-slate-200 text-slate-700",
};
const ADDENDUM_STATUS: Record<string, string> = {
  pending: "bg-slate-200 text-slate-700",
  delivered: "bg-sky-100 text-sky-800",
  verified: "bg-emerald-100 text-emerald-800",
  sold: "bg-amber-100 text-amber-800",
  settled: "bg-[#16382a] text-white",
};

type ReceiptData = {
  lotCode: string;
  netWeightLbs: number;
  cupScore: number | null;
  qualityTier: string;
  floorPricePerLbCents: number;
  floorPaymentCents: number;
  finalSalePriceCents: number | null;
  documentedCostsCents: number;
  netSaleProceedsCents: number | null;
  revenueSharePct: number | null;
  revenueShareCents: number | null;
};

export default function Partners() {
  const utils = trpc.useUtils();
  const { data: overview } = trpc.partners.overview.useQuery();
  const invalidate = () => utils.partners.overview.invalidate();

  const markPaid = trpc.partners.markPaymentPaid.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Payment marked paid");
    },
    onError: e => toast.error(e.message),
  });

  const markPtPaid = trpc.partners.markPassThroughPaid.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Pass-through marked paid");
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        kicker="Folio 03 — The Proof"
        title="Partnership Agreements"
        sub="Revenue Share White-Glove — floor payments, revenue share, collector pass-through, dispositions and the §9 protections that run the other way"
        actions={
          <div className="flex gap-2">
            <RegisterPartnerDialog onDone={invalidate} />
            <AddendumDialog partners={overview ?? []} onDone={invalidate} />
          </div>
        }
      />

      {/* §B–§E and §9. Placed above the payment ledgers because a disposition
          changes what is owed, and reading the ledger without it shows a number
          whose reason lives on another screen. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr] items-start">
        <DispositionLedger />
        {overview?.[0] ? (
          <PartnerProtections partnerId={overview[0].id} />
        ) : null}
      </div>

      <div className="space-y-6">
        {(overview ?? []).map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-base">
                  <Handshake className="h-4 w-4" />
                  {p.partnerName}
                  <Badge className={TIER_STYLE[p.partnerTier]}>
                    {TIER_LABEL[p.partnerTier]}
                  </Badge>
                  <Badge variant="outline">{p.partnerType}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      p.agreementStatus === "active"
                        ? "border-emerald-500 text-emerald-700"
                        : ""
                    }
                  >
                    {p.agreementStatus}
                  </Badge>
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  {p.originRegion} · floor SLA {p.floorSlaDays} business days
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Addenda */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Lot Addenda (Exhibit D)
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot code</TableHead>
                      <TableHead>Floor $/lb</TableHead>
                      <TableHead>Expected lbs</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.addenda.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">
                          {a.lotCode}
                        </TableCell>
                        <TableCell>{money(a.floorPricePerLbCents)}</TableCell>
                        <TableCell>
                          {a.expectedQtyLbs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.deliveryWindow || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={ADDENDUM_STATUS[a.status]}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(a.status === "delivered" ||
                            a.status === "pending") && (
                            <VerifyFloorDialog
                              addendumId={a.id}
                              lotCode={a.lotCode}
                              onDone={invalidate}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {p.addenda.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-4"
                        >
                          No addenda yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Payments */}
              {p.payments.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Payments & True Price Receipts
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.payments.map(pay => (
                        <TableRow key={pay.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                pay.paymentType === "floor"
                                  ? "border-[#16382a] text-[#16382a]"
                                  : "border-[#d9a441] text-[#8a6420]"
                              }
                            >
                              {pay.paymentType === "floor"
                                ? "Floor"
                                : "Revenue share"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {money(pay.amountCents)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                pay.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : pay.status === "held"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }
                            >
                              {pay.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(pay.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <ReceiptDialog receipt={pay.receipt} />
                              {pay.status === "accrued" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    markPaid.mutate({ paymentId: pay.id })
                                  }
                                >
                                  <Banknote className="h-3 w-3 mr-1" /> Mark
                                  paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Collector pass-throughs */}
              {p.passThroughs.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Collector Pass-Through (Exhibit C — ≥80% to farmers)
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Farmer group</TableHead>
                        <TableHead>% of lot</TableHead>
                        <TableHead>Floor owed</TableHead>
                        <TableHead>RS owed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.passThroughs.map(pt => (
                        <TableRow key={pt.id}>
                          <TableCell className="text-sm">
                            {pt.farmerName}
                          </TableCell>
                          <TableCell>{pt.pctOfLot}%</TableCell>
                          <TableCell>
                            {money(pt.floorOwedCents)}
                            {pt.floorPaidAt && (
                              <span className="text-xs text-emerald-600 ml-1">
                                paid
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {money(pt.rsOwedCents)}
                            {pt.rsPaidAt && (
                              <span className="text-xs text-emerald-600 ml-1">
                                paid
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {!pt.floorPaidAt && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    markPtPaid.mutate({
                                      passThroughId: pt.id,
                                      kind: "floor",
                                    })
                                  }
                                >
                                  Floor paid
                                </Button>
                              )}
                              {!pt.rsPaidAt && pt.rsOwedCents > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() =>
                                    markPtPaid.mutate({
                                      passThroughId: pt.id,
                                      kind: "revenue_share",
                                    })
                                  }
                                >
                                  RS paid
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {(overview ?? []).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No partners registered — sign the first Revenue Share agreement.
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function RegisterPartnerDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerType, setPartnerType] = useState<"farmer" | "collector">(
    "farmer"
  );
  const [originRegion, setOriginRegion] = useState("");
  const [partnerTier, setPartnerTier] = useState<
    "tier_a" | "tier_b" | "tier_c"
  >("tier_b");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const register = trpc.partners.registerPartner.useMutation({
    onSuccess: () => {
      toast.success("Agreement signed — partner registered");
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#16382a] hover:bg-[#1f4a38]">
          <FileSignature className="h-4 w-4 mr-1" /> Sign partner
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revenue Share Agreement — new partner</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Partner name</Label>
            <Input
              value={partnerName}
              onChange={e => setPartnerName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select
                value={partnerType}
                onValueChange={v => setPartnerType(v as typeof partnerType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="farmer">Farmer / cooperative</SelectItem>
                  <SelectItem value="collector">Collector</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Partner tier (floor SLA)</Label>
              <Select
                value={partnerTier}
                onValueChange={v => setPartnerTier(v as typeof partnerTier)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_a">
                    Tier A — 3 business days
                  </SelectItem>
                  <SelectItem value="tier_b">
                    Tier B — 5 business days
                  </SelectItem>
                  <SelectItem value="tier_c">
                    Tier C — 7 business days
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Origin region</Label>
            <Input
              value={originRegion}
              onChange={e => setOriginRegion(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={
              register.isPending || !partnerName.trim() || !originRegion.trim()
            }
            onClick={() =>
              register.mutate({
                partnerName,
                partnerType,
                originRegion,
                partnerTier,
                email,
                phone,
              })
            }
          >
            Sign & register
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddendumDialog({
  partners,
  onDone,
}: {
  partners: { id: number; partnerName: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [lotId, setLotId] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [protocol, setProtocol] = useState("");
  const [floor, setFloor] = useState("");
  const [qty, setQty] = useState("");
  const [window_, setWindow] = useState("");
  const { data: lots } = trpc.catalog.list.useQuery();

  const create = trpc.partners.createAddendum.useMutation({
    onSuccess: () => {
      toast.success("Lot addendum created");
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Lot addendum
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lot Addendum (Exhibit D)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Partner</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                {partners.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.partnerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Linked catalog lot (optional)</Label>
            <Select value={lotId} onValueChange={setLotId}>
              <SelectTrigger>
                <SelectValue placeholder="Link lot for revenue-share accrual" />
              </SelectTrigger>
              <SelectContent>
                {(lots ?? []).map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Lot code</Label>
              <Input
                value={lotCode}
                onChange={e => setLotCode(e.target.value)}
                placeholder="ADD-HUILA-2025-02"
              />
            </div>
            <div>
              <Label>Floor price ($/lb)</Label>
              <Input
                type="number"
                step="0.01"
                value={floor}
                onChange={e => setFloor(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Processing protocol</Label>
            <Input
              value={protocol}
              onChange={e => setProtocol(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Expected qty (lbs)</Label>
              <Input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>
            <div>
              <Label>Delivery window</Label>
              <Input
                value={window_}
                onChange={e => setWindow(e.target.value)}
                placeholder="2025-11-01 → 2025-12-15"
              />
            </div>
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={
              create.isPending ||
              !partnerId ||
              !lotCode.trim() ||
              !floor ||
              !qty
            }
            onClick={() =>
              create.mutate({
                partnerId: Number(partnerId),
                lotId: lotId ? Number(lotId) : undefined,
                lotCode,
                processingProtocol: protocol,
                floorPricePerLbCents: Math.round(Number(floor) * 100),
                expectedQtyLbs: Number(qty),
                deliveryWindow: window_,
              })
            }
          >
            Create addendum
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VerifyFloorDialog({
  addendumId,
  lotCode,
  onDone,
}: {
  addendumId: number;
  lotCode: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [cupScore, setCupScore] = useState("");

  const verify = trpc.partners.verifyAndAccrueFloor.useMutation({
    onSuccess: r => {
      toast.success(
        `Floor accrued: ${money(r.floorPaymentCents)} · quality tier ${r.qualityTier} (${r.sharePct}% share)`
      );
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          Verify & accrue floor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tier-1 verification — {lotCode}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Floor Payment = True-Cost Floor Price × verified net weight. Accrues
            on Tier-1 verification and is never clawed back except confirmed
            fraud.
          </p>
          <div>
            <Label>Verified net weight (lbs)</Label>
            <Input
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
            />
          </div>
          <div>
            <Label>Verified cup score</Label>
            <Input
              type="number"
              step="0.25"
              min={0}
              max={100}
              value={cupScore}
              onChange={e => setCupScore(e.target.value)}
            />
          </div>
          <Button
            className="w-full bg-[#16382a] hover:bg-[#1f4a38]"
            disabled={verify.isPending || !qty || !cupScore}
            onClick={() =>
              verify.mutate({
                addendumId,
                verifiedQtyLbs: Number(qty),
                cupScore: Number(cupScore),
              })
            }
          >
            Accrue floor payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ receipt }: { receipt: string }) {
  const [open, setOpen] = useState(false);
  let data: ReceiptData | null = null;
  try {
    data = JSON.parse(receipt) as ReceiptData;
  } catch {
    data = null;
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-xs">
          <Receipt className="h-3 w-3 mr-1" /> Receipt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>True Price Receipt — {data?.lotCode ?? "—"}</DialogTitle>
        </DialogHeader>
        {data ? (
          <div className="space-y-2 text-sm">
            {(
              [
                ["Net weight", `${data.netWeightLbs.toLocaleString()} lbs`],
                [
                  "Cup score",
                  data.cupScore != null ? String(data.cupScore) : "—",
                ],
                ["Quality tier", data.qualityTier],
                ["Floor price", `${money(data.floorPricePerLbCents)}/lb`],
                ["Floor payment", money(data.floorPaymentCents)],
                [
                  "Final sale price",
                  data.finalSalePriceCents != null
                    ? money(data.finalSalePriceCents)
                    : "pending sale",
                ],
                ["Documented costs", money(data.documentedCostsCents)],
                [
                  "Net sale proceeds",
                  data.netSaleProceedsCents != null
                    ? money(data.netSaleProceedsCents)
                    : "—",
                ],
                [
                  "Revenue share %",
                  data.revenueSharePct != null
                    ? `${data.revenueSharePct}%`
                    : "—",
                ],
                [
                  "Revenue share",
                  data.revenueShareCents != null
                    ? money(data.revenueShareCents)
                    : "—",
                ],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between border-b border-border/50 pb-1"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Receipt data unavailable.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
