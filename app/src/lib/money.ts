// Integer-cents → USD string. All money flows through the ledger as integer
// cents; never format a price inline.
export function money(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}