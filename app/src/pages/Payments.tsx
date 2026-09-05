// Payments / AR — sprint spec §8.2.
//
// The exception queue is the most important screen in the sprint, so it is at
// the top of the page and it is never empty-by-omission: unmatched, ambiguous,
// unverified and residual money all appear here, because money that is
// invisible is money that is lost (§14.6).
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/Money";
import {
  AgingBucketBar,
  AgingLegend,
  type AgingRowView,
} from "@/components/AgingBucketBar";
import {
  AllocationDialog,
  type ExceptionTransaction,
} from "@/components/AllocationDialog";
import { useFlags } from "@/hooks/useFlags";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Landmark,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

/** Why a transfer is sitting in the queue, in the operator's language. */
const REASON_COPY: Record<
  string,
  { label: string; hint: string; icon: typeof AlertTriangle }
> = {
  unmatched: {
    label: "Unmatched",
    hint: "No usable reference in the memo — allocate it by hand or it ages as suspense.",
    icon: HelpCircle,
  },
  ambiguous: {
    label: "Ambiguous",
    hint: "More than one invoice fits. The matcher will not guess between them.",
    icon: AlertTriangle,
  },
  awaiting_casso_verification: {
    label: "Unverified",
    hint: "Casso callbacks are not trusted. This cannot move money until the API re-fetch confirms it.",
    icon: ShieldAlert,
  },
  matched_awaiting_allocation: {
    label: "Matched — needs a click",
    hint: "Auto-allocation is off, so a person confirms every match.",
    icon: CheckCircle2,
  },
  residual: {
    label: "Residual",
    hint: "Overpayment or a duplicate transfer. Reallocate it or route it to refund.",
    icon: Landmark,
  },
};

