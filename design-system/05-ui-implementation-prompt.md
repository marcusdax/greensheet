# Greensheet — UI Implementation Prompt

**Implementation-ready build prompt for a React engineer or code-generation agent. Self-contained: everything required to build the Greensheet dashboard UI consistent with the design system. Copy everything below the line into your build context.**

---

# BUILD PROMPT — Greensheet Dashboard UI

## 1. Role

You are a senior front-end engineer with a museum curator's eye for print-inspired interface design. You are building **Greensheet**, a B2B SaaS dashboard for specialty green-coffee trading (importers/exporters publish lots; roasters discover, score, and source them). Greensheet is a product of ODASI Technologies. Your output must look like a beautifully typeset ledger — the paper "green sheet" offer document elevated to an instrument — not like a generic admin template.

## 2. Aesthetic direction (the vibe)

- **Material:** warm parchment paper, deep compass navy, muted constellation teal, restrained brass gold, coffee cherry red, roast brown. Low saturation throughout.
- **Typography as ornament:** Fraunces (serif) for page titles and brand moments; Archivo for UI; IBM Plex Mono with tabular numerals for **every figure** — prices, cup scores, weights, dates. Figures align like a ledger.
- **Density:** data-rich but aired. 4dp spacing grid. Cards rest nearly flat (shadow `e1`) and lift on hover (`e3`). Small precise radii (4–8 px). No rounded blob aesthetics.
- **Restraint:** no gradients (especially blue-purple), no glassmorphism, no neon, no emoji as UI icons (inline SVG only), no stock 3D illustrations, no Material-Default look. Gold is *earned* — reserved for 90+ cup scores, A/B test winners, and new-arrival edges.
- **Motion:** quiet and typographic. 150–350 ms, ease-out entrances, one spring (`ease.compass`) reserved for badge/winner reveals. Nothing loops but the spinner. Honor `prefers-reduced-motion`.

## 3. Tech stack

React 18 + Vite + TypeScript · Tailwind CSS (config below) · framer-motion · recharts · Zustand for cross-view state · React Router v6 · lucide-react for icons. No UI kit.

## 4. Design tokens (hard requirement)

Create `src/styles/tokens.css` **exactly** as follows and import it first. Components may use only these variables (via the Tailwind mapping) — arbitrary hex values fail review.

