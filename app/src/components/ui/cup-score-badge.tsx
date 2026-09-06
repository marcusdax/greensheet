import { cn } from "@/lib/utils";

// CQI cup-score tiers — design-system/03 §2.1. Always one decimal: the tenth is
// traded information. Never render a score without its tier treatment.
const TIERS = [
  { min: 90, cls: "bg-brass-300 text-ink", label: "Outstanding" },
  { min: 85, cls: "bg-oxblood text-white", label: "Excellent" },
  { min: 80, cls: "bg-sage text-white", label: "Very Good" },
  { min: 0, cls: "bg-neutral-700 text-white", label: "Below specialty" },
] as const;

export function CupScoreBadge({
  score,
  size = "sm",
  className,
}: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return (
    <span
      title={`CQI cup score ${score.toFixed(1)} — ${tier.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono font-bold tabular-nums",
        size === "md" ? "h-7 px-3 text-sm" : "h-6 px-2.5 text-caption",
        tier.cls,
        className,
      )}
    >
      {score >= 90 && (
        <span className="h-[9px] w-[3px] rounded-full bg-ink/80" aria-hidden="true" />
      )}
      {score.toFixed(1)}
    </span>
  );
}