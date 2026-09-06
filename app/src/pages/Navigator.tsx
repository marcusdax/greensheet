import { useReducer, useMemo } from "react";
import { Search, SlidersHorizontal, X, Filter } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { LotCard, type LotScores } from "@/components/lots/LotCard";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import type { CoffeeLot } from "@db/schema";

type GoalId = "balanced" | "cost" | "quality" | "esg" | "stability";

interface GoalDef {
  label: string;
  sub: string;
  weights: { cost: number; cup: number; esg: number; logistics: number };
}

const GOALS: Record<GoalId, GoalDef> = {
  balanced: {
    label: "Balanced",
    sub: "Weighted across all four rubrics",
    weights: { cost: 0.25, cup: 0.35, esg: 0.2, logistics: 0.2 },
  },
  cost: {
    label: "Cost-driven",
    sub: "Ignore premium landmarks",
    weights: { cost: 0.6, cup: 0.25, esg: 0.05, logistics: 0.1 },
  },
  quality: {
    label: "Quality-first",
    sub: "Chase exceptional cups",
    weights: { cost: 0.1, cup: 0.7, esg: 0.1, logistics: 0.1 },
  },
  esg: {
    label: "ESG-first",
    sub: "Prioritize verified claims",
    weights: { cost: 0.15, cup: 0.2, esg: 0.5, logistics: 0.15 },
  },
  stability: {
    label: "Stability",
    sub: "Reliable, predictable supply",
    weights: { cost: 0.2, cup: 0.25, esg: 0.15, logistics: 0.4 },
  },
};

interface State {
  goal: GoalId;
  budget: number; // dollars / lb ceiling
  includeOutOfBudget: boolean;
  sortOrder: "weighted" | "price" | "cup" | "esg";
  query: string;
  origins: string[];
  processes: string[];
  minCupScore: number | null;
}

const initialState: State = {
  goal: "balanced",
  budget: 6.5,
  includeOutOfBudget: false,
  sortOrder: "weighted",
  query: "",
  origins: [],
  processes: [],
  minCupScore: null,
};

type Action =
  | { type: "SET_GOAL"; goal: State["goal"] }
  | { type: "SET_BUDGET"; value: number }
  | { type: "TOGGLE_OVER_BUDGET" }
  | { type: "SET_SORT_ORDER"; order: State["sortOrder"] }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "TOGGLE_ORIGIN"; origin: string }
  | { type: "TOGGLE_PROCESS"; process: string }
  | { type: "SET_MIN_CUP_SCORE"; value: number | null }
  | { type: "RESET_FILTERS" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_GOAL":
      return { ...state, goal: action.goal };
    case "SET_BUDGET":
      return { ...state, budget: action.value };
    case "TOGGLE_OVER_BUDGET":
      return { ...state, includeOutOfBudget: !state.includeOutOfBudget };
    case "SET_SORT_ORDER":
      return { ...state, sortOrder: action.order };
    case "SET_SEARCH_QUERY":
      return { ...state, query: action.query };
    case "TOGGLE_ORIGIN":
      return {
        ...state,
        origins: state.origins.includes(action.origin)
          ? state.origins.filter((o) => o !== action.origin)
          : [...state.origins, action.origin],
      };
    case "TOGGLE_PROCESS":
      return {
        ...state,
        processes: state.processes.includes(action.process)
          ? state.processes.filter((p) => p !== action.process)
          : [...state.processes, action.process],
      };
    case "SET_MIN_CUP_SCORE":
      return { ...state, minCupScore: action.value };
    case "RESET_FILTERS":
      return { ...initialState, query: state.query };
    default:
      return state;
  }
}

const CUP_MIN_STEPS = [null, 80, 82, 84, 86, 88, 90];

function norm(score: number, min: number, max: number) {
  if (max <= min) return 100;
  return Math.max(0, Math.min(100, ((score - min) / (max - min)) * 100));
}

interface Scored {
  lot: CoffeeLot;
  scores: LotScores;
  overBudget: boolean;
}

