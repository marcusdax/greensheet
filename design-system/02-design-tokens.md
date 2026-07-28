# Greensheet — Design Tokens

**Version 1.0 · Source of truth for all UI color, type, space, elevation, and motion · WCAG 2.2 AA minimum**

Token architecture has three tiers. **Engineers consume tier 2 (semantic) and tier 3 (component) tokens only.** Tier 1 primitives exist so a rebrand never touches component code.

```
primitive  (gs-color-navy-700)   raw values, named by hue+step
   ↓ alias
semantic   (gs-color-action-primary)   role-based, theme-switched (light/dark)
   ↓ alias
component  (gs-button-primary-bg)   bound to a component slot
```

All contrast ratios below were computed with the WCAG 2.x relative-luminance formula. "AA ✓" = ≥ 4.5:1 for normal text; "AA-large ✓" = ≥ 3:1 (18 pt / 14 pt bold+, and non-text UI per 1.4.11).

---

## 1. Color — Tier 1 primitives

### 1.1 Brand hues (with lineage)

| Token | Hex | LCH approx. | Source |
|---|---|---|---|
| `navy-900` | `#0E1A22` | L18 C10 H235 | ODASI navy `#142435`, deepened |
| `navy-800` | `#12252F` | — | interpolated |
| **`navy-700` (Compass Navy)** | `#16323E` | L20 C12 H228 | **primary brand ink**, harmonized with ODASI |
| `navy-600` | `#1F4F54` | — | navy→teal bridge (teal-dark text) |
| `teal-700` | `#1F4F54` | L31 C13 H198 | teal text on parchment |
| **`teal-600` (Constellation Teal)** | `#2A6E73` | L42 C16 H196 | ODASI teal `#3D7681`, darkened for AA |
| `teal-500` | `#3D8A90` | — | hover on teal fills |
| `teal-300` | `#7FB6BA` | L70 C14 H200 | dark-mode primary action |
| `teal-100` | `#DCEAEA` | — | teal tint surface |
| `gold-600` | `#7A5F22` | L40 C45 H85 | gold text on parchment |
| **`gold-500` (Core Gold)** | `#C9A34A` | L70 C50 H88 | ODASI gold `#968853`, brightened; badges/graphics |
| `gold-300` | `#D4B96A` | L76 C42 H90 | dark-mode gold |
| `gold-100` | `#F0E6CC` | — | gold tint surface |
| `cherry-600` | `#8C3B34` | L38 C42 H38 | coffee cherry; destructive |
| `cherry-300` | `#E8B4A6` | — | dark-mode cherry |
| `cherry-100` | `#F9E6E2` | — | cherry tint surface |
| `roast-800` | `#3A2A1E` | — | deepest roast |
| **`roast-700` (Roast Brown)** | `#4A3527` | L23 C18 H60 | stamp ink, footer bands |
| `roast-100` | `#E9DFD2` | — | roast tint surface |
| **`green-600` (Greensheet Green)** | `#3E6B50` | L41 C22 H155 | namesake; ESG/certified; evolved from legacy `#2F6B4A` |
| `green-300` | `#9FD3B4` | — | dark-mode green |
| `green-100` | `#E5EFE7` | — | green tint surface |

### 1.2 Warm neutral ramp (parchment scale)

| Token | Hex | Role |
|---|---|---|
| `parchment-50` | `#FDFBF5` | raised surface (cards, inputs) |
| **`parchment-100`** | `#F6F1E7` | **page ground ("the green sheet")** |
| `parchment-200` | `#EFE8DA` | recessed surface, table zebra |
| `parchment-300` | `#E4DCC9` | hover on recessed |
| `neutral-400` | `#D8CFBB` | decorative border (1.38:1 — decorative only) |
| `neutral-500` | `#B9AE97` | strong decorative border |
| `neutral-600` | `#8A8272` | **interactive border** (3.38:1 ✓ 1.4.11), muted-light large text (3.38:1, AA-large only) |
| `neutral-700` | `#5C5546` | muted body text (6.56:1 AA ✓) |
| `ink-900` | `#221D16` | primary ink / headings/body (14.86:1 AAA ✓) |

---

## 2. Color — Tier 2 semantic (light + dark)

### 2.1 Light mode (default)

