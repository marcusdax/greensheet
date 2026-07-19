# Greensheet — Component Library

**Version 1.0 · Atomic design: atoms → molecules → organisms · Consumes tokens from `02-design-tokens.md` only**

Conventions used below: React 18 + Tailwind (config per §10 of the tokens doc) + framer-motion. Class names reference the Greensheet Tailwind extension (`bg-surface`, `text-ink`, `shadow-e3`, `duration-base`, `ease-compass`, …). No arbitrary hex values anywhere. Every interactive element ships **default / hover / focus / active / disabled / loading** states and, where applicable, **empty / error** states.

Shared state rules:

- **Focus:** 2 px `border-focus` ring + 2 px offset (`focus-visible:ring-2 ring-teal ring-offset-2 ring-offset-canvas`). Never `outline: none` without the ring replacement.
- **Disabled:** `opacity-45 cursor-not-allowed`, and disabled controls are removed from tab order only when a visible explanation is present; otherwise keep focusable with `aria-disabled`.
- **Loading:** spinner = 20 px ring, 2 px stroke, `teal-600` arc on `recessed` track, 750 ms linear rotation; buttons show spinner + preserve width (label swaps to spinner, `aria-busy`).
- **Reduced motion:** all transitions below collapse per the motion governance rule.

---

## 1. Button (atom)

### 1.1 Variants

| Variant | Fill / text | Use |
|---|---|---|
| `primary` | `navy-700` bg, `#FDFBF5` text (13.46:1 AAA) | one per view — the forward action ("Source This Lot", "Send Campaign") |
| `secondary` | `teal-600` bg, white text (5.87:1 AA) | supporting action ("Save View", "Export Sheet") |
| `outline` | transparent bg, 1 px `border-interactive`, `ink` text | neutral alternatives ("Cancel") |
| `ghost` | transparent, `text-link` text | row-level/tertiary ("Clear filters") |
| `gold` | `gold-500` bg, `ink-900` text (7.03:1 AAA) | **reserved**: moments of earned value — claim offer, publish winner. Max one per flow |
| `destructive` | `cherry-600` bg, white text (7.53:1 AAA) | irreversible actions, always with confirm step |

### 1.2 Sizes & geometry

| Size | Height | Padding-x | Font | Radius |
|---|---|---|---|---|
| `sm` | 32 px | 12 px | `sm`/600 | `md` (6) |
| `md` | 40 px | 16 px | `sm`/600 (label style) | `md` |
| `lg` | 48 px | 24 px | `base`/600 | `md` |

Icon buttons: square at same heights, 1 px `border-decorative`, 20 px icon, `aria-label` required.

### 1.3 State matrix

| State | primary | secondary | outline/ghost |
|---|---|---|---|
| Hover | `navy-800`, shadow `e2` | `teal-700` | bg `recessed` |
| Active | translate-y 0, shadow `e1`, 96% scale | same | same |
| Focus | ring spec (§0) on all variants | | |
| Disabled | `opacity-45`, no shadow, `aria-disabled="true"` | | |
| Loading | width locked, 20 px spinner replaces label, `aria-busy="true"` | | |

### 1.4 Code

```tsx
// components/ui/Button.tsx
import { forwardRef } from 'react';
import { motion } from 'framer-motion';

const variants = {
  primary:     'bg-navy text-parchment-50 hover:bg-navy-800 shadow-e1 hover:shadow-e2',
  secondary:   'bg-teal text-white hover:bg-teal-700 shadow-e1 hover:shadow-e2',
  outline:     'border border-neutral-600 text-ink hover:bg-recessed',
  ghost:       'text-teal hover:bg-recessed underline-offset-4 hover:underline',
  gold:        'bg-gold text-ink hover:bg-gold-300 shadow-e1 hover:shadow-e2',
  destructive: 'bg-cherry text-white hover:bg-cherry-300 hover:text-ink shadow-e1',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.15 }}
      aria-disabled={disabled}
      aria-busy={loading}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-semibold
        transition-colors duration-fast
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal
        focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
        disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading ? <Spinner size={20} /> : children}
    </motion.button>
  )
);
```