export default function Navigator() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { data: lots, isLoading } = trpc.catalog.list.useQuery();

  const origins = useMemo(
    () => Array.from(new Set((lots ?? []).map((l) => l.origin))).sort(),
    [lots],
  );
  const processes = useMemo(
    () => Array.from(new Set((lots ?? []).map((l) => l.processMethod))).sort(),
    [lots],
  );
  const prices = useMemo(
    () => (lots ?? []).map((l) => l.pricePerLbCents),
    [lots],
  );
  const priceLow = useMemo(() => (prices.length ? Math.min(...prices) : 0), [prices]);
  const priceHigh = useMemo(() => (prices.length ? Math.max(...prices) : 0), [prices]);

  const visible = useMemo(() => {
    const source = lots ?? [];
    const q = state.query.trim().toLowerCase();
    return source.filter((lot) => {
      if (lot.status !== "active") return false;
      if (!state.includeOutOfBudget && (lot.pricePerLbCents / 100) > state.budget) return false;
      if (state.origins.length && !state.origins.includes(lot.origin)) return false;
      if (state.processes.length && !state.processes.includes(lot.processMethod)) return false;
      if (state.minCupScore != null && lot.cupScore < state.minCupScore) return false;
      if (q && !`${lot.name} ${lot.origin} ${lot.region} ${lot.flavorNotes ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [
    lots,
    state.budget,
    state.includeOutOfBudget,
    state.origins,
    state.processes,
    state.minCupScore,
    state.query,
  ]);

  const scored: Scored[] = useMemo(() => {
    const maxPrice = Math.max(priceHigh, 1);
    const minPrice = Math.min(priceLow, maxPrice);
    const cupMin = 70;
    const cupMax = 95;
    const hasEsg = scoreForEsg(); // [] — no ESG columns in the ledger yet

    return visible.map((lot) => {
      const cost =
        norm(maxPrice - lot.pricePerLbCents, 0, Math.max(maxPrice - minPrice, 1));
      const quality = norm(lot.cupScore, cupMin, cupMax);
      const esg = hasEsg.find((id) => id === lot.id) ? 0 : null;
      const logistics =
        lot.totalProductionLbs > 0
          ? norm((lot.availableLbs / lot.totalProductionLbs) * 100, 0, 100)
          : null;

      const w = GOALS[state.goal].weights;
      const present: [number, number | null][] = [
        [w.cost, cost],
        [w.cup, quality],
        [w.esg, esg],
        [w.logistics, logistics],
      ];
      const sumWeight = present.reduce((acc, [weight, val]) => acc + (val == null ? 0 : weight), 0);
      const composite =
        sumWeight > 0
          ? present.reduce((acc, [weight, val]) => acc + (val == null ? 0 : weight * val), 0) / sumWeight
          : 0;

      return {
        lot,
        overBudget: (lot.pricePerLbCents / 100) > state.budget,
        scores: { composite, cost, quality, esg, logistics },
      };
    });
  }, [visible, state.goal, state.budget, priceHigh, priceLow]);

  const ranked = useMemo(() => {
    const sorted = [...scored];
    switch (state.sortOrder) {
      case "price":
        sorted.sort((a, b) => a.lot.pricePerLbCents - b.lot.pricePerLbCents);
        break;
      case "cup":
        sorted.sort((a, b) => b.lot.cupScore - a.lot.cupScore);
        break;
      case "esg":
        sorted.sort((a, b) => (b.scores.esg ?? b.scores.quality ?? 0) - (a.scores.esg ?? a.scores.quality ?? 0));
        break;
      default:
        sorted.sort((a, b) => b.scores.composite - a.scores.composite);
    }
    return sorted;
  }, [scored, state.sortOrder]);

  const filtersActive =
    (state.includeOutOfBudget ? 1 : 0) +
    state.origins.length +
    state.processes.length +
    (state.minCupScore != null ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Navigator"
        overline="Auctum · Source"
        sub="Rank live lots against your buying strategy. Every bar is ledger-verified — if a rubric has no data, it stays empty."
      />

      {/* Goal profile + budget row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div role="radiogroup" aria-label="Buying goal" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(GOALS) as GoalId[]).map((id) => {
            const goal = GOALS[id];
            const active = state.goal === id;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={active}
                onClick={() => dispatch({ type: "SET_GOAL", goal: id })}
                className={cn(
                  "relative rounded-lg border p-3 text-left transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:outline-none",
                  active
                    ? "border-oxblood bg-oxblood text-paper-50 shadow-e2"
                    : "border-border bg-surface hover:border-neutral-500",
                )}
              >
                {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-brass" aria-hidden="true" />}
                <span className="text-sm font-semibold">{goal.label}</span>
                <span className={cn("mt-1 block text-[11px] leading-snug", active ? "text-paper-50/80" : "text-muted")}>
                  {goal.sub}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 no-print">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="budget" className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Budget /lb
            </label>
            <span className="font-mono text-lg font-bold tabular-nums text-ink">${state.budget.toFixed(2)}</span>
          </div>
          <input
            id="budget"
            type="range"
            min={3}
            max={45}
            step={0.5}
            value={state.budget}
            onChange={(e) => dispatch({ type: "SET_BUDGET", value: Number(e.target.value) })}
            className="mt-3 w-full accent-oxblood"
          />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={state.includeOutOfBudget}
              onChange={() => dispatch({ type: "TOGGLE_OVER_BUDGET" })}
              className="h-4 w-4 accent-oxblood"
            />
            <span>
              Show over-budget lots
              <span className="block text-caption text-muted-foreground">Flagged amber with a warning chip</span>
            </span>
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={state.query}
            onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })}
            placeholder="Search lots, origins, regions…"
            className="h-10 w-full rounded-md border border-neutral-300 bg-background pl-9 pr-3 text-sm text-ink outline-none focus-visible:border-oxblood focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:ring-offset-1"
          />
        </div>

        <select
          value={state.sortOrder}
          onChange={(e) => dispatch({ type: "SET_SORT_ORDER", order: e.target.value as State["sortOrder"] })}
          className="h-10 rounded-md border border-neutral-300 bg-background px-3 text-sm text-ink outline-none focus-visible:border-oxblood"
          aria-label="Sort lots"
        >
          <option value="weighted">Sort: weighted score</option>
          <option value="price">Sort: price, low → high</option>
          <option value="cup">Sort: cup score</option>
          <option value="esg">Sort: ESG score</option>
        </select>

        <select
          value={state.minCupScore ?? ""}
          onChange={(e) =>
            dispatch({ type: "SET_MIN_CUP_SCORE", value: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="h-10 rounded-md border border-neutral-300 bg-background px-3 text-sm text-ink outline-none focus-visible:border-oxblood"
          aria-label="Minimum cup score"
        >
          <option value="">Any cup score</option>
          {CUP_MIN_STEPS.slice(1).map((v) => (
            <option key={v} value={String(v)}>{v === 90 ? "90+" : `${v}+`}</option>
          ))}
        </select>

        <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden="true" />
        <details className="relative rounded-md border border-neutral-300 bg-background">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-medium text-ink select-none focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <Filter className="h-4 w-4 text-muted" aria-hidden="true" />
            Advanced
            {filtersActive > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-oxblood px-1 font-mono text-[10px] font-bold text-paper-50">
                {filtersActive}
              </span>
            )}
          </summary>
          <div className="absolute right-0 top-full z-dropdown mt-1.5 w-72 rounded-lg border border-border bg-popover p-4 shadow-e4">
            <p className="folio mb-2">Origins</p>
            {origins.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={state.origins.includes(o)}
                  onChange={() => dispatch({ type: "TOGGLE_ORIGIN", origin: o })}
                  className="h-4 w-4 accent-oxblood"
                />
                {o}
              </label>
            ))}
            <p className="folio mt-4 mb-2">Process</p>
            {processes.map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={state.processes.includes(p)}
                  onChange={() => dispatch({ type: "TOGGLE_PROCESS", process: p })}
                  className="h-4 w-4 accent-oxblood"
                />
                {p}
              </label>
            ))}
          </div>
        </details>

        {(filtersActive > 0 || state.query) && (
          <button
            onClick={() => dispatch({ type: "RESET_FILTERS" })}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-oxblood focus-visible:outline-none"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      <p className="text-caption text-muted-foreground" aria-live="polite">
        {isLoading
          ? "Reading the ledger…"
          : `${ranked.length} lot${ranked.length === 1 ? "" : "s"} match your goal.`}
      </p>

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-72 animate-pulse rounded-lg border border-border bg-surface">
              <div className="h-16 rounded-t-lg bg-recessed/60" />
            </div>
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-neutral-500 p-12 text-center" role="status">
          <p className="font-display text-xl text-ink">No lots match</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Loosen the budget ceiling or clear filters — the ledger always has more pages.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {ranked.map(({ lot, scores, overBudget }, i) => (
            <LotCard key={lot.id} lot={lot} rank={i + 1} scores={scores} overBudget={overBudget} showEdge />
          ))}
        </div>
      )}
    </div>
  );
}

// If/when the ledger gains verified ESG columns, return the lot ids that hold a
// score. Until then the rubric stays visibly empty so we never guess.
function scoreForEsg(): number[] {
  return [];
}