```css
:root {
  /* surfaces */
  --gs-bg-canvas: 246 241 231;   /* parchment #F6F1E7 */
  --gs-bg-surface: 253 251 245;  /* #FDFBF5 */
  --gs-bg-recessed: 239 232 218; /* #EFE8DA */
  --gs-bg-hover: 228 220 201;    /* #E4DCC9 */
  /* text */
  --gs-text-primary: 34 29 22;   /* ink #221D16 */
  --gs-text-muted: 92 85 70;     /* #5C5546 */
  --gs-text-subtle: 138 130 114; /* #8A8272 */
  /* brand statics (reference; also in tailwind config) */
  --gs-navy: #16323E; --gs-navy-hover: #12252F;
  --gs-teal: #2A6E73; --gs-teal-hover: #1F4F54;
  --gs-gold: #C9A34A; --gs-gold-text: #7A5F22;
  --gs-cherry: #8C3B34; --gs-roast: #4A3527; --gs-leaf: #3E6B50;
  --gs-border: #D8CFBB; --gs-border-strong: #B9AE97; --gs-border-interactive: #8A8272;
  --gs-success: #33684A; --gs-success-bg: #E5EFE7;
  --gs-warning: #8A5F14; --gs-warning-bg: #FBF0DA;
  --gs-danger: #9E3D31;  --gs-danger-bg: #F9E6E2;
  --gs-info: #2C6E8C;    --gs-info-bg: #E4EEF3;
  /* elevation (navy-tinted) */
  --gs-e1: 0 1px 2px 0 rgb(22 50 62 / 0.07);
  --gs-e2: 0 2px 4px -1px rgb(22 50 62 / 0.08), 0 4px 8px -2px rgb(22 50 62 / 0.06);
  --gs-e3: 0 4px 8px -2px rgb(22 50 62 / 0.09), 0 10px 20px -4px rgb(22 50 62 / 0.08);
  --gs-e4: 0 8px 16px -4px rgb(22 50 62 / 0.10), 0 20px 32px -8px rgb(22 50 62 / 0.10);
}
[data-theme="dark"] {
  --gs-bg-canvas: 16 27 35;      /* #101B23 */
  --gs-bg-surface: 27 41 51;     /* #1B2933 */
  --gs-bg-recessed: 34 51 63;    /* #22333F */
  --gs-bg-hover: 42 61 73;       /* #2A3D49 */
  --gs-text-primary: 239 233 219;/* #EFE9DB */
  --gs-text-muted: 169 160 140;  /* #A9A08C */
  --gs-text-subtle: 138 130 114;
  --gs-navy: #16323E; --gs-navy-hover: #12252F;
  --gs-teal: #7FB6BA; --gs-teal-hover: #93C4C7;   /* dark-mode primary action */
  --gs-gold: #D4B96A; --gs-gold-text: #D4B96A;
  --gs-cherry: #E8B4A6; --gs-roast: #4A3527; --gs-leaf: #9FD3B4;
  --gs-border: #3A4B57; --gs-border-strong: #4A5B68; --gs-border-interactive: #5F7180;
  --gs-success: #9FD3B4; --gs-success-bg: #1E3328;
  --gs-warning: #E3B76B; --gs-warning-bg: #3A2E17;
  --gs-danger: #E89A8F;  --gs-danger-bg: #3A1F1B;
  --gs-info: #8FC3D9;    --gs-info-bg: #1B2C38;
  --gs-e1: 0 1px 2px 0 rgb(0 0 0 / 0.40);
  --gs-e2: 0 2px 4px -1px rgb(0 0 0 / 0.45), 0 4px 8px -2px rgb(0 0 0 / 0.40);
  --gs-e3: 0 4px 8px -2px rgb(0 0 0 / 0.50), 0 10px 20px -4px rgb(0 0 0 / 0.45);
  --gs-e4: 0 8px 16px -4px rgb(0 0 0 / 0.55), 0 20px 32px -8px rgb(0 0 0 / 0.50);
}
```

Tailwind: extend exactly per `02-design-tokens.md` §10 (colors incl. `navy/teal/gold/cherry/roast/leaf/parchment/success/warning/danger/info`, `fontFamily display/sans/mono`, `fontSize` 1.25 scale from `caption` 0.8125rem to `5xl` 3.8147rem, `boxShadow e1–e5`, `transitionTimingFunction.compass cubic-bezier(0.34,1.56,0.64,1)`, `screens xs 480 … 2xl 1536`). Load Fraunces (opsz, wght 480–600), Archivo (400–700), IBM Plex Mono (500–700) via Google Fonts with `display=swap`.

## 5. App shell

- **Sidebar** 264 px, navy `#16323E`, parchment text: Fraunces "Greensheet" wordmark + 10 px tracked "BY ODASI" microline (`#A9A08C`). Nav groups with 11 px overline group labels: **SOURCE** (Navigator, Catalog, Sample Kits) · **ENGAGE** (Campaigns, Templates) · **RELATIONSHIPS** (Roasters, Interventions) · **INTELLIGENCE** (Analytics, Benchmarks, Pricing) · **OPERATIONS** (Orders, Inventory, Settings). Item: 40 px h, 20 px lucide icon, 14 px/500 label; default `text-parchment-50/70`, hover `bg-white/10`, active `bg-teal` + 3 px gold leading bar + `aria-current="page"`. Collapses to 72 px icon rail < 1024 px, overlay drawer + scrim < 768 px.
- **Topbar** 64 px, `bg-surface`, 1 px `border-decorative` bottom: breadcrumb · global search ("Search lots, origins, roasters…", ⌘K) · theme toggle (persists to localStorage, sets `data-theme`) · notifications bell with cherry mono count · 32 px avatar.
- **Main**: `bg-canvas`, max content width 1280 px, 24 px gutters (16 < 768), page title zone = overline + Fraunces `text-3xl` + one-line muted description.
- Skip-link ("Skip to content") as first focusable element.