| Semantic token | Value | Used for | Contrast (vs. stated ground) |
|---|---|---|---|
| `color.bg.canvas` | `parchment-100 #F6F1E7` | app background | — |
| `color.bg.surface` | `parchment-50 #FDFBF5` | cards, tables, inputs | — |
| `color.bg.recessed` | `parchment-200 #EFE8DA` | wells, metric tracks, zebra | — |
| `color.bg.hover` | `parchment-300 #E4DCC9` | hover on recessed rows | — |
| `color.bg.inverse` | `navy-700 #16323E` | top bar, footer band, tooltips | — |
| `color.text.primary` | `ink-900 #221D16` | headings, body | 14.86:1 on canvas AAA ✓ · 16.17:1 on surface AAA ✓ |
| `color.text.muted` | `neutral-700 #5C5546` | secondary text, labels | 6.56:1 AA ✓ |
| `color.text.subtle` | `neutral-600 #8A8272` | captions ≥12 px bold, placeholders | 3.38:1 AA-large only — never for body |
| `color.text.inverse` | `#FDFBF5` | text on navy/roast fills | 13.46:1 on navy-700 AAA ✓ |
| `color.text.link` | `teal-600 #2A6E73` | inline links (always underlined) | 5.22:1 AA ✓ |
| `color.action.primary.bg` | `navy-700 #16323E` | primary button fill | white text 13.46:1 AAA ✓ |
| `color.action.primary.hover` | `navy-800 #12252F` | primary hover | white 15.8:1 AAA ✓ |
| `color.action.secondary.bg` | `teal-600 #2A6E73` | secondary button fill | white 5.87:1 AA ✓ |
| `color.action.secondary.hover` | `teal-700 #1F4F54` | secondary hover | white 9.11:1 AAA ✓ |
| `color.accent.gold` | `gold-500 #C9A34A` | winner badges, bean core, 90+ scores | ink text 7.03:1 AAA ✓ · navy text 5.65:1 AA ✓ |
| `color.accent.gold.text` | `gold-600 #7A5F22` | gold words on parchment | 5.35:1 AA ✓ |
| `color.accent.cherry` | `cherry-600 #8C3B34` | origin accent, destructive | white text 7.53:1 AAA ✓ · on canvas 6.69:1 AA ✓ |
| `color.brand.green` | `green-600 #3E6B50` | ESG, certifications, namesake | white 6.13:1 AA ✓ · on canvas 5.45:1 AA ✓ |
| `color.border.decorative` | `neutral-400 #D8CFBB` | card hairlines, dividers | decorative (no requirement) |
| `color.border.strong` | `neutral-500 #B9AE97` | table outer frame | decorative |
| `color.border.interactive` | `neutral-600 #8A8272` | input/select/checkbox outlines | 3.38:1 ✓ 1.4.11 |
| `color.border.focus` | `teal-600 #2A6E73` | focus ring (2 px + 2 px offset) | 5.22:1 ✓ 1.4.11 |

### 2.2 Functional / status (light)

| Token | Text/base | Tint bg | Pairing check |
|---|---|---|---|
| `color.status.success` | `#33684A` | `#E5EFE7` | text on canvas 5.79:1 AA ✓ · on tint 5.54:1 AA ✓ · white on base 6.52:1 AA ✓ |
| `color.status.warning` | `#8A5F14` | `#FBF0DA` | on canvas 5.00:1 AA ✓ · on tint 4.98:1 AA ✓ · white on base 5.63:1 AA ✓ |
| `color.status.danger` | `#9E3D31` | `#F9E6E2` | on canvas 5.89:1 AA ✓ · on tint 5.51:1 AA ✓ · white on base 6.63:1 AA ✓ |
| `color.status.info` | `#2C6E8C` | `#E4EEF3` | on canvas 5.02:1 AA ✓ · on tint 4.80:1 AA ✓ |

### 2.3 Cup-score semantic scale (SCA tiers — used by badges, charts, filters)

| Tier | Range | Token pair | Rationale |
|---|---|---|---|
| Outstanding | 90.0–100 | `gold-500` bg + `ink-900` text (7.03:1 AAA ✓) | gold is *earned* |
| Excellent | 85.0–89.9 | `teal-600` bg + white (5.87:1 AA ✓) | house tier |
| Very Good | 80.0–84.9 | `green-600` bg + white (6.13:1 AA ✓) | specialty floor |
| Below specialty | < 80.0 | `neutral-700` bg + white (7.39:1 AAA ✓) | de-emphasized |

### 2.4 Dark mode (`data-theme="dark"` or `prefers-color-scheme`)

Warm espresso-navy darks — **never pure black, never cool gray.**

| Semantic token | Dark value | Contrast |
|---|---|---|
| `color.bg.canvas` | `#101B23` | — |
| `color.bg.surface` | `#1B2933` | — |
| `color.bg.recessed` | `#22333F` | ink on it 10.75:1 AAA ✓ |
| `color.bg.hover` | `#2A3D49` | — |
| `color.bg.inverse` | `#F6F1E7` | — |
| `color.text.primary` | `#EFE9DB` | 14.42:1 on canvas AAA ✓ |
| `color.text.muted` | `#A9A08C` | 6.73:1 on canvas AA ✓ · 5.73:1 on surface AA ✓ |
| `color.text.subtle` | `#8A8272` | 4.59:1 on canvas AA ✓ (captions only) · 3.91:1 on surface AA-large only |
| `color.text.inverse` | `#101B23` | for text on teal-300/gold-300 fills (7.73/9.10:1 AAA ✓) |
| `color.text.link` | `#7FB6BA` | 7.73:1 AAA ✓ |
| `color.action.primary.bg` | `#7FB6BA` (teal-300) | canvas-navy text `#101B23` 7.73:1 AAA ✓ |
| `color.action.primary.hover` | `#93C4C7` | — |
| `color.action.secondary.bg` | `#2F7E84` | white text 4.73:1 AA ✓ |
| `color.action.secondary.hover` | `teal-500 #3D8A90` | — |
| `color.accent.gold` | `#D4B96A` (gold-300) | canvas text 9.10:1 AAA ✓ |
| `color.accent.cherry` | `#E8B4A6` | 9.57:1 AAA ✓ |
| `color.brand.green` | `#9FD3B4` | 10.35:1 AAA ✓ |
| `color.border.decorative` | `#3A4B57` | decorative |
| `color.border.strong` | `#4A5B68` | decorative |
| `color.border.interactive` | `#5F7180` | 3.46:1 ✓ 1.4.11 |
| `color.border.focus` | `#7FB6BA` | 7.73:1 ✓ |
| `color.status.*` | success `#9FD3B4` / warning `#E3B76B` / danger `#E89A8F` / info `#8FC3D9` on tints at 12% alpha | 7.85–10.35:1 on canvas, all AAA/AA ✓ |

