// Money rendering — §8.3.
//
// Two rules, enforced by making them the only convenient path:
//   · money is right-aligned and tabular-figured, so columns of figures scan
//     down cleanly and a misplaced digit is visible;
//   · a monetary value is NEVER rendered without its currency.
import { formatMinor, type Currency } from "@contracts/money";
import { cn } from "@/lib/utils";

export function Money({
  amountMinor,
  currency,
  className,
  muted = false,
  emphasis = false,
}: {
  amountMinor: bigint | number | string | null | undefined;
  currency: string;
  className?: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  if (amountMinor === null || amountMinor === undefined) {
    return (
      <span className={cn("tabular-nums text-muted-foreground", className)}>
        —
      </span>
    );
  }

  let rendered: string;
  try {
    rendered = formatMinor(amountMinor, currency);
  } catch {
    // An unrenderable amount must be visible as a problem, not as a blank cell.
    rendered = `?? ${currency}`;
  }

  const negative = String(amountMinor).startsWith("-");
  return (
    <span
      className={cn(
        "tabular-nums whitespace-nowrap",
        emphasis && "font-semibold",
        muted && "text-muted-foreground",
        negative && "text-destructive",
        className
      )}
      title={`${rendered} (${currency})`}
    >
      {rendered}
    </span>
  );
}

/** Right-aligned table cell content. Money lives in the right-hand column. */
export function MoneyCell(props: React.ComponentProps<typeof Money>) {
  return (
    <div className="text-right">
      <Money {...props} />
    </div>
  );
}

export type { Currency };