---

## 2. Badge & score pills (atoms)

### 2.1 SCA Cup Score Badge — the signature atom

Renders `coffee_lots.cup_score` (DECIMAL 4,1). **Always** shows one decimal (86.5, not 86) — the tenth is traded information.

| Tier | Score | Bg / text | Shape | Extra |
|---|---|---|---|---|
| Outstanding | 90.0–100 | `gold-500` / `ink-900` | pill `radius-full` | 3 px navy bean-groove tick left of numeral; "Outstanding" tooltip |
| Excellent | 85.0–89.9 | `teal-600` / white | pill | — |
| Very Good | 80.0–84.9 | `leaf` (green-600) / white | pill | — |
| Below specialty | < 80.0 | `neutral-700` / white (7.39:1 AAA) | pill | — |

Geometry: height 24 px (`sm`) / 28 px (`md`), padding-x 10 px, numeral in `IBM Plex Mono 700`, `tabular-nums`. Never render a score without its tier color; never recolor.

```tsx
// components/ui/CupScoreBadge.tsx
const tiers = [
  { min: 90, cls: 'bg-gold text-ink',       label: 'Outstanding' },
  { min: 85, cls: 'bg-teal text-white',     label: 'Excellent' },
  { min: 80, cls: 'bg-leaf text-white',     label: 'Very Good' },
  { min: 0,  cls: 'bg-neutral-700 text-white', label: 'Below specialty' },
] as const;

export function CupScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const tier = tiers.find(t => score >= t.min)!;
  return (
    <span
      title={`SCA cup score ${score.toFixed(1)} — ${tier.label}`}
      className={`inline-flex items-center gap-1 rounded-full font-mono font-bold tabular-nums
        ${size === 'md' ? 'h-7 px-3 text-sm' : 'h-6 px-2.5 text-caption'} ${tier.cls}`}
    >
      {score >= 90 && <BeanGrooveTick />} {/* navy tick — earned gold */}
      {score.toFixed(1)}
    </span>
  );
}
```

### 2.2 Status badges

| Badge | Classes (light) | Content |
|---|---|---|
| In stock / Active | `bg-success-bg text-success` | dot 6 px + label |
| Over budget / Warning | `bg-warning-bg text-warning` | `⚠` glyph optional |
| Churn risk / Error | `bg-danger-bg text-danger` | churn risk % in mono |
| Info / ETA | `bg-info-bg text-info` | dates in mono |
| A/B Winner | `bg-gold text-ink` + `ease-compass` pop on reveal | `★ Winner` |
| Certified (FT/Organic/RA) | `bg-leaf-100 text-leaf border border-leaf` | certification mark |
| Process (washed/natural/honey/anaerobic) | `bg-recessed text-muted` | lowercase, no color coding — process is neutral information |

### 2.3 Flavor-note chips

`bg-surface border border-decorative text-muted-dark`, h 24 px, padding-x 8 px, caption size, `radius-full`. Max 5 visible + `+n more` overflow chip. Hover: `border-interactive`. Not interactive by default (they are metadata, not filters — filters live in the Navigator panel).

---

## 3. Inputs (atoms)

### 3.1 Text input / search

Geometry: h 40 px (`md`) / 48 px (`lg`), padding-x 16, `radius-md`, bg `surface`, 1 px `border-interactive` (3.38:1 ✓), text `base`/ink, placeholder `text-subtle`.

| State | Spec |
|---|---|
| Hover | border `neutral-700` |
| Focus | border `teal-600` + ring spec |
| Error | border `danger`, caption `text-danger` below, `aria-invalid` + `aria-describedby` |
| Disabled | bg `recessed`, `opacity-45` |
| With icon | 20 px icon left at 12 px inset; search uses trailing ⌕ and `type="search"` |

Label pattern: `overline` style above the control (as in Navigator: "BUDGET CEILING"), value echoed in `figure` mono when numeric.