**Chart dark-mode rule:** categorical series keep light-mode hues but step one rung lighter (teal-500→300, gold-500→300, cherry-600→300) to hold ≥3:1 against `#1B2933`.

---

## 3. Typography

### 3.1 Families

| Token | Stack | Role |
|---|---|---|
| `font.display` | `"Fraunces", "Cormorant Garamond", Georgia, serif` | wordmark, page titles, hero numerals, pull quotes. Optical size opsz ≥ 40 for display; SOFT 0, WONK 0 |
| `font.sans` | `"Archivo", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | UI text, labels, tables |
| `font.mono` | `"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace` | **all figures**: prices, cup scores, weights, table numerals, merge tags |

Numerals rule (from product code): every price, score, and quantity renders in `font.mono` with `font-variant-numeric: tabular-nums` — columns of figures must align like the paper ledger.

### 3.2 Modular scale — 1.25 (major third) on a 16 px base

| Token | px | rem | Line-height | Weight / face | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `text.caption` | 12.8 → **13** | 0.8125 | 1.3 | Archivo 500 | +0.02em | table captions, axis labels, timestamps |
| `text.sm` | 14 | 0.875 | 1.5 | Archivo 400/500 | 0 | secondary body, badges, chips |
| `text.base` | 16 | 1 | 1.5 | Archivo 400 | 0 | body, inputs, table cells |
| `text.lg` | 20 | 1.25 | 1.4 | Archivo 500 | −0.005em | card titles, lead paragraphs |
| `text.xl` | 25 | 1.5625 | 1.3 | Archivo 600 | −0.01em | section headings (h3) |
| `text.2xl` | 31.25 → **31** | 1.9531 | 1.25 | Fraunces 560 | −0.012em | page titles (h2) |
| `text.3xl` | 39.06 → **39** | 2.4414 | 1.2 | Fraunces 560 | −0.015em | view headers (h1) |
| `text.4xl` | 48.83 → **49** | 3.0518 | 1.15 | Fraunces 560 | −0.018em | marketing hero, KPI hero numerals |
| `text.5xl` | 61.04 → **61** | 3.8147 | 1.1 | Fraunces 480 | −0.02em | brand moments only (landing) |

Fluid forms (viewport-interpolated, from legacy architecture §4.1 — keep `clamp()`):

```css
--text-sm:   clamp(0.8125rem, 0.78rem + 0.15vw, 0.875rem);
--text-base: clamp(0.875rem,  0.82rem + 0.30vw, 1rem);
--text-lg:   clamp(1rem,      0.90rem + 0.50vw, 1.25rem);
--text-xl:   clamp(1.25rem,   1.10rem + 0.75vw, 1.5625rem);
--text-2xl:  clamp(1.5625rem, 1.30rem + 1.30vw, 1.9531rem);
--text-3xl:  clamp(1.9531rem, 1.55rem + 2.00vw, 2.4414rem);
```

### 3.3 Semantic text styles

| Style | Compose of | Notes |
|---|---|---|
| `overline` | caption · Archivo 700 · +0.12em · uppercase · `text.muted` | filter labels ("BUDGET CEILING"), table group headers |
| `figure` | mono 500 · tabular-nums | prices, lbs, scores inside sentences |
| `figure.strong` | mono 700 | KPI values, composite scores |
| `label` | sm · Archivo 600 | form labels, button text |
| `link` | base · teal-600 · underline offset 3px | hover: teal-700 |

---

## 4. Spacing (4dp base grid)

| Token | dp/rem | Use |
|---|---|---|
| `space.0` | 0 | — |
| `space.1` | 4 / 0.25rem | icon gaps, chip inner-y |
| `space.2` | 8 / 0.5rem | tight element gaps, badge padding-x |
| `space.3` | 12 / 0.75rem | input padding-y, card section gaps |
| `space.4` | 16 / 1rem | default gap, input padding-x, card padding (compact) |
| `space.5` | 20 / 1.25rem | card padding (default) |
| `space.6` | 24 / 1.5rem | section padding, modal padding |
| `space.8` | 32 / 2rem | card stacks, grid gutters |
| `space.10` | 40 / 2.5rem | view section breaks |
| `space.12` | 48 / 3rem | page section breaks |

Layout extensions (multiples of 8, beyond the 4–48 core): `space.16` = 64, `space.20` = 80, `space.24` = 96 — page-level rhythm only. **Nothing renders off-grid: all margins/paddings must resolve to a token.**

Component density presets: `comfortable` (default: row h 48, card p 20) · `compact` (data tables: row h 40, card p 16) · `spacious` (marketing: card p 24).

