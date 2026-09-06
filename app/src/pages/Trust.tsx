// Trust — the counterparty honesty register. Spec §4.1, §5.2.
//
// This is the "Counterparty / Supplier profile" entry point: pick a party, see
// what stands behind them, and attach the document that would move it. The
// panel and the scanner sit on the same screen deliberately — §4.1 puts the
// upload where the commercial decision is made, not in a separate filing area.
import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustPanel } from "@/components/TrustPanel";
import { useFlags } from "@/hooks/useFlags";
import { BadgeCheck, ScanLine, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";

export default function Trust() {
  const navigate = useNavigate();
  const { flags } = useFlags();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);

  const parties = trpc.invoices.counterparties.useQuery({ search });
  const model = trpc.trust.model.useQuery();

  const rows = parties.data ?? [];
  const active = selected ?? rows[0]?.id ?? null;

  return (
    <Layout>
      <PageHeader
        title="Trust"
        sub="How much evidence stands behind each counterparty — and what would move it."
      />

      {!flags.trustScore && (
        <p className="mb-4 rounded-md border border-brass-300 bg-paper-100 px-3 py-2 text-xs text-ink-700">
          Trust scoring is turned off. Existing evidence is preserved and scores
          are still readable, but nothing new is being recorded.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] items-start">
        <Card>
          <CardHeader>
            <CardTitle>Counterparties</CardTitle>
            <div className="pt-2">
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Trust</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(party => (
                  <TableRow
                    key={party.id}
                    onClick={() => setSelected(party.id)}
                    className={
                      party.id === active
                        ? "cursor-pointer bg-paper-100"
                        : "cursor-pointer"
                    }
                  >
                    <TableCell className="font-medium">{party.name}</TableCell>
                    <TableCell className="text-xs text-neutral-500">
                      {party.type} · {party.country}
                    </TableCell>
                    <TableCell>
                      <CounterpartyTrustCell counterpartyId={party.id} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={e => {
                          e.stopPropagation();
                          setVerifying(party.id);
                        }}
                      >
                        <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                        Verify identity
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-neutral-500">
                      No counterparties match that search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {active ? (
            <TrustPanel
              entityType="counterparty"
              entityId={active}
              onAddEvidence={() => navigate("/intake")}
            />
          ) : (
            <Card className="bg-paper-50">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <ShieldQuestion className="h-8 w-8 text-neutral-500" />
                <p className="text-sm text-neutral-500">
                  Select a counterparty to see what stands behind them.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-paper-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Add evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-neutral-500">
                A lab report or a signed contract moves Document Verification
                the moment a person accepts the extraction. An upload nobody
                accepts moves nothing at all.
              </p>
              <Button variant="outline" onClick={() => navigate("/intake")}>
                <ScanLine className="mr-2 h-4 w-4" />
                Scan a document
              </Button>
            </CardContent>
          </Card>

          {model.data && (
            <Card className="bg-paper-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  How this is calculated · {model.data.modelVersion}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-ink-700">
                  {model.data.components.map(c => (
                    <li key={c.key} className="flex justify-between gap-2">
                      <span>{c.label}</span>
                      <span className="font-mono tabular-nums text-neutral-500">
                        {(c.weightBp / 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <VerifyIdentityDialog
        counterpartyId={verifying}
        onClose={() => setVerifying(null)}
      />
    </Layout>
  );
}

/** The badge in the list — one query per row, cached by tRPC across renders. */
function CounterpartyTrustCell({ counterpartyId }: { counterpartyId: number }) {
  const { data } = trpc.trust.byEntity.useQuery({
    entityType: "counterparty",
    entityId: counterpartyId,
  });
  return (
    <TrustBadge
      score={data?.score ?? null}
      unscored={data?.unscored ?? true}
      evidenceCount={data?.acceptedDocumentCount}
      modelVersion={data?.modelVersion}
    />
  );
}

/**
 * Identity verification is a claim a person makes on the platform's behalf, so
 * it asks what was actually checked. "Verified" with no note is exactly the
 * kind of self-reported assertion the Trust model exists to refuse.
 */
function VerifyIdentityDialog({
  counterpartyId,
  onClose,
}: {
  counterpartyId: number | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();
  const verify = trpc.trust.verifyIdentity.useMutation({
    onSuccess: res => {
      toast.success(`Identity verified — Trust is now ${res.score.toFixed(1)}`);
      utils.trust.byEntity.invalidate();
      utils.trust.evidence.invalidate();
      setNote("");
      onClose();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog
      open={counterpartyId !== null}
      onOpenChange={open => !open && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify identity</DialogTitle>
          <DialogDescription>
            Record what you actually checked. This writes an evidence row with
            your name on it and moves Identity &amp; Longevity.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="verify-note">What was verified</Label>
          <Input
            id="verify-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. business registration 0312345678 checked against the NBRS"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              counterpartyId !== null && verify.mutate({ counterpartyId, note })
            }
            disabled={note.trim().length < 3 || verify.isPending}
          >
            {verify.isPending ? "Recording…" : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
