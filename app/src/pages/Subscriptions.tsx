// Standing orders — §3.6.
//
// A recurring order is a template plus a cursor, not a queue of pre-written
// invoices: nextRunOn is the single fact that decides what gets billed. The
// generate button is safe to press twice — a cycle is claimed before an invoice
// is issued, and the claim is unique on (standing order, period).
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
import { useFlags } from "@/hooks/useFlags";
import { CalendarClock, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const CADENCE_COPY: Record<string, string> = {
  weekly: "every week",
  biweekly: "every two weeks",
  monthly: "every month",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  ended: "outline",
};

export default function Subscriptions() {
  const { flags } = useFlags();
  const utils = trpc.useUtils();
  const [preview, setPreview] = useState<string | null>(null);

  const orders = trpc.standingOrders.list.useQuery({});

  const refresh = () => {
    utils.standingOrders.list.invalidate();
  };

  const setStatus = trpc.standingOrders.setStatus.useMutation({
    onSuccess: res => {
      toast.success(`Standing order ${res.status}`);
      refresh();
    },
    onError: e => toast.error(e.message),
  });

  const generate = trpc.standingOrders.generate.useMutation({
    onSuccess: res => {
      if (res.invoiced === 0 && res.skipped === 0) {
        toast.info("Nothing is due today.");
      } else {
        toast.success(
          `${res.invoiced} invoiced, ${res.skipped} already generated, ${res.failed} failed`
        );
      }
      setPreview(
        res.details
          .map(d => {
            // The outcome is implied by which fields came back: an invoiceId
            // means it was issued, a reason means it was not.
            const outcome = d.invoiceId
              ? `invoiced #${d.invoiceId}`
              : (d.reason ?? "skipped");
            return `${d.reference} · ${d.periodStart}: ${outcome}`;
          })
          .join("\n") || null
      );
      refresh();
    },
    onError: e => toast.error(e.message),
  });

  const rows = orders.data ?? [];

  return (
    <Layout>
      <PageHeader
        title="Standing orders"
        sub="Recurring B2B deliveries and the invoices they generate."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active cadences</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Generation is idempotent — running it twice on the same day cannot
              bill a café twice.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => generate.mutate({ dryRun: true })}
              disabled={generate.isPending}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={() => generate.mutate({ dryRun: false })}
              disabled={!flags.standingOrders || generate.isPending}
              title={
                flags.standingOrders
                  ? undefined
                  : "The standing-orders flag is off — nothing will be issued."
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {generate.isPending ? "Generating…" : "Generate due invoices"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No standing orders yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      {order.reference}
                    </TableCell>
                    <TableCell className="text-sm">
                      {CADENCE_COPY[order.cadence] ?? order.cadence}
                      <span className="block text-xs text-muted-foreground">
                        anchored on day {order.anchorDay}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money
                        amountMinor={order.subtotalMinor}
                        currency={order.currency}
                      />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {String(order.nextRunOn)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[order.status] ?? "outline"}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.status !== "ended" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setStatus.mutate({
                              id: order.id,
                              status:
                                order.status === "active" ? "paused" : "active",
                            })
                          }
                          disabled={setStatus.isPending}
                        >
                          {order.status === "active" ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Resume
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Last generation run</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
              {preview}
            </pre>
          </CardContent>
        </Card>
      )}
    </Layout>
  );
}