### 3.2 Range slider (budget ceiling, min cup score)

- Track: h 6 px, `radius-full`, bg `recessed`; filled portion `teal-600`.
- Thumb: 20 px circle, `surface` fill, 2 px `navy-700` border, shadow `e1`; hover shadow `e2`; focus ring spec; active scale 1.1 with `ease-compass`.
- Value readout: mono `lg`, `text-teal-700`, sits inside the overline label (mirrors `$12.00/lb` pattern).
- Always pair with min/max captions (`70` / `95`) in `text-subtle` and full keyboard support (←→ = step, PgUp/Dn = 5×step).

### 3.3 Checkbox / radio / toggle

- Box 16 px, `radius-sm`, 1.5 px `border-interactive`; checked fill `teal-600` with white check (5.87:1); focus ring spec.
- Toggle: 36×20 track, `neutral-500` off / `teal-600` on, 16 px knob; state also conveyed by position+label, never color alone.
- Indeterminate state for "select all" table rows: navy dash.

### 3.4 Select

Native `<select>` styled to input spec (chevron 16 px `text-muted`) — no custom listboxes without full ARIA listbox pattern. Multi-select uses checkbox group in a disclosure panel (as Navigator's origin/process filters).

### 3.5 Code

```tsx
// components/ui/TextField.tsx
export function TextField({ label, error, id, ...props }: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-caption font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`
          h-10 w-full rounded-md border bg-surface px-4 text-base text-ink
          placeholder:text-subtle transition-colors duration-fast
          ${error ? 'border-danger' : 'border-neutral-600 hover:border-neutral-700 focus:border-teal'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
          disabled:bg-recessed disabled:opacity-45
        `}
        {...props}
      />
      {error && <p id={`${id}-error`} role="alert" className="text-caption text-danger">{error}</p>}
    </div>
  );
}
```

---

## 4. Coffee Lot Card (molecule — the hero component)

The lot card is the digital descendant of the paper offer-sheet line item. One card = one row of the old green sheet, elevated to an instrument.

### 4.1 Anatomy (top → bottom)

```
┌────────────────────────────────────────────────────────────────────┐
│ [#rank]  Origin — Varietal   [process badge] [Over Budget?]        │
│          $5.20/lb · ☕ 86.5 · ESG 78% · 1,320 lbs · ETA Jun 12     │
│          [chocolate] [berry] [jasmine] [cane sugar] [+2 more]      │
│                                                     ┌────────────┐ │
│                                          Composite  │ Source     │ │
│                                          87         │ This Lot   │ │
│                                                     └────────────┘ │
│  Cost ▓▓▓▓▓▓░░ 72   Quality ▓▓▓▓▓▓▓░ 86   ESG ▓▓▓▓▓ 78   Log. ▓▓ 61│
└────────────────────────────────────────────────────────────────────┘
```

| Zone | Spec |
|---|---|
| Container | `bg-surface border border-decorative rounded-lg p-5 shadow-e1`; hover `shadow-e3` + border `neutral-500`; transition `duration-base` |
| Rank medallion | 40 px circle, `bg-recessed text-muted`, mono 700 `#n` |
| Title | `text-lg` Archivo 600 `text-ink`; varietal in `text-muted` after an interpunct |
| Process badge | neutral process badge (§2.2) |
| Over-budget | container border becomes 2 px `warning`; badge `bg-warning-bg text-warning` (4.98:1 on tint AA ✓) |
| Metrics row | `text-sm text-muted`, icons 16 px, **figures in mono ink**: `$5.20`/lb, cup score via CupScoreBadge, ESG % mono, quantity `toLocaleString()` lbs, ETA from `estimated_arrival` |
| Flavor chips | §2.3, max 5 + overflow |
| Composite score | label caption `text-muted`, value `text-2xl` mono 700 `text-ink` |
| CTA | `Button primary sm` — "Source This Lot" |
| Metric bars | 4 columns (Cost/Quality/ESG/Logistics): caption label + mono % right; track h 6 px `bg-recessed radius-full`; fill `teal-600`, animates width once on mount, 500 ms `ease.out` |

### 4.2 States

- **Loading (skeleton):** same geometry in `recessed` blocks with 1.6 s parchment shimmer (`parchment-200 → parchment-300`); never a bare spinner for card lists.
- **Over budget:** as above; excluded entirely when "Include out-of-budget lots" is off (architecture §4.2 `TOGGLE_OVER_BUDGET`).
- **Sold out (`available_quantity_lbs = 0`):** card at `opacity-45` except a roast-brown "Position taken" stamp badge; CTA swaps to ghost "Join waitlist".
- **New arrival (≤ 14 days since `last_updated_at`):** 3 px `gold-500` leading edge (left border) — gold = earned attention.
- **Selected/comparison:** border `teal-600` 2 px + `bg-teal-100/40`.

### 4.3 Code (drop-in refactor of architecture §4.3 to token classes)

```tsx
// components/lots/LotCard.tsx
import { memo } from 'react';
import { motion } from 'framer-motion';
import { CupScoreBadge } from '../ui/CupScoreBadge';
import { Button } from '../ui/Button';

export const LotCard = memo(function LotCard({ lot, rank, budgetCeiling, onSelect }: LotCardProps) {
  const isOverBudget = lot.pricePerLb > budgetCeiling;
  const isNew = Date.now() - new Date(lot.lastUpdatedAt).getTime() < 14 * 86_400_000;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
      className={`
        relative rounded-lg border bg-surface p-5 shadow-e1 transition-shadow duration-base hover:shadow-e3
        ${isOverBudget ? 'border-2 border-warning' : 'border-neutral-400'}
        ${isNew ? 'border-l-[3px] border-l-gold' : ''}
      `}
      aria-label={`${lot.origin} ${lot.varietal ?? ''}, cup score ${lot.cupScore.toFixed(1)}, $${lot.pricePerLb.toFixed(2)} per pound`}
    >
      <div className="flex flex-wrap items-start gap-4 md:flex-nowrap">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recessed font-mono text-sm font-bold text-muted">
          #{rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{lot.origin}</h3>
            {lot.varietal && <span className="text-sm text-muted">· {lot.varietal}</span>}
            {lot.processingMethod && <ProcessBadge method={lot.processingMethod} />}
            {isOverBudget && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-caption font-medium text-warning">Over budget</span>}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>$<span className="font-mono tabular-nums text-ink">{lot.pricePerLb.toFixed(2)}</span>/lb</span>
            <span className="inline-flex items-center gap-1"><CupScoreBadge score={lot.cupScore} /> cup</span>
            {lot.esgScore != null && <span>ESG <span className="font-mono tabular-nums">{(lot.esgScore * 100).toFixed(0)}%</span></span>}
            <span><span className="font-mono tabular-nums">{lot.availableQuantityLbs.toLocaleString()}</span> lbs</span>
            {lot.estimatedArrival && <span className="text-info">ETA <span className="font-mono">{formatDate(lot.estimatedArrival)}</span></span>}
          </div>

          {lot.flavorNotes?.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="Flavor notes">
              {lot.flavorNotes.slice(0, 5).map(n => <FlavorChip key={n} note={n} />)}
              {lot.flavorNotes.length > 5 && <li className="text-caption text-subtle">+{lot.flavorNotes.length - 5} more</li>}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-caption text-muted">Composite</div>
            <div className="font-mono text-2xl font-bold tabular-nums text-ink">{lot.metrics.weightedScore.toFixed(0)}</div>
          </div>
          <Button size="sm" onClick={onSelect}>Source This Lot</Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries({ Cost: lot.metrics.costNorm, Quality: lot.metrics.cupNorm, ESG: lot.metrics.esgNorm, Logistics: lot.metrics.logisticsNorm })
          .map(([label, value]) => <MetricBar key={label} label={label} value={value} />)}
      </div>
    </motion.article>
  );
});
```

---

## 5. Catalog table (organism)

The catalog is the full green sheet: every lot, sortable, filterable, exportable.

### 5.1 Structure

| Element | Spec |
|---|---|
| Frame | `bg-surface border border-decorative rounded-lg`, overflow-x auto, sticky header (`top-0 bg-surface z-sticky shadow-e1` when scrolled) |
| Header row | h 44 px, `overline` labels, `border-b-2 border-neutral-500` (the ledger double-rule: header underline is always 2 px) |
| Body rows | h 48 px comfortable / 40 px compact; zebra `bg-surface` / `bg-parchment-200`; row hover `bg-hover`; row focus-visible ring inset |
| Cells | padding 12/16, `text-sm`; **all numeric columns right-aligned mono tabular**; text columns left; score column renders CupScoreBadge |
| Sort | header button with ▲/▼ (`text-teal-700` active, `text-subtle` inactive); `aria-sort` on `<th>` |
| Row actions | ghost icon buttons revealed on row hover/focus-within (view lot, add to compare, contact exporter) |
| Pagination | footer bar h 56, "1–25 of 312 lots" mono caption + outline prev/next |

### 5.2 Column spec (maps to `coffee_lots` schema)

Lot (origin + varietal, truncated 24ch) · Process (badge) · Elevation (mono, m) · **Cup** (badge, default sort desc) · Price/lb (mono, `$`) · Available (mono, lbs, bar-under-text mini sparkbar for % of `total_production_lbs`) · ESG (mono %) · Certs (leaf badges) · ETA (mono date) · Actions.

### 5.3 States

- **Loading:** 8 skeleton rows ( shimmer blocks inside the frame — the table chrome stays put).
- **Empty (filtered):** centered empty state (§8) with "Clear all filters" ghost button.
- **Empty (no inventory):** "The sheet is being written." + CTA to importer onboarding.
- **Error:** `danger` caption row with retry secondary button; keep last-good data visible behind a scrim note where possible.

---

## 6. Navigation (organisms)

### 6.1 App shell

```
┌────────────┬───────────────────────────────────────────────┐
│  Sidebar   │  Topbar (64px, bg-surface, border-b)          │
│  264px     │  breadcrumb · search · theme · avatar         │
│  navy-700  ├───────────────────────────────────────────────┤
│  (inverse) │                                               │
│            │  View content on parchment canvas             │
└────────────┴───────────────────────────────────────────────┘
```

### 6.2 Sidebar (`bg-navy-700 text-parchment-50`)

- Brand slot: wordmark-only lockup (Fraunces, parchment) + "by ODASI" microline at 60% opacity (`text-[#A9A08C]`).
- Nav items: h 40 px, `radius-md`, 20 px icon + `text-sm` 500 label.
  - Default: `text-parchment-50/70`; hover `bg-white/8 text-parchment-50`.
  - Active: `bg-teal-600 text-white` (5.87:1 AA ✓) + 3 px `gold-500` leading tick — the compass needle points at the current section.
- Sections: **Source** (Navigator, Catalog, Sample Kits) · **Engage** (Campaigns COF-001–005, Templates) · **Relationships** (Roasters CRM, Interventions) · **Intelligence** (Analytics, Benchmarks, Pricing) · **Operations** (Orders, Inventory, Settings).
- Footer: account card + collapsed rail mode (72 px, icon + tooltip) below `lg`; overlay drawer with scrim below `md`.
- Focus order: skip-link → sidebar nav → topbar → main. `aria-current="page"` on active item.

### 6.3 Topbar

Breadcrumb (Archivo 500, `text-muted`, current page `text-ink`) · global lot search (§3.1 search input, 320 px, collapses to icon button < md) · theme toggle (sun/moon, `aria-pressed`) · notifications (badge count in `cherry-600` mono) · avatar menu (32 px roast-brown monogram circle).

---

## 7. Dashboards & data visualization (organism style guide)

Tufte discipline per the architecture: maximize data-ink, no chartjunk, no 3D, no gradients.

### 7.1 Chart tokens

| Role | Value |
|---|---|
| Categorical series order | `navy-700` → `teal-600` → `gold-500` → `cherry-600` → `roast-700` → `leaf` → `neutral-600` (replaces the ad-hoc array `['#8a8272','#2f6b4a','#4a6b8f','#a8721f']` in architecture §4.4) |
| Grid lines | `neutral-400` at 40% alpha, horizontal only, dashed 3 3; **no vertical gridlines** on time series |
| Axis text | `caption` mono, `text-muted`; no axis titles when the unit is in the column header |
| Direct labeling | label series at line end (`text-sm` 600 in series color) instead of legends where ≤ 4 series |
| Tooltips | `bg-inverse text-inverse radius-md shadow-e3`, mono figures, 8 px padding |
| Reference lines | budget ceiling = `warning` dashed; target = `teal-600` dotted |
| Empty chart | dashed `neutral-500` frame + "Awaiting telemetry" caption — never render axes without data |

### 7.2 KPI cards

`bg-surface rounded-lg p-5 shadow-e1`: overline label → `text-3xl` mono 700 value (Fraunces only for the single hero KPI on a marketing page, never in ops dashboards) → delta line (▲ `text-success` / ▼ `text-danger` with mono % and "vs. prior period" caption). Sparkline h 32 px, `teal-600` 1.5 px stroke, no fill.

### 7.3 Dashboard-specific compositions

- **Campaign Intelligence (COF-001–005):** stepper of the 5 rules across the top (numbered medallions, active = navy fill, converted = gold); A/B results table per architecture §4.4 with `Winner` gold badge at probability ≥ 0.95, credible-interval bars as horizontal `teal-600` bars with whisker caps (error bars = 95% CI, `navy-700` 1.5 px); engagement line chart: opens = navy, clicks = teal, conversions = gold.
- **LTV/Churn (CRM):** churn-risk column uses a 5-stop sequential scale `leaf → gold-300 → warning → cherry-600` with the numeric score always shown (never color-only); survival-curve chart uses `cherry-600` line with 95% band at 12% alpha.
- **Benchmarks (quantile regression):** peer band = `teal-100` area, median = `teal-700` line, "you" marker = 8 px `gold-500` diamond.
- **Inventory forecast:** actuals solid navy; Prophet/ARIMA forecast dashed `teal-600` with `teal-100` confidence cone.

---

## 8. Shared states — loading, empty, error

### 8.1 Loading

- Route-level: center spinner + "Reading the sheet…" caption (rotate copy among 3 ledger phrases, no jokes about roasting).
- Component-level: skeletons that mirror final geometry (cards, rows, charts) in `bg-recessed` with parchment shimmer; `aria-busy="true"` on the region; keep layout stable (no CLS).

### 8.2 Empty states (the only licensed wit)

Structure: 48 px Lot Stamp illustration at `opacity-stamp`, `text-lg` Fraunces headline, `text-sm text-muted` explainer, one primary/ghost action.

| Context | Headline | Action |
|---|---|---|
| Navigator no results | "No lots match your criteria" | ghost "Clear all filters" |
| Catalog empty | "The sheet is being written." | primary "Add your first lot" |
| Campaigns empty | "No campaigns on the board." | primary "Start COF-001" |
| CRM no roasters | "Every relationship starts with a sample." | secondary "Import roasters" |
| 404 | "Off the map." | ghost "Back to the Navigator" |

### 8.3 Error & offline

Inline field errors per §3.1. View-level: `bg-danger-bg border border-danger rounded-lg p-4` with retry. Offline: sticky `warning` banner "You're offline — showing the last saved sheet (timestamp mono)."

---

## 9. Email component system (summary)

Full spec in `04-email-campaign-visual-system.md`. UI parity notes: the email header uses the navy band + parchment compass lockup; email buttons mirror `Button primary` (navy, 6 px radius) rendered as bulletproof VML/anchor hybrids; merge tags render in-product as mono `teal-700` chips (`{sca_cup_score}`) in the template editor, and as italic serif fallbacks in plaintext parts. Dark-mode email fallbacks mirror §2.4 token values.