export default function Payments() {
  const utils = trpc.useUtils();
  const { flags } = useFlags();
  const [allocating, setAllocating] = useState<ExceptionTransaction | null>(
    null
  );

  const summary = trpc.payments.ar.summary.useQuery();
  const aging = trpc.payments.ar.aging.useQuery({});
  const queue = trpc.payments.transactions.unmatched.useQuery();
  // §13.4 roster. Only fetched when the flag is on: with auto-allocation off
  // the allowlist decides nothing, and an analyst-only query firing for every
  // role that can open this page is a 403 in the console for no benefit.
  const pilot = trpc.payments.pilot.roster.useQuery(undefined, {
    enabled: flags.autoAllocation,
  });
  const reconciliation = trpc.payments.ar.reconcile.useQuery(undefined, {
    enabled: false,
  });

  const refresh = () => {
    utils.payments.ar.summary.invalidate();
    utils.payments.ar.aging.invalidate();
    utils.payments.transactions.unmatched.invalidate();
    utils.invoices.list.invalidate();
  };

  const ignore = trpc.payments.transactions.ignore.useMutation({
    onSuccess: () => {
      toast.success("Transfer ignored");
      refresh();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Layout>
      <PageHeader
        title="Payments & Receivables"
        sub="VietQR settlement, aging buckets and the exception queue — amounts in Asia/Ho_Chi_Minh days"
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      {!flags.autoAllocation ? (
        <div className="mb-6 rounded-md border border-[#947642]/40 bg-[#F0E6CC]/40 px-4 py-3 text-sm">
          <strong className="font-semibold">Auto-allocation is off.</strong>{" "}
          Every matched transfer waits for a person to confirm it. This is the
          intended posture for the first two weeks in production.
        </div>
      ) : (
        // §13.4 · with the flag on, the allowlist is what actually decides.
        // An operator who flips the flag and sees nothing move needs to be told
        // that the second control is the empty roster, not a broken matcher.
        <div className="mb-6 rounded-md border border-[#947642]/40 bg-[#F0E6CC]/40 px-4 py-3 text-sm">
          <strong className="font-semibold">
            Auto-allocation is on for {pilot.data?.length ?? 0} pilot
            counterpart{(pilot.data?.length ?? 0) === 1 ? "y" : "ies"}.
          </strong>{" "}
          {(pilot.data?.length ?? 0) === 0 ? (
            <>
              Nobody is enrolled, so every match still waits for a person. Enrol
              a counterparty to let their matched transfers settle themselves.
            </>
          ) : (
            <>
              Everyone else still waits for a person.{" "}
              {pilot.data?.filter(m => m.readyToGraduate).length ?? 0} of{" "}
              {pilot.data?.length ?? 0} have cleared the §13.4 fourteen-day
              window:{" "}
              {pilot.data
                ?.map(m =>
                  m.readyToGraduate
                    ? `${m.name} (ready)`
                    : `${m.name} — ${m.blocker}`
                )
                .join(" · ")}
              .
            </>
          )}
        </div>
      )}

      {/* ── Exception queue ─────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Exception queue
            {queue.data && queue.data.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {queue.data.length}
              </Badge>
            )}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            money received that no invoice yet claims
          </span>
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (queue.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing unassigned. Every transfer received is allocated to an
              invoice.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Unallocated</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(queue.data ?? []).map(txn => {
                  const reason =
                    REASON_COPY[txn.reason] ?? REASON_COPY.unmatched;
                  const Icon = reason.icon;
                  const blocked = txn.reason === "awaiting_casso_verification";
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="align-top text-xs">
                        <div>{new Date(txn.receivedAt).toLocaleString()}</div>
                        <div className="text-muted-foreground">
                          {txn.provider} · {txn.providerTxnId}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs align-top">
                        <div className="break-words text-sm">
                          {txn.description || "—"}
                        </div>
                        {txn.counterAccountName && (
                          <div className="text-xs text-muted-foreground">
                            {txn.counterAccountName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="mb-1 gap-1">
                          <Icon className="h-3 w-3" />
                          {reason.label}
                        </Badge>
                        <p className="max-w-xs text-xs text-muted-foreground">
                          {reason.hint}
                        </p>
                        {txn.verificationError && (
                          <p className="mt-1 max-w-xs text-xs text-destructive">
                            {txn.verificationError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Money
                          amountMinor={txn.residualMinor}
                          currency={txn.currency}
                          emphasis
                        />
                        {txn.allocatedMinor > 0n && (
                          <div className="text-xs text-muted-foreground">
                            of{" "}
                            <Money
                              amountMinor={txn.amountMinor}
                              currency={txn.currency}
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            disabled={blocked}
                            title={
                              blocked
                                ? "An unverified Casso transaction cannot move money (ADR-03)"
                                : undefined
                            }
                            onClick={() =>
                              setAllocating({
                                id: txn.id,
                                provider: txn.provider,
                                providerTxnId: txn.providerTxnId,
                                amountMinor: txn.amountMinor,
                                currency: txn.currency,
                                description: txn.description,
                                counterAccountName: txn.counterAccountName,
                                residualMinor: txn.residualMinor,
                                matchedInvoiceId: txn.matchedInvoiceId,
                                matchMethod: txn.matchMethod,
                              })
                            }
                          >
                            Allocate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              const reasonText = window.prompt(
                                "Why is this transfer being ignored? (recorded in the audit trail)"
                              );
                              if (reasonText && reasonText.trim().length >= 3) {
                                ignore.mutate({
                                  id: txn.id,
                                  reason: reasonText.trim(),
                                });
                              }
                            }}
                          >
                            Ignore
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── AR summary, including suspense ──────────────────────────────── */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(summary.data?.currencies ?? []).map(c => (
          <Card key={c.currency}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receivables · {c.currency}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm">Outstanding</span>
                <Money
                  amountMinor={c.outstandingMinor}
                  currency={c.currency}
                  emphasis
                  className="text-lg"
                />
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Overdue</span>
                <Money amountMinor={c.overdueMinor} currency={c.currency} />
              </div>
              <div className="flex items-baseline justify-between border-t pt-2 text-sm">
                <span
                  className="text-muted-foreground"
                  title="Money received that no invoice claims"
                >
                  Suspense
                </span>
                <Money
                  amountMinor={c.suspenseMinor}
                  currency={c.currency}
                  className={
                    c.suspenseMinor > 0n
                      ? "text-[#8C2F22] font-semibold"
                      : undefined
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {c.openInvoices} open invoice{c.openInvoices === 1 ? "" : "s"} ·{" "}
                {c.unmatchedTransactions} unmatched transfer
                {c.unmatchedTransactions === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        ))}
        {summary.data?.currencies.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No open receivables.
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Aging ───────────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Aging by counterparty</CardTitle>
          <span className="text-xs text-muted-foreground">
            as of {aging.data?.asOf}
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          <AgingLegend />
          {(aging.data?.rows ?? []).map(row => (
            <div
              key={`${row.counterpartyId}:${row.currency}`}
              className="space-y-2"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {row.counterpartyName}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({row.currency})
                  </span>
                </span>
                <Money
                  amountMinor={row.total}
                  currency={row.currency}
                  emphasis
                />
              </div>
              <AgingBucketBar row={row as AgingRowView} />
            </div>
          ))}
          {aging.data?.rows.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing outstanding.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Reconciliation (§13.3) ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Reconciliation</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => reconciliation.refetch()}
          >
            Run checks
          </Button>
        </CardHeader>
        <CardContent>
          {!reconciliation.data ? (
            <p className="text-sm text-muted-foreground">
              Asserts that every invoice&apos;s paid amount equals the sum of
              its live allocations, that no transfer is over-allocated, that
              every matched transfer has an allocation, and that no allocation
              crosses currencies without a rate. Runs nightly; run it here on
              demand.
            </p>
          ) : reconciliation.data.ok ? (
            <p className="flex items-center gap-2 text-sm text-[#4F6958]">
              <CheckCircle2 className="h-4 w-4" />
              All checks pass — no drift.
            </p>
          ) : (
            <ul className="space-y-2">
              {reconciliation.data.findings.map((f, i) => (
                <li
                  key={i}
                  className="rounded-md border border-destructive/40 p-2 text-sm"
                >
                  <Badge variant="destructive" className="mb-1">
                    {f.check}
                  </Badge>
                  <div className="text-xs">{f.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AllocationDialog
        transaction={allocating}
        open={allocating !== null}
        onOpenChange={open => !open && setAllocating(null)}
        onDone={refresh}
      />
    </Layout>
  );
}
