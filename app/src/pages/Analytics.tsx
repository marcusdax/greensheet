import { Fragment } from "react";
import { trpc } from "@/providers/trpc";
import Layout, { PageHeader, money } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CHART, TOOLTIP_STYLE, riskChipColor, sequentialScale } from "@/lib/chartTokens";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Link } from "react-router";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const utils = trpc.useUtils();
  const { data: heatmap } = trpc.analytics.demandHeatmap.useQuery();
  const { data: cohorts } = trpc.analytics.retentionCohorts.useQuery();
  const { data: loyalty } = trpc.analytics.lotLoyalty.useQuery();
  const { data: watchlist } = trpc.analytics.churnWatchlist.useQuery();

  const rescore = trpc.crm.rescoreChurn.useMutation({
    onSuccess: () => {
      utils.analytics.churnWatchlist.invalidate();
      utils.crm.list.invalidate();
      toast.success("Hazards re-scored — crm.churn_risk_detected emitted where thresholds tripped");
    },
    onError: (e) => toast.error(e.message),
  });

  const heatCells = new Map((heatmap?.cells ?? []).map((c) => [`${c.dow}:${c.hour}`, c]));
  const maxOrders = Math.max(1, heatmap?.maxOrders ?? 1);

  const sortedLoyalty = [...(loyalty ?? [])].sort((a, b) => b.totalLbs - a.totalLbs);
  const medianVolume = medianOf(sortedLoyalty.map((l) => l.totalLbs));
  const medianReorder = medianOf(sortedLoyalty.map((l) => l.reorderRate));
  const bestLot = [...(loyalty ?? [])].sort((a, b) => b.reorderRate - a.reorderRate)[0];

  return (
    <Layout>
      <PageHeader
        title="Intelligence"
        sub="Demand rhythm, retention cohorts, lot loyalty, and churn hazards — read from the order ledger"
        actions={
          <Button variant="outline" onClick={() => rescore.mutate()} disabled={rescore.isPending}>
            <RefreshCcw className="h-4 w-4 mr-1" />
            {rescore.isPending ? "Re-scoring…" : "Re-score hazards"}
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Median repurchase"
          value={
            cohorts?.medianRepurchaseDays != null
              ? `${Math.round(cohorts.medianRepurchaseDays)}d`
              : "—"
          }
          sub="between consecutive orders"
        />
        <KpiCard
          label="Tracked cohorts"
          value={String(cohorts?.cohorts.length ?? "—")}
          sub="by first-order ISO week"
        />
        <KpiCard
          label="At-risk roasters"
          value={String(watchlist?.length ?? "—")}
          sub="30d inactive or hazard ≥ 0.70"
        />
        <KpiCard
          label="Best loyalty lot"
          value={bestLot ? `${Math.round(bestLot.reorderRate * 100)}%` : "—"}
          sub={bestLot?.lotName ?? "no reorder data yet"}
        />
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        {/* ── Temporal demand heatmap ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Demand rhythm — orders by weekday × hour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid gap-[3px]" style={{ gridTemplateColumns: `44px repeat(24, minmax(14px, 1fr))` }}>
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-[9px] font-mono text-muted-foreground text-center">
                    {h % 6 === 0 ? h : ""}
                  </div>
                ))}
                {DOW_LABELS.map((label, dow) => (
                  <Fragment key={label}>
                    <div className="text-[10px] font-mono text-muted-foreground pr-1 flex items-center">
                      {label}
                    </div>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = heatCells.get(`${dow}:${hour}`);
                      const t = (cell?.orders ?? 0) / maxOrders;
                      return (
                        <div
                          key={`${dow}-${hour}`}
                          title={
                            cell
                              ? `${label} ${hour}:00 — ${cell.orders} orders · ${money(cell.revenueCents)}`
                              : `${label} ${hour}:00 — quiet`
                          }
                          className="aspect-square rounded-[2px]"
                          style={{
                            backgroundColor: cell ? sequentialScale(t) : "rgba(148,138,120,0.12)",
                          }}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Quiet stretches are the safe maintenance windows; the hottest cells set staffing and
              inventory release timing.
            </p>
          </CardContent>
        </Card>

        {/* ── Retention cohort grid ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Retention cohorts — active buyers by week since first order</CardTitle>
          </CardHeader>
          <CardContent>
            {cohorts?.cohorts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-normal pb-2 pr-2">Cohort</th>
                      <th className="text-right font-normal pb-2 pr-3">Size</th>
                      {Array.from({ length: 8 }, (_, i) => (
                        <th key={i} className="font-normal pb-2 px-1 text-center">
                          W+{i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.cohorts.map((c) => (
                      <tr key={c.cohortWeek}>
                        <td className="pr-2 py-[3px] whitespace-nowrap">{c.cohortWeek}</td>
                        <td className="text-right pr-3 text-muted-foreground">{c.size}</td>
                        {c.cells.map((cell) => (
                          <td key={cell.offset} className="px-[2px] py-[3px]">
                            <div
                              className="rounded-[2px] text-center py-1"
                              title={`${cell.activeCount}/${c.size} active`}
                              style={
                                cell.activeCount > 0
                                  ? { backgroundColor: sequentialScale(cell.pct), color: "#fff" }
                                  : { backgroundColor: "rgba(148,138,120,0.12)", color: "inherit" }
                              }
                            >
                              {cell.activeCount > 0 ? `${Math.round(cell.pct * 100)}%` : "·"}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6">No orders yet — cohorts appear after first purchases.</p>
            )}
          </CardContent>
        </Card>

        {/* ── Lot loyalty matrix ──────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lot loyalty matrix — volume × reorder rate</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedLoyalty.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid horizontal vertical={false} strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis
                    type="number"
                    dataKey="totalLbs"
                    name="Volume"
                    tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: CHART.inkSoft }}
                    tickFormatter={(v: number) => `${v.toLocaleString()} lb`}
                    stroke={CHART.hairline}
                  />
                  <YAxis
                    type="number"
                    dataKey="reorderRate"
                    name="Reorder rate"
                    domain={[0, 1]}
                    tick={{ fontSize: 11, fontFamily: "ui-monospace, monospace", fill: CHART.inkSoft }}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    stroke={CHART.hairline}
                  />
                  <ZAxis type="number" dataKey="revenueCents" range={[60, 400]} name="Revenue" />
                  {medianVolume != null && (
                    <ReferenceLine x={medianVolume} stroke={CHART.hairline} strokeDasharray="4 4" />
                  )}
                  {medianReorder != null && (
                    <ReferenceLine y={medianReorder} stroke={CHART.hairline} strokeDasharray="4 4" />
                  )}
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(value: number, name: string) =>
                      name === "Reorder rate"
                        ? [`${Math.round(value * 100)}%`, name]
                        : name === "Revenue"
                          ? [money(value), name]
                          : [`${value.toLocaleString()} lb`, name]
                    }
                    labelFormatter={() => ""}
                  />
                  <Scatter data={sortedLoyalty} fill={CHART.ink} fillOpacity={0.85} name="Lots" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-6">No order lines yet.</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Top-right lots (high volume, high reorder) anchor the catalog; bubble size is revenue.
            </p>
          </CardContent>
        </Card>

        {/* ── Churn watchlist ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Churn watchlist — 30d inactive or hazard ≥ threshold</CardTitle>
          </CardHeader>
          <CardContent>
            {watchlist?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roaster</TableHead>
                    <TableHead>Hazard</TableHead>
                    <TableHead className="text-right">Inactive</TableHead>
                    <TableHead className="text-right">LTV</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((r) => {
                    const chip = riskChipColor(r.churnRiskScore);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.roasterName}</div>
                          <div className="text-[11px] text-muted-foreground">{r.lifecycleStatus}</div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-block rounded px-2 py-0.5 text-[11px] font-mono"
                            style={{ backgroundColor: chip.bg, color: chip.fg }}
                          >
                            {r.churnRiskScore.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {r.daysInactive != null ? `${r.daysInactive}d` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{money(r.ltvCents)}</TableCell>
                        <TableCell className="text-right">
                          <Link to="/crm" className="text-xs underline text-muted-foreground hover:text-foreground">
                            Open in CRM
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-6">
                Nobody on the watchlist — either healthy, or hazards need a re-score.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
