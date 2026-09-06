// Cupper standing — SOP §1.1 and §1.3.
//
// The question this component answers is "may this person cup, and if not
// why?", because that is the question the QC gate will answer at the moment
// somebody tries. Showing a tier without showing standing would let a screen
// say "Q-Grader" about someone the system will refuse.
//
// Museum Folio tokens only; the token test covers this file.
import { TIER_SPECS, type CupperTier } from "@contracts/cupping-authority";
import { cn } from "@/lib/utils";
import { Award, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

/** Standing, not tier: a lapsed Q-Grader is red however senior they are. */
const STANDING_STYLE = {
  healthy: "bg-sage-600 text-white",
  watch: "bg-brass-300 text-ink-900",
  disqualified: "bg-danger text-white",
  unrated: "bg-neutral-200 text-ink-700",
} as const;

export type CupperCardProps = {
  fullName: string;
  tier: CupperTier;
  tierLabel: string;
  performance: "healthy" | "watch" | "disqualified" | "unrated";
  observedVariance: number | null;
  supervisedCups: number;
  totalCups: number;
  inGoodStanding: boolean;
  blockers: string[];
  daysUntilRecertification: number | null;
  daysUntilLicenceExpiry: number | null;
  onSelect?: () => void;
};

export function CupperCard(props: CupperCardProps) {
  const spec = TIER_SPECS[props.tier];
  const band = spec.accuracyBand;
  const recertSoon =
    props.daysUntilRecertification !== null &&
    props.daysUntilRecertification >= 0 &&
    props.daysUntilRecertification <= 30;

  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cn(
        "w-full rounded-md border border-neutral-200 bg-paper-50 p-4 text-left transition-colors hover:bg-paper-100",
        !props.inGoodStanding && "border-danger/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-ink-900">
            {props.fullName}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
            {props.tier === "tier_1" && (
              <Award className="h-3 w-3" aria-hidden />
            )}
            {props.tierLabel}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums",
            STANDING_STYLE[props.performance]
          )}
          title={
            band === null
              ? "This tier is not scored independently (§1.1)."
              : `Tier band is ±${band} points (§1.1); §1.3 disqualifies above ±3.`
          }
        >
          {props.observedVariance === null
            ? "no data"
            : `±${props.observedVariance.toFixed(1)}`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-neutral-500">
        <span>{props.totalCups.toLocaleString()} cups</span>
        {spec.supervisedCupsRequired > 0 && (
          <span
            className={
              props.supervisedCups < spec.supervisedCupsRequired
                ? "text-oxblood-700"
                : undefined
            }
          >
            {props.supervisedCups}/{spec.supervisedCupsRequired} supervised
          </span>
        )}
        {props.daysUntilLicenceExpiry !== null && (
          <span
            className={
              props.daysUntilLicenceExpiry < 0 ? "text-danger" : undefined
            }
          >
            licence{" "}
            {props.daysUntilLicenceExpiry < 0
              ? "expired"
              : `${props.daysUntilLicenceExpiry}d`}
          </span>
        )}
      </div>

      {props.inGoodStanding ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-sage-600">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Clear for {spec.label.toLowerCase()} authority
          {recertSoon && (
            <span className="ml-1 text-brass-700">
              · recertify in {props.daysUntilRecertification}d
            </span>
          )}
        </p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {props.blockers.map(b => (
            <li key={b} className="flex items-start gap-1 text-xs text-danger">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

/** The §1.3 header strip: how many cuppers can actually work today. */
export function CupperRosterSummary({
  total,
  clear,
  qGraders,
}: {
  total: number;
  clear: number;
  qGraders: number;
}) {
  // §1.1 — "Minimum 2 Q-Graders on staff (redundancy; one can verify the
  // other's cups)". Below two, arbitration cupping has no second opinion.
  const redundancyMet = qGraders >= 2;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-neutral-200 bg-paper-100 px-4 py-3">
      <span className="font-mono text-2xl font-bold tabular-nums text-ink-900">
        {clear}
        <span className="text-base text-neutral-500">/{total}</span>
      </span>
      <span className="text-xs text-ink-700">cleared to cup today</span>
      <span
        className={cn(
          "ml-auto flex items-center gap-1 text-xs",
          redundancyMet ? "text-sage-600" : "text-danger"
        )}
      >
        {redundancyMet ? (
          <CheckCircle2 className="h-3 w-3" aria-hidden />
        ) : (
          <Clock className="h-3 w-3" aria-hidden />
        )}
        {qGraders} Q-Grader{qGraders === 1 ? "" : "s"} in good standing
        {!redundancyMet && " — §1.1 requires two for redundancy"}
      </span>
    </div>
  );
}
