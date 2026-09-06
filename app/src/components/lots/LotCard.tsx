import { Check } from "lucide-react";
import { Link } from "react-router";
import { CupScoreBadge } from "@/components/ui/cup-score-badge";
import { MetricBar } from "@/components/ui/metric-bar";
import { cn } from "@/lib/utils";
import { formatCentsPerLb, formatCents } from "@contracts/constants";
import type { CoffeeLot } from "@db/schema";

export interface LotScores {
  composite: number;
  cost: number | null;
  quality: number | null;
  esg: number | null;
  logistics: number | null;
}

export function LotCard({
  lot,
  rank,
  scores,
  overBudget,
  showEdge,
}: {
  lot: CoffeeLot;
  rank: number;
  scores: LotScores;
  overBudget: boolean;
  showEdge: boolean;
}) {
  const chips = (lot.flavorNotes ?? "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 5);
  const availPct =
    lot.totalProductionLbs > 0 ? (lot.availableLbs / lot.totalProductionLbs) * 100 : 0;

  return (
    <article
      className={cn(
        "relative flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-e1 transition-shadow duration-base hover:shadow-e3 focus-within:ring-2 focus-within:ring-oxblood",
        overBudget && showEdge && "border-warning bg-warning/5",
      )}
    >
      {showEdge && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 w-1 rounded-l-lg",
            overBudget ? "bg-warning" : "bg-brass",
          )}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-caption font-semibold tabular-nums text-paper-50" aria-label={`Rank ${rank}`}>
            {rank}
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg leading-tight text-ink">{lot.name}</h2>
            <p className="truncate text-caption text-muted-foreground mt-0.5">
              {lot.origin}
              {lot.region ? ` · ${lot.region}` : ""}
              {lot.elevationMeters ? ` · ${lot.elevationMeters}m` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {overBudget && (
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-warning">Over budget</span>
          )}
          <CupScoreBadge score={lot.cupScore} size="md" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-recessed px-2.5 py-0.5 text-caption text-muted">{lot.processMethod}</span>
        {chips.map((chip) => (
          <span key={chip} className="rounded-full bg-paper-200 px-2.5 py-0.5 text-caption text-ink">
            {chip}
          </span>
        ))}
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-4">
        <div className="flex gap-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">$/lb</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-ink mt-0.5">
              {formatCentsPerLb(lot.pricePerLbCents)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Available</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-ink mt-0.5">
              {lot.availableLbs.toLocaleString()} lbs
              <span className="text-muted-foreground"> ({availPct.toFixed(0)}%)</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-2xl font-bold leading-none tabular-nums text-ink">
            {scores.composite.toFixed(0)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted">Score</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <MetricBar label="Cost" value={scores.cost} />
        <MetricBar label="Quality (cup)" value={scores.quality} />
        <MetricBar label="ESG" value={scores.esg} pending={scores.esg == null} />
        <MetricBar label="Logistics" value={scores.logistics} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-caption text-muted-foreground">
          Est. margin{" "}
          <span className="font-mono tabular-nums text-ink">
            {formatCents(lot.pricePerLbCents - lot.costPerLbCents)} /lb
          </span>
        </p>
        <Link
          to="/catalog"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-oxblood px-4 text-sm font-semibold text-paper-50 shadow-e1 transition-colors duration-fast hover:bg-oxblood-800 focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Source this lot
        </Link>
      </div>
    </article>
  );
}