---

## 6. Views to build (4 routes + shared lot detail drawer)

### 6.1 `/navigator` — Sourcing Navigator (home)

**Purpose:** weighted-scoring lot discovery (state machine per spec: `useReducer`, actions `SET_GOAL / SET_BUDGET / TOGGLE_OVER_BUDGET / SET_SORT_ORDER / SET_SEARCH_QUERY / TOGGLE_ORIGIN / TOGGLE_PROCESS / SET_MIN_CUP_SCORE / RESET_FILTERS`).

Layout:
1. **Goal profile row** — 5 selectable cards (Balanced Sourcing ⚖, Cost Optimization, Quality Focus, ESG Champion, Supply Chain Optimized). Card: `bg-surface border rounded-lg p-4`; active: `border-teal border-2` + "● Active" in `text-teal` mono caption; icons are lucide (`Scale`, `Coins`, `Star`, `Sprout`, `Ship`) in `text-muted`, active `text-teal`. Weights object per profile (e.g. qualityFirst: `{cost:0.1, cup:0.7, esg:0.1, logistics:0.1}`).
2. **Filter bar** — grid 4 cols (stack < 768): budget slider ($3–$45/lb, step 0.5, overline label "BUDGET CEILING" + teal mono readout) + "Include out-of-budget lots" checkbox · sort segmented control (Weighted/Price/Cup/ESG; active segment `bg-navy text-parchment-50`, inactive `bg-recessed`) · search input with trailing icon. "Show advanced filters" disclosure (framer-motion height animation, 350 ms) revealing: origins checkbox list (scrollable, max-h 40), processing methods (washed/natural/honey/anaerobic), min cup score slider (70–95, step 0.5).
3. **Results** — ranked `LotCard` list (component spec below), `AnimatePresence` with 40 ms stagger, max 8. Loading = 4 skeleton cards. Empty = Lot Stamp illustration + "No lots match your criteria" + ghost "Clear all filters". Rank medallion `#1…#n` mono.

**LotCard (build exactly):** `bg-surface rounded-lg border p-5 shadow-e1 hover:shadow-e3 transition-shadow`; over-budget gets `border-warning border-2` + warning badge; new-arrival (≤14 days) gets 3 px gold left edge. Content: rank medallion (40 px circle, `bg-recessed`, mono) · title row (origin `text-lg` 600 + varietal muted + process badge + over-budget badge) · metrics row (mono figures: $/lb, CupScoreBadge, ESG %, lbs with `toLocaleString()`, ETA in `text-info`) · flavor chips (max 5, `+n more`) · right column: composite score (`text-2xl` mono 700) + primary sm button "Source This Lot" · footer: 4 metric bars (Cost/Quality/ESG/Logistics, caption label + mono % right, 6 px `radius-full` recessed track, teal fill animating width 500 ms ease-out on mount).

### 6.2 `/catalog` — the full green sheet

