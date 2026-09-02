// Museum Folio chart tokens — design-system/03 §7.1 + 02 palette.
// Categorical series order is binding: ink → oxblood → brass → danger → sage.
export const CHART = {
  ink: "#221E1B",
  inkSoft: "#58514B",
  oxblood: "#74362F",
  brass: "#947642",
  sage: "#4F6958",
  paper: "#F5F2EB",
  paperRaised: "#FAF9F4",
  hairline: "#D9D3C9",
  danger: "#B3261E",
  grid: "rgba(148,138,120,0.4)",
  series: ["#221E1B", "#74362F", "#947642", "#B3261E", "#4F6958", "#6B655E"],
} as const;

// Inverse tooltip styling shared by every recharts Tooltip on the page.
export const TOOLTIP_STYLE = {
  backgroundColor: CHART.ink,
  border: "none",
  borderRadius: 6,
  color: CHART.paper,
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
} as const;

// Sequential sage→brass scale for heatmap / cohort cells, t ∈ [0, 1].
export function sequentialScale(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const from = { r: 0x4f, g: 0x69, b: 0x58 }; // sage
  const to = { r: 0x94, g: 0x76, b: 0x42 }; // brass
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clamped);
  return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
}

// 5-stop churn-risk chip colors (design-system/03 §7.3) — number always shown.
export function riskChipColor(score: number): { bg: string; fg: string } {
  if (score >= 0.85) return { bg: CHART.danger, fg: "#fff" };
  if (score >= 0.7) return { bg: "#C4701B", fg: "#fff" }; // warning amber
  if (score >= 0.5) return { bg: CHART.brass, fg: "#fff" };
  if (score >= 0.3) return { bg: "#7B8E7F", fg: CHART.ink }; // sage light
  return { bg: CHART.sage, fg: "#fff" };
}
