// Invoices — sprint spec §8.2.
//
// List, issue, void, and per-invoice payment history including reversals. The
// history matters more than it looks: "why does this invoice show ₫0 paid when
// I watched the transfer arrive" is the question this screen exists to answer.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/Money";
import { VietQRCode } from "@/components/VietQRCode";
import { useFlags } from "@/hooks/useFlags";
import { parseMinor, SUPPORTED_CURRENCIES } from "@contracts/money";
import { FileText, Plus, QrCode, Wallet } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-200 text-slate-700",
  issued: "bg-sky-100 text-sky-800",
  partially_paid: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-800",
  overpaid: "bg-[#F0E6CC] text-[#6E572C]",
  void: "bg-slate-200 text-slate-500 line-through",
  written_off: "bg-[#F2E3E0] text-[#5E2B25]",
};

const VAT_RATES = [
  { value: "0", label: "0% — exported / exempt" },
  { value: "500", label: "5%" },
  { value: "800", label: "8%" },
  { value: "1000", label: "10% — standard" },
];

export default function Invoices() {
  const utils = trpc.useUtils();
  const [openOnly, setOpenOnly] = useState(true);
  const [detailId, setDetailId] = useState<number | null>(null);

  const list = trpc.invoices.list.useQuery({ openOnly, limit: 50 });
  const refresh = () => {
    utils.invoices.list.invalidate();
    utils.payments.ar.summary.invalidate();
    utils.payments.ar.aging.invalidate();
  };

  return (
    <Layout>
      <PageHeader
        title="Invoices"
        sub="Receivables raised against orders and contracts — every payment resolves to one of these"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenOnly(v => !v)}
            >
              {openOnly ? "Showing open" : "Showing all"}
            </Button>
            <IssueInvoiceDialog onDone={refresh} />
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data?.items ?? []).map(invoice => (
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(invoice.id)}
                >
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>{invoice.counterpartyName ?? "—"}</TableCell>
                  <TableCell>
                    <code className="font-mono text-xs">
                      {invoice.memoToken}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm">
                    {String(invoice.dueAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_STYLE[invoice.status] ?? ""}
                      variant="secondary"
                    >
                      {invoice.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      amountMinor={invoice.totalMinor}
                      currency={invoice.currency}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money
                      amountMinor={invoice.outstandingMinor}
                      currency={invoice.currency}
                      emphasis={invoice.outstandingMinor > 0n}
                      muted={invoice.outstandingMinor === 0n}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {list.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No invoices yet. Issue one against an order or a contract to
                    start.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InvoiceDetailDialog
        invoiceId={detailId}
        onOpenChange={open => !open && setDetailId(null)}
        onDone={refresh}
      />
    </Layout>
  );
}

function IssueInvoiceDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [payableType, setPayableType] = useState<"order" | "contract">("order");
  const [payableId, setPayableId] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [subtotal, setSubtotal] = useState("");
  const [shipping, setShipping] = useState("");
  const [vatRateBp, setVatRateBp] = useState("800");
  const [dueAt, setDueAt] = useState("");
  const [overrideNote, setOverrideNote] = useState("");

  const counterparties = trpc.invoices.counterparties.useQuery(undefined, {
    enabled: open,
  });
  const selected = (counterparties.data ?? []).find(
    c => String(c.id) === counterpartyId
  );
  // §3.6 — two Vietnamese residents must transact in VND unless a licence says
  // otherwise. Surfaced here so the operator learns the rule, not the error.
  const needsOverride =
    selected?.country?.toUpperCase() === "VN" && currency !== "VND";

  const issue = trpc.invoices.issue.useMutation({
    onSuccess: res => {
      toast.success(`${res.invoiceNumber} issued · reference ${res.memoToken}`);
      setOpen(false);
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  const submit = () => {
    let subtotalMinor: bigint;
    let shippingMinor: bigint;
    try {
      subtotalMinor = parseMinor(subtotal, currency);
      shippingMinor = shipping.trim() ? parseMinor(shipping, currency) : 0n;
    } catch {
      toast.error(`Amounts are not valid ${currency}`);
      return;
    }
    issue.mutate({
      payableType,
      payableId: Number(payableId),
      counterpartyId: Number(counterpartyId),
      currency: currency as (typeof SUPPORTED_CURRENCIES)[number],
      subtotalMinor,
      shippingMinor,
      vatRateBp: Number(vatRateBp),
      issuedAt: new Date(),
      dueAt: new Date(`${dueAt}T00:00:00Z`),
      residencyOverrideNote: needsOverride ? overrideNote : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Issue invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue invoice</DialogTitle>
          <DialogDescription>
            VAT is computed from the rate; the total is never taken from the
            client.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>Counterparty</Label>
            <Select value={counterpartyId} onValueChange={setCounterpartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a counterparty" />
              </SelectTrigger>
              <SelectContent>
                {(counterparties.data ?? []).map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} · {c.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Raised against</Label>
              <Select
                value={payableType}
                onValueChange={v => setPayableType(v as "order" | "contract")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="payable-id">
                {payableType === "order" ? "Order" : "Contract"} id
              </Label>
              <Input
                id="payable-id"
                inputMode="numeric"
                value={payableId}
                onChange={e => setPayableId(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                inputMode="decimal"
                value={subtotal}
                onChange={e => setSubtotal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shipping">Shipping</Label>
              <Input
                id="shipping"
                inputMode="decimal"
                value={shipping}
                onChange={e => setShipping(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>VAT</Label>
              <Select value={vatRateBp} onValueChange={setVatRateBp}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_RATES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
              />
            </div>
          </div>

          {needsOverride && (
            <div className="space-y-1 rounded-md border border-[#8C2F22]/40 bg-[#F2E3E0]/40 p-3">
              <Label htmlFor="override" className="text-[#5E2B25]">
                Foreign-exchange override
              </Label>
              <p className="text-xs text-[#5E2B25]">
                Transactions between two Vietnamese residents must settle in
                VND. Record the licence or exemption that permits {currency}{" "}
                here; it is written to the audit trail and requires ops_manager.
              </p>
              <Input
                id="override"
                value={overrideNote}
                onChange={e => setOverrideNote(e.target.value)}
                placeholder="e.g. SBV licence 2026/041 — export settlement"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              issue.isPending ||
              !counterpartyId ||
              !payableId ||
              !subtotal ||
              !dueAt ||
              (needsOverride && overrideNote.trim().length < 3)
            }
          >
            {issue.isPending ? "Issuing…" : "Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDetailDialog({
  invoiceId,
  onOpenChange,
  onDone,
}: {
  invoiceId: number | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { flags } = useFlags();
  const utils = trpc.useUtils();
  const detail = trpc.invoices.byId.useQuery(
    { id: invoiceId ?? 0 },
    { enabled: invoiceId !== null }
  );
  const [intent, setIntent] = useState<{
    qrCodeData: string | null;
    memoToken: string;
    amountMinor: bigint;
    currency: string;
    beneficiary?: {
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    };
  } | null>(null);

  const [intentId, setIntentId] = useState<number | null>(null);
  const createIntent = trpc.payments.intents.create.useMutation({
    onSuccess: res => {
      setIntent(res);
      setIntentId(res.id);
    },
    onError: e => toast.error(e.message),
  });

  const voidInvoice = trpc.invoices.void.useMutation({
    onSuccess: () => {
      toast.success("Invoice voided");
      utils.invoices.byId.invalidate();
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  const invoice = detail.data;

  return (
    <Dialog open={invoiceId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {invoice?.invoiceNumber ?? "Invoice"}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? `${invoice.counterpartyName} · due ${String(invoice.dueAt)}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Figure
                label="Subtotal"
                amountMinor={invoice.subtotalMinor}
                currency={invoice.currency}
              />
              <Figure
                label={`VAT (${(invoice.vatRateBp / 100).toFixed(invoice.vatRateBp % 100 ? 2 : 0)}%)`}
                amountMinor={invoice.vatMinor}
                currency={invoice.currency}
              />
              <Figure
                label="Total"
                amountMinor={invoice.totalMinor}
                currency={invoice.currency}
                emphasis
              />
              <Figure
                label="Outstanding"
                amountMinor={invoice.outstandingMinor}
                currency={invoice.currency}
                emphasis
              />
            </div>

            <EInvoicePanel
              invoiceId={invoice.id}
              status={invoice.eInvoiceStatus}
              onDone={onDone}
            />

            {flags.vietqrPayments && invoice.outstandingMinor > 0n && (
              <div className="rounded-md border p-4">
                {intent ? (
                  <VietQRCode {...intent} />
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      createIntent.mutate({
                        invoiceId: invoice.id,
                        // Scoped per principal, so a per-invoice key is stable
                        // across retries of the same request (§7.3).
                        idempotencyKey: `intent-${invoice.id}-${invoice.outstandingMinor}`,
                      })
                    }
                    disabled={createIntent.isPending}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    {createIntent.isPending ? "Generating…" : "Show VietQR"}
                  </Button>
                )}
                {flags.eWalletPayments && intentId !== null && (
                  <WalletCheckout intentId={intentId} />
                )}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Payment history</h3>
              {invoice.allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing has been allocated to this invoice yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.allocations.map(a => (
                      <TableRow
                        key={a.allocationId}
                        className={a.reversedAt ? "opacity-60" : ""}
                      >
                        <TableCell className="text-xs">
                          {new Date(a.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.provider} · {a.providerTxnId}
                          {a.description && (
                            <span className="block text-muted-foreground">
                              {a.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money
                            amountMinor={a.amountMinor}
                            currency={a.currency}
                          />
                          {a.fxRate && (
                            <span className="block text-xs text-muted-foreground">
                              @ {a.fxRate}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.reversedAt ? (
                            <div>
                              <Badge variant="destructive">reversed</Badge>
                              <span className="block text-xs text-muted-foreground">
                                {a.reversalReason}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="secondary">
                              {a.allocatedByUserId ? "manual" : "automatic"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {invoice && invoice.paidMinor === 0n && invoice.status !== "void" && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                const reason = window.prompt(
                  "Why is this invoice being voided?"
                );
                if (reason && reason.trim().length >= 3) {
                  voidInvoice.mutate({ id: invoice.id, reason: reason.trim() });
                }
              }}
            >
              Void
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({
  label,
  amountMinor,
  currency,
  emphasis,
}: {
  label: string;
  amountMinor: bigint;
  currency: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <Money
        amountMinor={amountMinor}
        currency={currency}
        emphasis={emphasis}
        className="text-base"
      />
    </div>
  );
}

/**
 * E-invoice status and submission — §3.5, closing risk R1.
 *
 * The distinction this panel exists to make visible: our invoice number is an
 * internal receivable reference, and the authority's number is the legal
 * document. A "pending" invoice is not yet a compliant Vietnamese e-invoice, no
 * matter how finished it looks on screen.
 */
function EInvoicePanel({
  invoiceId,
  status,
  onDone,
}: {
  invoiceId: number;
  status: string;
  onDone: () => void;
}) {
  const { flags } = useFlags();
  const utils = trpc.useUtils();
  const submissions = trpc.invoices.einvoice.byInvoice.useQuery({ invoiceId });
  const submit = trpc.invoices.einvoice.submit.useMutation({
    onSuccess: res => {
      if (res.ok) toast.success(`E-invoice issued: ${res.authorityInvoiceNumber}`);
      else toast.error(res.reason);
      utils.invoices.einvoice.byInvoice.invalidate();
      utils.invoices.byId.invalidate();
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  const issued = submissions.data?.find(s => s.status === "issued");

  if (issued) {
    return (
      <div className="rounded-md border border-[#3F6B4A]/40 bg-[#E7F0E8]/40 px-3 py-2 text-xs">
        <span className="font-semibold">E-invoice issued</span> ·{" "}
        {issued.provider} · authority number{" "}
        <span className="font-mono">{issued.authorityInvoiceNumber}</span>
        {issued.lookupUrl && (
          <>
            {" · "}
            <a
              className="underline"
              href={issued.lookupUrl}
              target="_blank"
              rel="noreferrer"
            >
              tra cứu
            </a>
          </>
        )}
      </div>
    );
  }

  if (status !== "pending") return null;

  const lastError = submissions.data?.find(s => s.status === "rejected");

  return (
    <div className="space-y-2 rounded-md border border-[#947642]/40 bg-[#F0E6CC]/30 px-3 py-2 text-xs">
      <p>
        This is an internal receivable, not yet a compliant Vietnamese
        e-invoice. It must still be issued through an authorised provider and
        registered with the tax authority (TT 78/2021).
      </p>
      {lastError?.errorMessage && (
        <p className="text-[#8C2F22]">
          Last attempt was rejected: {lastError.errorMessage}
        </p>
      )}
      {flags.eInvoice && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit.mutate({ invoiceId })}
          disabled={submit.isPending}
        >
          {submit.isPending ? "Submitting…" : "Submit to provider"}
        </Button>
      )}
    </div>
  );
}

/**
 * E-wallet checkout — §2.2.
 *
 * Creating a checkout hands the payer a deep-link; it never credits AR. Money
 * moves only when the signed callback arrives, which is why this button is safe
 * to press twice.
 */
function WalletCheckout({ intentId }: { intentId: number }) {
  const [link, setLink] = useState<{ provider: string; url: string } | null>(
    null
  );
  const charge = trpc.payments.wallets.charge.useMutation({
    onSuccess: res => setLink({ provider: res.provider, url: res.checkoutUrl }),
    onError: e => toast.error(e.message),
  });

  if (link) {
    return (
      <p className="mt-3 text-xs">
        {link.provider} checkout ready ·{" "}
        <a className="underline" href={link.url} target="_blank" rel="noreferrer">
          open payment link
        </a>
      </p>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      {(["momo", "zalopay"] as const).map(provider => (
        <Button
          key={provider}
          size="sm"
          variant="outline"
          onClick={() => charge.mutate({ intentId, provider })}
          disabled={charge.isPending}
        >
          <Wallet className="mr-2 h-4 w-4" />
          {provider === "momo" ? "MoMo" : "ZaloPay"}
        </Button>
      ))}
    </div>
  );
}