Data table over all lots. Toolbar: search · process multi-select · cup-min chip filter · density toggle (comfortable 48/compact 40 px rows) · secondary button "Export Sheet" (download icon). Table: `bg-surface rounded-lg border` frame; sticky header with **2 px navy bottom rule** (ledger rule); overline header labels with sort buttons (`aria-sort`, teal active arrow); zebra rows `surface`/`parchment-200` (dark: `surface`/`recessed`); row hover `bg-hover`. Columns: Lot (origin + varietal) · Process (badge) · Elevation (mono, right) · **Cup (CupScoreBadge, default sort desc)** · Price/lb (mono right, `$x.xx`) · Available (mono right + 3 px teal under-bar showing % of total production) · ESG % (mono right) · Certs (leaf outline badges: FT / Organic / RA) · ETA (mono) · row actions (ghost icon buttons: eye, git-compare, mail — appear on row hover/focus-within). Footer: "1–25 of 312 lots" mono caption + outline pagination. Row click opens **lot detail drawer** (480 px right drawer, `shadow-e4`, scrim 50% navy): full lot sheet — header with origin Fraunces title + CupScoreBadge lg, sensory profile bars (acidity/body/sweetness from `sensory_profile` JSONB), Q-grader notes in Georgia-italic quote block, certifications, logistics timeline (port → shipped → ETA), price/margin mono table, footer CTA row (primary "Source This Lot", outline "Add to Compare").

### 6.3 `/campaigns` — Campaign Intelligence (COF-001–005)

1. **Rule stepper**: 5 numbered medallions across the card top: COF-001 Welcome · COF-002 Kit Follow-up · COF-003 Score Report · COF-004 SMS · COF-005 Suppression/CRM. Medallion 32 px circle mono; states: converted = gold fill + ink numeral, active = navy fill parchment numeral, idle = recessed. Connected by 2 px recessed line; click selects the rule.
2. **Rule detail card**: trigger event chip (mono `sample_kit.delivered`), channel badge (Email teal / SMS leaf / System neutral), template subjects A/B (two rows, mono variant tag + subject copy + open-rate bar).
3. **A/B results table** (per platform spec): columns Variant · Sample · Conv. · Conv. Rate (bold) · 95% CI (caption mono) · Prob. Best · Status. Winner row `bg-success-bg` + gold `★ Winner` badge (badge enters with `ease.compass` scale 0.8→1). Below: horizontal bar chart of posterior means with whisker error bars (recharts `BarChart` vertical layout, teal bars, navy 1.5 px whiskers).
4. **Engagement over time**: recharts `LineChart` — opens navy, clicks teal, conversions gold; horizontal dashed gridlines only (`neutral-400` 40%); direct end-of-line labels instead of legend; tooltip = navy inverse card with mono figures.
5. KPI row: Sent · Open rate · CTR · Conversion · Revenue attributed (all mono `text-3xl`, delta arrows success/danger).

### 6.4 `/roasters` — CRM

Table of roaster accounts: Roaster (avatar monogram roast-brown circle + name + segment badge micro/boutique/commercial) · Status (active success / trial info / dormant warning / churned neutral badge) · **Churn risk** (mono % + 5-stop color chip leaf→gold→warning→cherry; both always — never color alone) · **LTV** (mono `$12,400`) · CAC · Payback (mono `7 mo`) · Last order (mono days-ago) · Orders. Row click → account detail view: KPI cards (LTV, CAC, payback, total revenue), engagement timeline, interventions list (email_campaign/sales_call/discount_offer/survey with outcome badges retained/churned/pending), "Log intervention" primary button. At-risk banner when `churn_risk_score ≥ 0.7`: `bg-danger-bg border-danger` with suggested action copy.

### 6.5 `/analytics` — Intelligence

Grid 2-col (1-col < 1024): **Benchmark chart** (peer quantile band `teal-100` area, median `teal-700` line, "you" 8 px gold diamond marker) · **Cohort retention heatmap** (weeks × cohorts, leaf→gold sequential scale, mono cell values, caption axis) · **LTV:CAC scatter** (navy dots, gold trendline, quadrant hairlines) · **Inventory forecast** (actuals solid navy, forecast dashed teal, `teal-100` confidence cone) · **Churn survival curve** (cherry line, 12% alpha CI band). All charts follow §7.1 chart tokens: no vertical gridlines, caption mono axis labels, inverse tooltips, dashed warning reference lines for thresholds.

## 7. Shared components inventory (build first, in `src/components/ui/`)

