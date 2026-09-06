// Aging bucket bar — §8.3.
//
// A stacked proportional bar per counterparty. The point of the visual is that
// the shape of a receivable is legible before any number is read: a bar that is
// mostly right-hand colour is a collections problem regardless of its total.
import { Money } from "@/components/Money";
import { cn } from "@/lib/utils";

export type AgingRowView = {
  counterpartyId: number;
  counterpartyName: string;
  currency: string;
  current: bigint;
  b30: bigint;
  b60: bigint;
  b90: bigint;
  b90plus: bigint;
  total: bigint;
};

// Museum Folio palette (design-system/02-design-tokens.md): sage for current,
// brass through oxblood as the balance ages. No new colours introduced.
const BUCKETS = [
  { key: "current", label: "Current", className: "bg-[#4F6958]" },
  { key: "b30", label: "1–30", className: "bg-[#947642]" },
  { key: "b60", label: "31–60", className: "bg-[#B0642F]" },
  { key: "b90", label: "61–90", className: "bg-[#8C2F22]" },
  { key: "b90plus", label: "90+", className: "bg-[#5E2B25]" },
] as const;

export function AgingLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {BUCKETS.map(b => (
        <span key={b.key} className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-2.5 w-2.5 rounded-sm", b.className)}
            aria-hidden
          />
          {b.label}
        </span>
      ))}
      <span className="ml-auto">days past due · Asia/Ho_Chi_Minh</span>
    </div>
  );
}

export function AgingBucketBar({ row }: { row: AgingRowView }) {
  const total = row.total > 0n ? row.total : 1n;
  const pct = (v: bigint) => Number((v * 10000n) / total) / 100;

  return (
    <div className="space-y-1.5">
      <div
        className="flex h-3 w-full overflow-hidden rounded-sm bg-muted"
        role="img"
        aria-label={BUCKETS.map(
          b => `${b.label}: ${row[b.key]} ${row.currency}`
        ).join("; ")}
      >
        {BUCKETS.map(b => {
          const value = row[b.key];
          if (value <= 0n) return null;
          return (
            <div
              key={b.key}
              className={cn(b.className, "h-full")}
              style={{ width: `${pct(value)}%` }}
              title={`${b.label} days · ${value} ${row.currency}`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-2 text-xs">
        {BUCKETS.map(b => (
          <div key={b.key} className="text-right">
            <div className="text-muted-foreground">{b.label}</div>
            <Money
              amountMinor={row[b.key]}
              currency={row.currency}
              muted={row[b.key] === 0n}
              className="text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