## 5. Radius

| Token | px | Use |
|---|---|---|
| `radius.xs` | 2 | table cell highlights |
| `radius.sm` | 4 | checkboxes, small chips, sort buttons |
| `radius.md` | 6 | inputs, buttons |
| `radius.lg` | 8 | cards, dropdowns |
| `radius.xl` | 12 | modals, drawer panels |
| `radius.2xl` | 16 | sheets, hero panels |
| `radius.full` | 9999 | badges, score pills, avatar, metric tracks |

Brand note: corners stay **small and precise** (4–8) — the brand is a ledger, not a toy. `2xl` reserved for marketing surfaces.

## 6. Elevation (warm-tinted, navy-based shadows)

Light mode shadows are tinted with Compass Navy `rgb(22 50 62)` — never neutral black — so depth feels printed, not dropped.

| Token | Light value | Dark value |
|---|---|---|
| `elevation.0` | none | none |
| `elevation.1` | `0 1px 2px 0 rgb(22 50 62 / 0.07)` | `0 1px 2px 0 rgb(0 0 0 / 0.40)` |
| `elevation.2` | `0 2px 4px -1px rgb(22 50 62 / 0.08), 0 4px 8px -2px rgb(22 50 62 / 0.06)` | `0 2px 4px -1px rgb(0 0 0 / 0.45), 0 4px 8px -2px rgb(0 0 0 / 0.40)` |
| `elevation.3` | `0 4px 8px -2px rgb(22 50 62 / 0.09), 0 10px 20px -4px rgb(22 50 62 / 0.08)` | `0 4px 8px -2px rgb(0 0 0 / 0.50), 0 10px 20px -4px rgb(0 0 0 / 0.45)` |
| `elevation.4` | `0 8px 16px -4px rgb(22 50 62 / 0.10), 0 20px 32px -8px rgb(22 50 62 / 0.10)` | `0 8px 16px -4px rgb(0 0 0 / 0.55), 0 20px 32px -8px rgb(0 0 0 / 0.50)` |
| `elevation.5` | `0 16px 48px -8px rgb(22 50 62 / 0.18)` | `0 16px 48px -8px rgb(0 0 0 / 0.60)` |

