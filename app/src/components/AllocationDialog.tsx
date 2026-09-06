// Allocation dialog — §8.3.
//
// The operator's answer to "this money arrived; which invoice does it belong
// to?". It shows what the matcher thought and why, so a human is confirming a
// proposal rather than re-deriving it.
import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/Money";
import { parseMinor } from "@contracts/money";
import { toast } from "sonner";

export type ExceptionTransaction = {
  id: number;
  provider: string;
  providerTxnId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  counterAccountName: string | null;
  residualMinor: bigint;
  matchedInvoiceId: number | null;
  matchMethod: string | null;
};

export function AllocationDialog({
  transaction,
  open,
  onOpenChange,
  onDone,
}: {
  transaction: ExceptionTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState<number | null>(null);
  const [amountText, setAmountText] = useState("");
  const [fxRate, setFxRate] = useState("");

  const openInvoices = trpc.payments.openInvoices.useQuery(undefined, {
    enabled: open,
  });
  const allocate = trpc.payments.allocations.create.useMutation({
    onSuccess: res => {
      toast.success(
        res.overpaid
          ? "Allocated. The excess stays on the transfer for refund or reallocation."
          : "Allocated"
      );
      onOpenChange(false);
      setInvoiceId(null);
      setAmountText("");
      setFxRate("");
      onDone();
    },
    onError: e => toast.error(e.message),
  });

  const selected = useMemo(
    () => (openInvoices.data ?? []).find(i => i.id === invoiceId) ?? null,
    [openInvoices.data, invoiceId]
  );

  // A cross-currency allocation needs an explicit rate; the UI must not let the
  // operator submit without one, because the service will refuse it anyway.
  const crossCurrency = Boolean(
    selected && transaction && selected.currency !== transaction.currency
  );

  if (!transaction) return null;

  const submit = () => {
    if (!invoiceId) return;
    let amountMinor: bigint | undefined;
    if (amountText.trim()) {
      try {
        amountMinor = parseMinor(amountText, transaction.currency);
      } catch {
        toast.error(
          `"${amountText}" is not a valid ${transaction.currency} amount`
        );
        return;
      }
    }
    allocate.mutate({
      providerTransactionId: transaction.id,
      invoiceId,
      amountMinor,
      fxRate: crossCurrency ? fxRate : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate transfer</DialogTitle>
          <DialogDescription>
            {transaction.provider} · {transaction.providerTxnId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Unallocated</span>
              <Money
                amountMinor={transaction.residualMinor}
                currency={transaction.currency}
                emphasis
              />
            </div>
            <div className="mt-2 break-words text-xs text-muted-foreground">
              Memo: {transaction.description || <em>none</em>}
            </div>
            {transaction.counterAccountName && (
              <div className="text-xs text-muted-foreground">
                From: {transaction.counterAccountName}
              </div>
            )}
            {transaction.matchMethod && (
              <Badge variant="outline" className="mt-2 text-xs">
                matcher proposed: {transaction.matchMethod}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>Invoice</Label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {(openInvoices.data ?? []).map(invoice => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setInvoiceId(invoice.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${
                    invoiceId === invoice.id
                      ? "bg-muted ring-1 ring-inset ring-border"
                      : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {invoice.counterpartyName} · due {String(invoice.dueAt)} ·{" "}
                      <code className="font-mono">{invoice.memoToken}</code>
                    </span>
                  </span>
                  <Money
                    amountMinor={invoice.outstandingMinor}
                    currency={invoice.currency}
                  />
                </button>
              ))}
              {openInvoices.data?.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No open invoices.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="alloc-amount">
                Amount{" "}
                <span className="text-muted-foreground">
                  (blank = as much as it settles)
                </span>
              </Label>
              <Input
                id="alloc-amount"
                inputMode="decimal"
                placeholder={`Full ${transaction.currency} residual`}
                value={amountText}
                onChange={e => setAmountText(e.target.value)}
              />
            </div>
            {crossCurrency && (
              <div className="space-y-1">
                <Label htmlFor="alloc-fx">
                  FX rate ({transaction.currency} → {selected?.currency})
                </Label>
                <Input
                  id="alloc-fx"
                  placeholder="e.g. 0.0000384615"
                  value={fxRate}
                  onChange={e => setFxRate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required: the realized difference is unrecoverable if the rate
                  is not captured now.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              !invoiceId ||
              allocate.isPending ||
              (crossCurrency && !fxRate.trim())
            }
          >
            {allocate.isPending ? "Allocating…" : "Allocate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
