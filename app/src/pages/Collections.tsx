// Collections & FX — §3.4 and §3.3.
//
// Two things an AR desk needs that the exception queue does not answer: who is
// about to be chased and with what, and what the currency movement has actually
// cost us. Both are shown before either can be acted on — the dunning plan is a
// dry run by construction, because the failure mode here is contacting a
// customer you did not mean to contact.
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
import { useFlags } from "@/hooks/useFlags";
import {
  Mail,
  MessageCircle,
  Phone,
  Send,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  zalo: MessageCircle,
  sms: MessageCircle,
  phone_task: Phone,
  in_app: Send,
};

/** What each ladder action actually does, in the operator's language. */
const ACTION_COPY: Record<string, string> = {
  send_invoice: "Sends the invoice again",
  send_reminder: "Sends a reminder",
  create_call_task: "Creates a task for a person to call",
  offer_installment: "Offers to split the balance",
  escalate: "Escalates internally",
};

export default function Collections() {
  const { flags } = useFlags();
  const utils = trpc.useUtils();

  const plan = trpc.payments.dunning.plan.useQuery({});
  const effectiveness = trpc.payments.dunning.effectiveness.useQuery();
  const position = trpc.payments.fx.position.useQuery();

  const run = trpc.payments.dunning.run.useMutation({
    onSuccess: res => {
      toast.success(
        `${res.recorded} sent, ${res.duplicates} already delivered today`
      );
      utils.payments.dunning.plan.invalidate();
      utils.payments.dunning.effectiveness.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const planned = plan.data ?? [];

  return (
    <Layout>
      <PageHeader
        title="Collections & FX"
        sub="Who the ladder would contact today, and what the currency movement has cost."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Today's dunning plan</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing here has been sent. Running the sweep is idempotent: a
              step already delivered for an invoice is never delivered twice.
            </p>
          </div>
          <Button
            onClick={() => run.mutate({ dryRun: false })}
            disabled={!flags.dunning || run.isPending || planned.length === 0}
            title={
              flags.dunning
                ? undefined
                : "The dunning flag is off — nothing will be sent."
            }
          >
            {run.isPending ? "Sending…" : `Send ${planned.length} step(s)`}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {planned.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nobody is due to be contacted today.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planned.map(step => {
                  const Icon = CHANNEL_ICON[step.channel] ?? Send;
                  return (
                    <TableRow
                      key={`${step.candidate.invoiceId}-${step.stepId}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {step.candidate.invoiceNumber}
                      </TableCell>
                      <TableCell>{step.candidate.counterpartyName}</TableCell>
                      <TableCell className="text-right">
                        <Money
                          amountMinor={step.candidate.outstandingMinor}
                          currency={step.candidate.currency}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {step.candidate.daysOverdue}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          day {step.offsetDays}
                        </Badge>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {ACTION_COPY[step.action] ?? step.action}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <span className="block truncate text-xs font-medium">
                          {step.subject}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {step.body.split("\n").find(Boolean)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Which channel actually gets paid</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Conversion is the share of contacts followed by a payment. A
              channel nobody answers is worth removing from the ladder.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opened</TableHead>
                  <TableHead className="text-right">Paid after</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(effectiveness.data ?? []).map(row => (
                  <TableRow key={row.channel}>
                    <TableCell>{row.channel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.sent}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.opened}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.paidAfter}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.conversionRate === null
                        ? "—"
                        : `${(row.conversionRate * 100).toFixed(0)}%`}
                    </TableCell>
                  </TableRow>
                ))}
                {(effectiveness.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-sm text-muted-foreground"
                    >
                      Nothing has been sent yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realized FX</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The difference between the rate a contract assumed and the rate
              the money actually moved at, booked at allocation time. A positive
              figure is a gain to us.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice currency</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(position.data ?? []).map(row => (
                  <TableRow key={row.invoiceCurrency}>
                    <TableCell className="flex items-center gap-2">
                      {row.realizedMinor >= 0n ? (
                        <TrendingUp className="h-4 w-4 text-[#3F6B4A]" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-[#8C2F22]" />
                      )}
                      {row.invoiceCurrency}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.adjustments}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        amountMinor={row.realizedMinor}
                        currency={row.invoiceCurrency}
                        emphasis
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(position.data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-sm text-muted-foreground"
                    >
                      No cross-currency payment has been allocated yet.
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
