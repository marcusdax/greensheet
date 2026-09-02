// Trust badge — spec §5.1.
//
// The one rule this component enforces by construction: a score is never
// rendered without its band. A bare "68" tells a buyer nothing, and the way to
// guarantee the band always travels with it is to make the number impossible to
// render on its own.
//
// Colours come exclusively from BAND_SPECS in contracts/trust.ts, so the band a
// policy check reads and the colour a buyer sees can never disagree.
import { BAND_SPECS, bandFor, type TrustBand } from "@contracts/trust";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export type TrustBadgeProps = {
  score: number | null | undefined;
  /** Shown in the tooltip. §5.1 wants the evidence count on the hover. */
  evidenceCount?: number;
  modelVersion?: string;
  size?: "sm" | "md";
  /** True when nothing has been calculated yet — §5.5's "Add evidence" case. */
  unscored?: boolean;
  onAddEvidence?: () => void;
  className?: string;
};

export function TrustBadge({
  score,
  evidenceCount,
  modelVersion,
  size = "sm",
  unscored = false,
  onAddEvidence,
  className,
}: TrustBadgeProps) {
  // §5.5 — "if document density is zero, show a quiet 'Add evidence' text link
  // instead of a zero score". A zero would read as a judgement; the truth is
  // that we have not looked.
  if (unscored || score === null || score === undefined) {
    return onAddEvidence ? (
      <button
        type="button"
        onClick={onAddEvidence}
        className={cn(
          "text-xs font-medium text-oxblood-500 underline-offset-2 hover:underline",
          className
        )}
      >
        Add evidence
      </button>
    ) : (
      <span className={cn("text-xs text-neutral-500", className)}>
        Not yet verified
      </span>
    );
  }

  const band: TrustBand = bandFor(score);
  const spec = BAND_SPECS[band];
  const shown = score.toFixed(score % 1 === 0 ? 0 : 1);

  const title = [
    `Trust Score ${shown} — ${spec.label}`,
    evidenceCount === undefined
      ? null
      : `${evidenceCount} accepted document${evidenceCount === 1 ? "" : "s"}`,
    modelVersion ? `model ${modelVersion}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-mono font-bold tabular-nums",
        size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
        spec.className,
        className
      )}
    >
      {/* The seal is earned: only the top band gets a glyph, the same way an
          Outstanding cup score is the only one that gets brass. */}
      {band === "sealed" && <ShieldCheck className="h-3 w-3" aria-hidden />}
      {shown}
      <span className="font-sans font-medium opacity-80">{spec.label}</span>
    </span>
  );
}

/**
 * The band label on its own, for places that already show the number in a
 * larger typographic role (the panel header) and would otherwise repeat it.
 */
export function TrustBandLabel({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const spec = BAND_SPECS[bandFor(score)];
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500",
        className
      )}
    >
      {spec.label}
    </span>
  );
}
