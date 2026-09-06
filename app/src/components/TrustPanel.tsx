// Trust panel — spec §5.2.
//
// Three things stacked, in the order a reader needs them: what the score is,
// what it is made of, and what evidence is behind it. The component bars use
// the same recessed-track language as the cost/quality bars on a lot card, so a
// reader who has seen one already knows how to read this.
//
// Every bar has a description on hover. §7's rule that Trust never gates
// silently only works if a low component is explicable at the point someone
// notices it.
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  BAND_SPECS,
  COMPONENT_SPECS,
  TRUST_COMPONENTS,
  bandFor,
  type TrustComponent,
  type TrustEntityType,
} from "@contracts/trust";
import { TrustBadge, TrustBandLabel } from "./TrustBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";

/** Fill colour follows the band, so a weak component reads as weak at a glance. */
function fillFor(value: number): string {
  const band = bandFor(value);
  if (band === "sealed") return "bg-brass-500";
  if (band === "verified") return "bg-sage-600";
  if (band === "established") return "bg-oxblood-500";
  if (band === "provisional") return "bg-neutral-500";
  return "bg-danger";
}

function ComponentBar({
  component,
  value,
}: {
  component: TrustComponent;
  value: number;
}) {
  const spec = COMPONENT_SPECS[component];
  return (
    <div className="space-y-1" title={spec.description}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-700">{spec.label}</span>
        <span className="font-mono text-xs tabular-nums text-neutral-500">
          {value.toFixed(0)}
          <span className="ml-1 opacity-60">
            ×{(spec.weightBp / 100).toFixed(0)}%
          </span>
        </span>
      </div>
      {/* Recessed track, same geometry as the lot-card metric bars. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className={cn("h-full rounded-full transition-all", fillFor(value))}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function TrustPanel({
  entityType,
  entityId,
  onAddEvidence,
}: {
  entityType: TrustEntityType;
  entityId: number;
  onAddEvidence?: () => void;
}) {
  const utils = trpc.useUtils();
  const [showEvidence, setShowEvidence] = useState(true);

  const trust = trpc.trust.byEntity.useQuery({ entityType, entityId });
  const evidence = trpc.trust.evidence.useQuery({
    entityType,
    entityId,
    limit: 25,
  });
  const history = trpc.trust.history.useQuery({ entityType, entityId });

  const recalc = trpc.trust.recalculate.useMutation({
    onSuccess: () => {
      utils.trust.byEntity.invalidate();
      utils.trust.history.invalidate();
    },
  });

  const data = trust.data;
  const previous = history.data?.[0]?.previousScore ?? null;
  const delta = data && previous !== null ? data.score - previous : null;

  return (
    <Card className="bg-paper-50">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Trust</CardTitle>
          {data && (
            <div className="mt-2 flex items-end gap-3">
              <span className="font-mono text-3xl font-bold tabular-nums leading-none text-ink-900">
                {data.unscored ? "—" : data.score.toFixed(1)}
              </span>
              <div className="pb-0.5">
                {data.unscored ? (
                  <TrustBadge
                    score={null}
                    unscored
                    onAddEvidence={onAddEvidence}
                  />
                ) : (
                  <TrustBandLabel score={data.score} />
                )}
                {delta !== null && Math.abs(delta) >= 0.1 && (
                  <span
                    className={cn(
                      "ml-2 inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums",
                      delta > 0 ? "text-sage-600" : "text-danger"
                    )}
                  >
                    {delta > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          )}
          {data && (
            <p className="mt-1 text-[11px] text-brass-700">
              {data.unscored
                ? "No evidence recorded yet"
                : `Updated ${new Date(data.calculatedAt).toLocaleDateString()} · model ${data.modelVersion}`}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => recalc.mutate({ entityType, entityId })}
          disabled={recalc.isPending}
          title="Rebuild this score from its evidence. Deterministic — it cannot invent a number."
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {data && (
          <p className="rounded-md border border-neutral-200 bg-paper-100 px-3 py-2 text-xs text-ink-700">
            {data.bandEffect}
          </p>
        )}

        <div className="space-y-3">
          {TRUST_COMPONENTS.map(c => (
            <ComponentBar
              key={c}
              component={c}
              value={data?.components?.[c] ?? 50}
            />
          ))}
        </div>

        <div>
          <button
            type="button"
            className="text-xs font-medium text-ink-700 underline-offset-2 hover:underline"
            onClick={() => setShowEvidence(v => !v)}
          >
            {showEvidence ? "Hide" : "Show"} evidence (
            {evidence.data?.length ?? 0})
          </button>

          {showEvidence && (
            <ul className="mt-2 space-y-1">
              {(evidence.data ?? []).map(row => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-1 text-xs last:border-0"
                >
                  <span className="flex items-start gap-1.5 text-ink-700">
                    <FileText className="mt-0.5 h-3 w-3 shrink-0 text-neutral-500" />
                    <span>
                      {row.note || row.kind.replace(/_/g, " ")}
                      <span className="block text-[11px] text-neutral-500">
                        {new Date(row.occurredAt).toLocaleDateString()} ·{" "}
                        {COMPONENT_SPECS[row.component as TrustComponent]
                          ?.label ?? row.component}
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      Number(row.weight) < 0 ? "text-danger" : "text-sage-600"
                    )}
                  >
                    {Number(row.weight) > 0 ? "+" : ""}
                    {Number(row.weight).toFixed(1)}
                  </span>
                </li>
              ))}
              {(evidence.data ?? []).length === 0 && (
                <li className="text-xs text-neutral-500">
                  Nothing has been verified yet. Attach a lab report or a signed
                  contract to start building this score.
                </li>
              )}
            </ul>
          )}
        </div>

        {data && !data.unscored && (
          <p className="text-[11px] text-neutral-500">
            {BAND_SPECS[bandFor(data.score)].label} ·{" "}
            {data.acceptedDocumentCount} accepted document
            {data.acceptedDocumentCount === 1 ? "" : "s"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
