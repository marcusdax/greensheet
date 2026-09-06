import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Thin QoS-style bar. Value is 0–100. Where no data exists, render the empty
// track with a "—" so the ledger visibly does not guess.
export function MetricBar({
  label,
  value,
  suffix,
  pending,
  className,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  pending?: boolean;
  className?: string;
}) {
  const [w, setW] = useState(0);
  const shown = useRef(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      shown.current = true;
      setW(value ?? 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const filled = pending ? false : value != null;

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-ink">
          {filled ? `${(value as number).toFixed(0)}${suffix ?? "%"}` : "—"}
        </span>
      </div>
      <div
        className="h-[6px] w-full overflow-hidden rounded-full bg-recessed"
        role="meter"
        aria-label={label}
        aria-valuenow={filled ? Math.round(value as number) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-slower ease-out",
            value != null && value >= 75 && "bg-sage",
            value != null && value >= 40 && value < 75 && "bg-brass",
            value != null && value < 40 && "bg-oxblood",
            pending && "w-full animate-pulse bg-recessed",
          )}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}