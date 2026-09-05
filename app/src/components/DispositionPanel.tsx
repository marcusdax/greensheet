// Exception disposition and partner protections — Supplier Agreement §B–§E and
// Revenue Share Agreement §9.
//
// Two panels that belong side by side because they are two halves of the same
// relationship: what we may charge a supplier for, and what they may hold us
// to. Showing only the first is how a "fair dealing" clause becomes decoration.
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AlertTriangle, Scale, ShieldQuestion } from "lucide-react";

function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Fault decides who pays, so it is coloured by who pays — not by severity. */
const FAULT_STYLE: Record<string, string> = {
  supplier: "bg-oxblood-100 text-oxblood-700",
  logistics: "bg-brass-300 text-ink-900",
  greensheet: "bg-neutral-200 text-ink-700",
  indeterminate: "bg-sage-100 text-sage-800",
};

export function DispositionLedger({ partnerId }: { partnerId?: number }) {
  const { data: rows } = trpc.partners.dispositions.useQuery({ partnerId });

  return (
    <Card className="bg-paper-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scale className="h-4 w-4" aria-hidden />
          Exception dispositions
        </CardTitle>
        <p className="mt-1 text-xs text-neutral-500">
          How each exception was closed, who §B.2 found at fault, and what
          moved. A disposition where the claimed origin differs from the
          resolved one is a case where no proof was filed — the clause
          attributes it to the supplier by default.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Fault</TableHead>
                <TableHead className="text-right">Credit due</TableHead>
                <TableHead className="text-right">Supplier bears</TableHead>
                <TableHead>Decided</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.lotCode}
                    {r.childLotCode && (
                      <span className="block text-[11px] text-neutral-500">
                        → {r.childLotCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.dispositionLabel}
                    {r.capApplied && (
                      <span
                        className="ml-1 text-brass-700"
                        title="A contractual cap changed this figure (§C.1 or §C.2)."
                      >
                        capped
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px]",
                        FAULT_STYLE[r.faultOrigin] ??
                          "bg-neutral-200 text-ink-700"
                      )}
                      title={r.faultReason}
                    >
                      {r.faultLabel}
                    </span>
                    {r.claimedFaultOrigin !== r.faultOrigin && (
                      <span className="block text-[11px] text-oxblood-700">
                        claimed {r.claimedFaultOrigin}, no proof filed
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.creditDueCents ? usd(r.creditDueCents) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {r.supplierBorneCents ? usd(r.supplierBorneCents) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-neutral-500">
                    {new Date(r.decidedAt).toLocaleDateString()}
                    {r.noticeRequired && !r.noticeSentAt && (
                      <span className="block text-danger">
                        §C.3 notice due within 48h
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(rows ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-neutral-500">
                    No exception has been formally closed yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * §9 — the rights a partner holds against us.
 *
 * Deliberately rendered as a list of OUR obligations rather than their
 * complaints. §9.3 forbids retaliating against a partner who raises one, and
 * framing a dispute as a black mark on their record is the first step toward
 * exactly that.
 */
export function PartnerProtections({
  partnerId,
  proposedTier,
}: {
  partnerId: number;
  proposedTier?: string;
}) {
  const { data: check } = trpc.partners.retaliationCheck.useQuery(
    { partnerId, proposedTier: proposedTier ?? "unchanged" },
    { enabled: Boolean(partnerId) }
  );

  return (
    <Card className="bg-paper-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldQuestion className="h-4 w-4" aria-hidden />
          Fair dealing &amp; anti-squeeze (§9)
        </CardTitle>
        <p className="mt-1 text-xs text-neutral-500">
          Rights this partner holds against us. §9.1 gives them every scorecard
          behind a quality tier on request, an independent evaluation of any
          disputed score, and — if we miss a floor payment SLA by more than five
          business days — the right to sell future lots elsewhere without
          penalty.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {check?.openProtections === 0 ? (
          <p className="text-xs text-sage-600">
            Nothing outstanding. No open dispute, scorecard request or
            pass-through concern on file.
          </p>
        ) : (
          (check?.warnings ?? []).map(w => (
            <p
              key={w}
              className="flex items-start gap-1.5 rounded-md border border-brass-300 bg-paper-100 px-2 py-1.5 text-xs text-ink-700"
            >
              <AlertTriangle
                className="mt-0.5 h-3 w-3 shrink-0 text-oxblood-500"
                aria-hidden
              />
              <span>{w}</span>
            </p>
          ))
        )}
      </CardContent>
    </Card>
  );
}