`Button` (primary/secondary/outline/ghost/gold/destructive; sm/md/lg; loading spinner width-locked; `whileTap scale 0.96`) · `CupScoreBadge` (tiers: ≥90 gold bg/ink text + navy groove tick, ≥85 teal/white, ≥80 leaf/white, <80 neutral-700/white; one decimal; mono 700) · `Badge` (status/success/warning/danger/info + `Winner` gold) · `ProcessBadge`, `CertBadge`, `FlavorChip` · `TextField` (overline label, interactive border, error state w/ `aria-invalid` + `role="alert"`) · `Slider` (teal fill, 20 px navy-ringed thumb, mono readout) · `Checkbox`, `SegmentedControl` · `MetricBar` · `KpiCard` · `Skeleton` (parchment shimmer) · `EmptyState` (stamp + Fraunces headline + action) · `Drawer`, `Modal` (`shadow-e4`, scrim, focus-trap, ESC close) · `Tooltip` (navy inverse, mono) · `Table` primitives. All with `focus-visible` teal ring (2 px + 2 px offset) and disabled at `opacity-45`.

## 8. Sample data (seed `src/data/lots.ts` — match schema field names)

```ts
export interface CoffeeLot {
  id: string; origin: string; varietal?: string;
  processingMethod: 'washed' | 'natural' | 'honey' | 'anaerobic';
  elevation: number; cupScore: number; pricePerLb: number; costPerLb: number;
  availableQuantityLbs: number; totalProductionLbs: number;
  esgScore?: number; fairTradeCertified?: boolean; organicCertified?: boolean; rainforestAlliance?: boolean;
  flavorNotes?: string[]; sensoryProfile?: { acidity: number; body: number; sweetness: number };
  estimatedArrival?: string; lastUpdatedAt: string;
}

export const lots: CoffeeLot[] = [
  { id: 'lot_001', origin: 'Huila, Colombia', varietal: 'Pink Bourbon', processingMethod: 'washed',
    elevation: 1750, cupScore: 88.5, pricePerLb: 6.10, costPerLb: 4.45,
    availableQuantityLbs: 2640, totalProductionLbs: 6600, esgScore: 0.82,
    organicCertified: true, flavorNotes: ['jasmine', 'cane sugar', 'red currant', 'cocoa nib', 'lime'],
    sensoryProfile: { acidity: 8.5, body: 7.0, sweetness: 8.8 },
    estimatedArrival: '2025-07-12', lastUpdatedAt: new Date(Date.now() - 5*864e5).toISOString() },
  { id: 'lot_002', origin: 'Yirgacheffe, Ethiopia', varietal: 'Heirloom', processingMethod: 'natural',
    elevation: 2100, cupScore: 87.0, pricePerLb: 5.75, costPerLb: 4.10,
    availableQuantityLbs: 1320, totalProductionLbs: 4400, esgScore: 0.78,
    fairTradeCertified: true, flavorNotes: ['blueberry', 'bergamot', 'cacao', 'lavender'],
    sensoryProfile: { acidity: 8.8, body: 7.5, sweetness: 8.4 },
    estimatedArrival: '2025-06-28', lastUpdatedAt: new Date(Date.now() - 16*864e5).toISOString() },
  { id: 'lot_003', origin: 'Tarrazú, Costa Rica', varietal: 'Caturra', processingMethod: 'honey',
    elevation: 1850, cupScore: 86.5, pricePerLb: 5.20, costPerLb: 3.80,
    availableQuantityLbs: 3960, totalProductionLbs: 8800, esgScore: 0.85,
    rainforestAlliance: true, flavorNotes: ['chocolate', 'orange zest', 'panela', 'almond', 'vanilla', 'black tea'],
    sensoryProfile: { acidity: 7.8, body: 8.0, sweetness: 8.6 },
    estimatedArrival: '2025-06-30', lastUpdatedAt: new Date(Date.now() - 3*864e5).toISOString() },
  { id: 'lot_004', origin: 'Nyeri, Kenya', varietal: 'SL28', processingMethod: 'washed',
    elevation: 1900, cupScore: 90.5, pricePerLb: 9.80, costPerLb: 7.20,
    availableQuantityLbs: 880, totalProductionLbs: 2200, esgScore: 0.74,
    flavorNotes: ['blackcurrant', 'grapefruit', 'brown sugar', 'tomato leaf'],
    sensoryProfile: { acidity: 9.2, body: 7.8, sweetness: 8.9 },
    estimatedArrival: '2025-08-03', lastUpdatedAt: new Date(Date.now() - 2*864e5).toISOString() },
  { id: 'lot_005', origin: 'Cajamarca, Peru', varietal: 'Bourbon', processingMethod: 'anaerobic',
    elevation: 1950, cupScore: 84.0, pricePerLb: 4.60, costPerLb: 3.30,
    availableQuantityLbs: 0, totalProductionLbs: 3300, esgScore: 0.88, organicCertified: true,
    flavorNotes: ['rum raisin', 'pineapple', 'cinnamon'],
    sensoryProfile: { acidity: 8.2, body: 7.2, sweetness: 8.0 },
    estimatedArrival: '2025-07-20', lastUpdatedAt: new Date(Date.now() - 30*864e5).toISOString() },
];
```