Placement: cards rest at `1` → hover `3`; dropdowns/popovers `2`; sticky bars `2`; modals `4`; drawers/toasts `5`.

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `duration.instant` | 100ms | hover color fades |
| `duration.fast` | 150ms | button press, chip toggle |
| `duration.base` | 250ms | card lift, menu open, tab switch |
| `duration.slow` | 350ms | filter panel expand, drawer slide |
| `duration.slower` | 500ms | metric-bar fills, chart mount, page transitions |
| `ease.standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | default in-out |
| `ease.out` | `cubic-bezier(0, 0, 0.2, 1)` | entrances |
| `ease.in` | `cubic-bezier(0.4, 0, 1, 1)` | exits |
| `ease.compass` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | spring settle: badge pop, winner reveal, toast |

Choreography rules: stagger list items ≤ 40ms each, max 8 items; metric bars fill once on mount (`slow`/`ease.out`); **nothing loops** except the loading spinner; `prefers-reduced-motion` collapses all durations to `instant` and disables parallax/stagger.

## 8. Layout, breakpoints, z-index, opacity

| Token | Value |
|---|---|
| `breakpoint.xs/sm/md/lg/xl/2xl` | 480 / 640 / 768 / 1024 / 1280 / 1536 px |
| `container.sm/md/lg/xl/2xl` | 640 / 768 / 1024 / 1280 / 1536 px |
| App shell | sidebar 264 px (collapses to 72 px icon rail < lg; overlay drawer < md); topbar 64 px |
| `z.base/dropdown/sticky/modal/overlay/max` | 1 / 10 / 20 / 50 / 100 / 999 |
| `opacity.disabled` | 0.45 (plus `cursor: not-allowed`) |
| `opacity.scrim` | navy-900 at 0.5 |
| `opacity.stamp` | 0.85 (Lot Stamp texture) |

---

## 9. `tokens.json` — W3C Design Tokens (DTCG) format

Theme switching: `color.semantic.light` / `color.semantic.dark` mirror each other 1:1; build tooling (Style Dictionary) emits `:root{...}` and `[data-theme="dark"]{...}` from this file.

```json
{
  "$description": "Greensheet design tokens v1.0 — ODASI product family. W3C DTCG draft format.",
  "gs": {
    "color": {
      "primitive": {
        "navy": {
          "900": { "$value": "#0E1A22", "$type": "color" },
          "800": { "$value": "#12252F", "$type": "color" },
          "700": { "$value": "#16323E", "$type": "color", "$description": "Compass Navy — primary brand" },
          "600": { "$value": "#1F4F54", "$type": "color" }
        },
        "teal": {
          "700": { "$value": "#1F4F54", "$type": "color" },
          "600": { "$value": "#2A6E73", "$type": "color", "$description": "Constellation Teal" },
          "500": { "$value": "#3D8A90", "$type": "color" },
          "300": { "$value": "#7FB6BA", "$type": "color" },
          "100": { "$value": "#DCEAEA", "$type": "color" }
        },
        "gold": {
          "600": { "$value": "#7A5F22", "$type": "color" },
          "500": { "$value": "#C9A34A", "$type": "color", "$description": "Core Gold — earned accent only" },
          "300": { "$value": "#D4B96A", "$type": "color" },
          "100": { "$value": "#F0E6CC", "$type": "color" }
        },
        "cherry": {
          "600": { "$value": "#8C3B34", "$type": "color", "$description": "Coffee Cherry" },
          "300": { "$value": "#E8B4A6", "$type": "color" },
          "100": { "$value": "#F9E6E2", "$type": "color" }
        },
        "roast": {
          "800": { "$value": "#3A2A1E", "$type": "color" },
          "700": { "$value": "#4A3527", "$type": "color", "$description": "Roast Brown — stamp ink" },
          "100": { "$value": "#E9DFD2", "$type": "color" }
        },
        "green": {
          "600": { "$value": "#3E6B50", "$type": "color", "$description": "Greensheet Green — ESG/certified" },
          "300": { "$value": "#9FD3B4", "$type": "color" },
          "100": { "$value": "#E5EFE7", "$type": "color" }
        },
        "parchment": {
          "50":  { "$value": "#FDFBF5", "$type": "color" },
          "100": { "$value": "#F6F1E7", "$type": "color", "$description": "Parchment — the green sheet ground" },
          "200": { "$value": "#EFE8DA", "$type": "color" },
          "300": { "$value": "#E4DCC9", "$type": "color" }
        },
        "neutral": {
          "400": { "$value": "#D8CFBB", "$type": "color" },
          "500": { "$value": "#B9AE97", "$type": "color" },
          "600": { "$value": "#8A8272", "$type": "color" },
          "700": { "$value": "#5C5546", "$type": "color" }
        },
        "ink": {
          "900": { "$value": "#221D16", "$type": "color" }
        },
        "status": {
          "success": { "$value": "#33684A", "$type": "color" },
          "successBg": { "$value": "#E5EFE7", "$type": "color" },
          "warning": { "$value": "#8A5F14", "$type": "color" },
          "warningBg": { "$value": "#FBF0DA", "$type": "color" },
          "danger":  { "$value": "#9E3D31", "$type": "color" },
          "dangerBg":  { "$value": "#F9E6E2", "$type": "color" },
          "info":    { "$value": "#2C6E8C", "$type": "color" },
          "infoBg":    { "$value": "#E4EEF3", "$type": "color" }
        }
      },
      "semantic": {
        "light": {
          "bg-canvas":    { "$value": "{gs.color.primitive.parchment.100}", "$type": "color" },
          "bg-surface":   { "$value": "{gs.color.primitive.parchment.50}", "$type": "color" },
          "bg-recessed":  { "$value": "{gs.color.primitive.parchment.200}", "$type": "color" },
          "bg-hover":     { "$value": "{gs.color.primitive.parchment.300}", "$type": "color" },
          "bg-inverse":   { "$value": "{gs.color.primitive.navy.700}", "$type": "color" },
          "text-primary": { "$value": "{gs.color.primitive.ink.900}", "$type": "color" },
          "text-muted":   { "$value": "{gs.color.primitive.neutral.700}", "$type": "color" },
          "text-subtle":  { "$value": "{gs.color.primitive.neutral.600}", "$type": "color" },
          "text-inverse": { "$value": "{gs.color.primitive.parchment.50}", "$type": "color" },
          "text-link":    { "$value": "{gs.color.primitive.teal.600}", "$type": "color" },
          "action-primary-bg":     { "$value": "{gs.color.primitive.navy.700}", "$type": "color" },
          "action-primary-hover":  { "$value": "{gs.color.primitive.navy.800}", "$type": "color" },
          "action-secondary-bg":   { "$value": "{gs.color.primitive.teal.600}", "$type": "color" },
          "action-secondary-hover":{ "$value": "{gs.color.primitive.teal.700}", "$type": "color" },
          "accent-gold":       { "$value": "{gs.color.primitive.gold.500}", "$type": "color" },
          "accent-gold-text":  { "$value": "{gs.color.primitive.gold.600}", "$type": "color" },
          "accent-cherry":     { "$value": "{gs.color.primitive.cherry.600}", "$type": "color" },
          "brand-green":       { "$value": "{gs.color.primitive.green.600}", "$type": "color" },
          "border-decorative": { "$value": "{gs.color.primitive.neutral.400}", "$type": "color" },
          "border-strong":     { "$value": "{gs.color.primitive.neutral.500}", "$type": "color" },
          "border-interactive":{ "$value": "{gs.color.primitive.neutral.600}", "$type": "color" },
          "border-focus":      { "$value": "{gs.color.primitive.teal.600}", "$type": "color" },
          "status-success":    { "$value": "{gs.color.primitive.status.success}", "$type": "color" },
          "status-success-bg": { "$value": "{gs.color.primitive.status.successBg}", "$type": "color" },
          "status-warning":    { "$value": "{gs.color.primitive.status.warning}", "$type": "color" },
          "status-warning-bg": { "$value": "{gs.color.primitive.status.warningBg}", "$type": "color" },
          "status-danger":     { "$value": "{gs.color.primitive.status.danger}", "$type": "color" },
          "status-danger-bg":  { "$value": "{gs.color.primitive.status.dangerBg}", "$type": "color" },
          "status-info":       { "$value": "{gs.color.primitive.status.info}", "$type": "color" },
          "status-info-bg":    { "$value": "{gs.color.primitive.status.infoBg}", "$type": "color" }
        },
        "dark": {
          "bg-canvas":    { "$value": "#101B23", "$type": "color" },
          "bg-surface":   { "$value": "#1B2933", "$type": "color" },
          "bg-recessed":  { "$value": "#22333F", "$type": "color" },
          "bg-hover":     { "$value": "#2A3D49", "$type": "color" },
          "bg-inverse":   { "$value": "{gs.color.primitive.parchment.100}", "$type": "color" },
          "text-primary": { "$value": "#EFE9DB", "$type": "color" },
          "text-muted":   { "$value": "#A9A08C", "$type": "color" },
          "text-subtle":  { "$value": "#8A8272", "$type": "color" },
          "text-inverse": { "$value": "#101B23", "$type": "color" },
          "text-link":    { "$value": "{gs.color.primitive.teal.300}", "$type": "color" },
          "action-primary-bg":     { "$value": "{gs.color.primitive.teal.300}", "$type": "color" },
          "action-primary-hover":  { "$value": "#93C4C7", "$type": "color" },
          "action-secondary-bg":   { "$value": "#2F7E84", "$type": "color" },
          "action-secondary-hover":{ "$value": "{gs.color.primitive.teal.500}", "$type": "color" },
          "accent-gold":       { "$value": "{gs.color.primitive.gold.300}", "$type": "color" },
          "accent-gold-text":  { "$value": "{gs.color.primitive.gold.300}", "$type": "color" },
          "accent-cherry":     { "$value": "{gs.color.primitive.cherry.300}", "$type": "color" },
          "brand-green":       { "$value": "{gs.color.primitive.green.300}", "$type": "color" },
          "border-decorative": { "$value": "#3A4B57", "$type": "color" },
          "border-strong":     { "$value": "#4A5B68", "$type": "color" },
          "border-interactive":{ "$value": "#5F7180", "$type": "color" },
          "border-focus":      { "$value": "{gs.color.primitive.teal.300}", "$type": "color" },
          "status-success":    { "$value": "#9FD3B4", "$type": "color" },
          "status-success-bg": { "$value": "#1E3328", "$type": "color" },
          "status-warning":    { "$value": "#E3B76B", "$type": "color" },
          "status-warning-bg": { "$value": "#3A2E17", "$type": "color" },
          "status-danger":     { "$value": "#E89A8F", "$type": "color" },
          "status-danger-bg":  { "$value": "#3A1F1B", "$type": "color" },
          "status-info":       { "$value": "#8FC3D9", "$type": "color" },
          "status-info-bg":    { "$value": "#1B2C38", "$type": "color" }
        }
      }
    },
    "font": {
      "family": {
        "display": { "$value": ["Fraunces", "Cormorant Garamond", "Georgia", "serif"], "$type": "fontFamily" },
        "sans":    { "$value": ["Archivo", "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"], "$type": "fontFamily" },
        "mono":    { "$value": ["IBM Plex Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"], "$type": "fontFamily" }
      },
      "size": {
        "caption": { "$value": "0.8125rem", "$type": "dimension" },
        "sm":      { "$value": "0.875rem",  "$type": "dimension" },
        "base":    { "$value": "1rem",      "$type": "dimension" },
        "lg":      { "$value": "1.25rem",   "$type": "dimension" },
        "xl":      { "$value": "1.5625rem", "$type": "dimension" },
        "2xl":     { "$value": "1.9531rem", "$type": "dimension" },
        "3xl":     { "$value": "2.4414rem", "$type": "dimension" },
        "4xl":     { "$value": "3.0518rem", "$type": "dimension" },
        "5xl":     { "$value": "3.8147rem", "$type": "dimension" }
      },
      "lineHeight": {
        "display":  { "$value": "1.1",  "$type": "number" },
        "tight":    { "$value": "1.15", "$type": "number" },
        "snug":     { "$value": "1.3",  "$type": "number" },
        "normal":   { "$value": "1.5",  "$type": "number" },
        "relaxed":  { "$value": "1.7",  "$type": "number" }
      },
      "letterSpacing": {
        "display":  { "$value": "-0.015em", "$type": "dimension" },
        "tight":    { "$value": "-0.01em",  "$type": "dimension" },
        "normal":   { "$value": "0",        "$type": "dimension" },
        "overline": { "$value": "0.12em",   "$type": "dimension" }
      }
    },
    "space": {
      "0":  { "$value": "0",       "$type": "dimension" },
      "1":  { "$value": "0.25rem", "$type": "dimension", "$description": "4dp" },
      "2":  { "$value": "0.5rem",  "$type": "dimension", "$description": "8dp" },
      "3":  { "$value": "0.75rem", "$type": "dimension", "$description": "12dp" },
      "4":  { "$value": "1rem",    "$type": "dimension", "$description": "16dp" },
      "5":  { "$value": "1.25rem", "$type": "dimension", "$description": "20dp" },
      "6":  { "$value": "1.5rem",  "$type": "dimension", "$description": "24dp" },
      "8":  { "$value": "2rem",    "$type": "dimension", "$description": "32dp" },
      "10": { "$value": "2.5rem",  "$type": "dimension", "$description": "40dp" },
      "12": { "$value": "3rem",    "$type": "dimension", "$description": "48dp" },
      "16": { "$value": "4rem",    "$type": "dimension", "$description": "64dp — layout only" },
      "20": { "$value": "5rem",    "$type": "dimension", "$description": "80dp — layout only" },
      "24": { "$value": "6rem",    "$type": "dimension", "$description": "96dp — layout only" }
    },
    "radius": {
      "xs":   { "$value": "2px",    "$type": "dimension" },
      "sm":   { "$value": "4px",    "$type": "dimension" },
      "md":   { "$value": "6px",    "$type": "dimension" },
      "lg":   { "$value": "8px",    "$type": "dimension" },
      "xl":   { "$value": "12px",   "$type": "dimension" },
      "2xl":  { "$value": "16px",   "$type": "dimension" },
      "full": { "$value": "9999px", "$type": "dimension" }
    },
    "elevation": {
      "0": { "$value": "none", "$type": "shadow" },
      "1": { "$value": "0 1px 2px 0 rgb(22 50 62 / 0.07)", "$type": "shadow" },
      "2": { "$value": "0 2px 4px -1px rgb(22 50 62 / 0.08), 0 4px 8px -2px rgb(22 50 62 / 0.06)", "$type": "shadow" },
      "3": { "$value": "0 4px 8px -2px rgb(22 50 62 / 0.09), 0 10px 20px -4px rgb(22 50 62 / 0.08)", "$type": "shadow" },
      "4": { "$value": "0 8px 16px -4px rgb(22 50 62 / 0.10), 0 20px 32px -8px rgb(22 50 62 / 0.10)", "$type": "shadow" },
      "5": { "$value": "0 16px 48px -8px rgb(22 50 62 / 0.18)", "$type": "shadow" }
    },
    "motion": {
      "duration": {
        "instant": { "$value": "100ms", "$type": "duration" },
        "fast":    { "$value": "150ms", "$type": "duration" },
        "base":    { "$value": "250ms", "$type": "duration" },
        "slow":    { "$value": "350ms", "$type": "duration" },
        "slower":  { "$value": "500ms", "$type": "duration" }
      },
      "easing": {
        "standard": { "$value": "cubic-bezier(0.4, 0, 0.2, 1)", "$type": "cubicBezier" },
        "out":      { "$value": "cubic-bezier(0, 0, 0.2, 1)", "$type": "cubicBezier" },
        "in":       { "$value": "cubic-bezier(0.4, 0, 1, 1)", "$type": "cubicBezier" },
        "compass":  { "$value": "cubic-bezier(0.34, 1.56, 0.64, 1)", "$type": "cubicBezier" }
      }
    },
    "zIndex": {
      "base":     { "$value": "1",   "$type": "number" },
      "dropdown": { "$value": "10",  "$type": "number" },
      "sticky":   { "$value": "20",  "$type": "number" },
      "modal":    { "$value": "50",  "$type": "number" },
      "overlay":  { "$value": "100", "$type": "number" },
      "max":      { "$value": "999", "$type": "number" }
    },
    "breakpoint": {
      "xs":  { "$value": "480px",  "$type": "dimension" },
      "sm":  { "$value": "640px",  "$type": "dimension" },
      "md":  { "$value": "768px",  "$type": "dimension" },
      "lg":  { "$value": "1024px", "$type": "dimension" },
      "xl":  { "$value": "1280px", "$type": "dimension" },
      "2xl": { "$value": "1536px", "$type": "dimension" }
    },
    "opacity": {
      "disabled": { "$value": "0.45", "$type": "number" },
      "scrim":    { "$value": "0.5",  "$type": "number" },
      "stamp":    { "$value": "0.85", "$type": "number" }
    }
  }
}
```

---

## 10. Tailwind CSS config extension

Consume semantic tokens as CSS variables so dark mode is a single attribute flip. Add to `tailwind.config.js`:

```js
// tailwind.config.js — Greensheet extension
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // semantic (CSS-var backed; vars emitted from tokens.json)
        canvas:    'rgb(var(--gs-bg-canvas) / <alpha-value>)',
        surface:   'rgb(var(--gs-bg-surface) / <alpha-value>)',
        recessed:  'rgb(var(--gs-bg-recessed) / <alpha-value>)',
        ink:       'rgb(var(--gs-text-primary) / <alpha-value>)',
        muted:     'rgb(var(--gs-text-muted) / <alpha-value>)',
        subtle:    'rgb(var(--gs-text-subtle) / <alpha-value>)',
        // brand primitives (static)
        navy:   { DEFAULT: '#16323E', 800: '#12252F', 900: '#0E1A22', 600: '#1F4F54' },
        teal:   { DEFAULT: '#2A6E73', 700: '#1F4F54', 500: '#3D8A90', 300: '#7FB6BA', 100: '#DCEAEA' },
        gold:   { DEFAULT: '#C9A34A', 600: '#7A5F22', 300: '#D4B96A', 100: '#F0E6CC' },
        cherry: { DEFAULT: '#8C3B34', 300: '#E8B4A6', 100: '#F9E6E2' },
        roast:  { DEFAULT: '#4A3527', 800: '#3A2A1E', 100: '#E9DFD2' },
        leaf:   { DEFAULT: '#3E6B50', 300: '#9FD3B4', 100: '#E5EFE7' },  // greensheet green
        parchment: { DEFAULT: '#F6F1E7', 50: '#FDFBF5', 200: '#EFE8DA', 300: '#E4DCC9' },
        success: { DEFAULT: '#33684A', bg: '#E5EFE7' },
        warning: { DEFAULT: '#8A5F14', bg: '#FBF0DA' },
        danger:  { DEFAULT: '#9E3D31', bg: '#F9E6E2' },
        info:    { DEFAULT: '#2C6E8C', bg: '#E4EEF3' },
      },
      fontFamily: {
        display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['0.8125rem', { lineHeight: '1.3',  letterSpacing: '0.02em' }],
        sm:      ['0.875rem',  { lineHeight: '1.5' }],
        base:    ['1rem',      { lineHeight: '1.5' }],
        lg:      ['1.25rem',   { lineHeight: '1.4',  letterSpacing: '-0.005em' }],
        xl:      ['1.5625rem', { lineHeight: '1.3',  letterSpacing: '-0.01em' }],
        '2xl':   ['1.9531rem', { lineHeight: '1.25', letterSpacing: '-0.012em' }],
        '3xl':   ['2.4414rem', { lineHeight: '1.2',  letterSpacing: '-0.015em' }],
        '4xl':   ['3.0518rem', { lineHeight: '1.15', letterSpacing: '-0.018em' }],
        '5xl':   ['3.8147rem', { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
      },
      spacing: {
        // 4dp core grid (Tailwind already matches at 1–12; explicit for linting)
        18: '4.5rem', 22: '5.5rem', // layout extensions only
      },
      borderRadius: {
        xs: '2px', sm: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px',
      },
      boxShadow: {
        'e1': '0 1px 2px 0 rgb(22 50 62 / 0.07)',
        'e2': '0 2px 4px -1px rgb(22 50 62 / 0.08), 0 4px 8px -2px rgb(22 50 62 / 0.06)',
        'e3': '0 4px 8px -2px rgb(22 50 62 / 0.09), 0 10px 20px -4px rgb(22 50 62 / 0.08)',
        'e4': '0 8px 16px -4px rgb(22 50 62 / 0.10), 0 20px 32px -8px rgb(22 50 62 / 0.10)',
        'e5': '0 16px 48px -8px rgb(22 50 62 / 0.18)',
      },
      transitionDuration: {
        instant: '100ms', fast: '150ms', base: '250ms', slow: '350ms', slower: '500ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        compass:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      screens: { xs: '480px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
      zIndex: { dropdown: '10', sticky: '20', modal: '50', overlay: '100', max: '999' },
    },
  },
  plugins: [
    // lints: forbid arbitrary hex — tokens only
  ],
};
```

Corresponding CSS variables (emitted by Style Dictionary from `tokens.json`; shown for reference):

```css
:root {
  --gs-bg-canvas: 246 241 231;   /* parchment-100 */
  --gs-bg-surface: 253 251 245;
  --gs-bg-recessed: 239 232 218;
  --gs-text-primary: 34 29 22;
  --gs-text-muted: 92 85 70;
  --gs-text-subtle: 138 130 114;
}
[data-theme="dark"] {
  --gs-bg-canvas: 16 27 35;
  --gs-bg-surface: 27 41 51;
  --gs-bg-recessed: 34 51 63;
  --gs-text-primary: 239 233 219;
  --gs-text-muted: 169 160 140;
  --gs-text-subtle: 138 130 114;
}
```

---

## 11. Token traceability ledger

| Token | Traces to |
|---|---|
| navy-700 `#16323E` | ODASI compass navy `#142435` (sampled from parent mark), lightened +6% for UI text AA |
| teal-600 `#2A6E73` | ODASI constellation teal `#3D7681` (sampled), darkened to reach 4.5:1 with white |
| gold-500 `#C9A34A` | ODASI core gold `#968853` (sampled), brightened for badge graphics; gold-600 `#7A5F22` derived for text AA |
| parchment-100 `#F6F1E7` | legacy `--color-paper #fbfaf6`, warmed toward green-sheet paper stock |
| ink-900 `#221D16` | legacy `--color-ink #26201a`, deepened slightly for AAA on parchment |
| green-600 `#3E6B50` | legacy `--color-primary #2f6b4a`, desaturated to sit beside navy |
| status.* | legacy `--color-success/warning/danger/info`, re-balanced; warning darkened `#a8721f → #8A5F14` to reach AA |
| type scale 1.25 / Archivo / Fraunces / IBM Plex Mono | legacy §4.1 font stacks and modular ratio, fixed-step rendering of its fluid clamps |
| radius 2–16, durations 100–500, easings | legacy §4.1 values, pruned (bounce → `ease.compass`, scoped to badge/winner moments) |
| cherry/roast | new to this system — coffee materiality (cherry fruit, roast profile); no legacy equivalent |

**Governance:** any new token requires (a) a role name, (b) a computed contrast note, (c) an entry in this ledger. Ad-hoc hex in product code fails CI stylelint.