Weighted score: normalize each metric 0–100 across the visible set, then `Σ(weight × norm)` with the active goal profile's weights; display rounded integer as Composite.

## 9. Motion spec

Card/list entrance `opacity 0→1, y 10→0`, 250 ms, ease-out, stagger 40 ms (max 8) · filter disclosure height 350 ms ease-in-out · metric bars width 500 ms ease-out once · winner badge scale 0.8→1 `ease.compass` · drawer x 480→0 350 ms ease-out · route fade 150 ms · `prefers-reduced-motion`: all → instant, no stagger.

## 10. Accessibility acceptance criteria (all must pass)

- axe-core: 0 critical/serious violations on all 5 routes, light + dark.
- Keyboard: full task completion without pointer; visible teal focus ring everywhere; skip-link first; drawer/modal focus-trapped with return-focus.
- Contrast: text ≥ 4.5:1, large ≥ 3:1, interactive boundaries ≥ 3:1 (token values are pre-verified — do not alter them).
- Figures use `tabular-nums`; scores never conveyed by color alone (badge always includes the numeral); churn risk always shows the number.
- Touch targets ≥ 40×40 px (sliders included); `aria-sort` on sortable headers; `aria-live="polite"` on results count ("47 lots match").

## 11. Definition of done

1. 5 routes + lot drawer render from the seed data with all states (loading skeletons via 600 ms artificial delay, empty via filter "zzz", error via MSW handler).
2. Dark mode flips via topbar toggle and `prefers-color-scheme` default; no hard-coded color survives the flip.
3. Stylelint/custom lint: zero arbitrary hex/px-outside-scale in `src/`.
4. Lighthouse a11y ≥ 95, best-practices ≥ 95 on `/navigator`.
5. It looks like a ledger that learned to compute: parchment calm, navy authority, mono figures in perfect columns, gold appearing only where something was earned.

## 12. Explicit don'ts

No gradients · no purple/indigo/blue-violet anywhere · no emoji in UI chrome (lucide icons only) · no card-in-card nesting · no border-radius > 16 px · no animated counters on every scroll · no toast spam (one toast region, `shadow-e5`, max 3) · no uppercase body text (overlines only) · no pure black/white (`#000`/`#fff`) — use ink `#221D16` and surface `#FDFBF5`.

--- 

*End of build prompt. Companion specs: `01-brand-identity.md` (marks/voice), `02-design-tokens.md` (all values + tokens.json), `03-component-library.md` (component states/anatomy), `04-email-campaign-visual-system.md` (COF-001–005 emails).*
