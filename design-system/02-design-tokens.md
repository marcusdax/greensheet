# Auctum Ledger — Design Tokens

**Version 2.0 · The Auctum Ledger (formerly Greensheet) · Source of truth for all UI color, type, space, elevation, and motion · WCAG 2.2 AA minimum · Museum Folio palette**

Token architecture has three tiers. **Engineers consume tier 2 (semantic) and tier 3 (component) tokens only.** Tier 1 primitives exist so a rebrand never touches component code.

```
primitive  (auctum-color-oxblood-700)   raw values, named by hue+step
   ↓ alias
semantic   (auctum-color-action-primary)   role-based, theme-switched (light/dark)
   ↓ alias
component  (auctum-button-primary-bg)   bound to a component slot
```

All contrast ratios below were computed with the WCAG 2.x relative-luminance formula. "AA ✓" = ≥ 4.5:1 for normal text; "AA-large ✓" = ≥ 3:1 (18 pt / 14 pt bold+, and non-text UI per 1.4.11).

The palette is **Museum Folio** (Auctum master brand): restraint, archival, editorial. Ivory paper grounds, near-black ink, a single oxblood accent, brass for metadata, hairline borders always 1 px. No gradients, no saturated fills, no blue-purple.

---

## 1. Color — Tier 1 primitives

### 1.1 Brand hues (Museum Folio, with lineage)

| Token | Hex | HSL | Source |
|---|---|---|---|
| **`ink-900` (Ink)** | `#221E1B` | 24 12% 12% | **primary brand ink** — Museum Folio `ink` |
| `ink-700` (Ink Soft) | `#58514B` | 26 8% 32% | Museum Folio `ink-soft` — secondary text |
| **`oxblood-700` (Oxblood)** | `#74362F` | 6 42% 32% | Museum Folio `oxblood` — **THE accent**: active nav, seals, underlines, key figures |
| `oxblood-800` | `#5E2B25` | — | oxblood hover/active, deepened |
| `oxblood-300` | `#C9978F` | — | dark-mode accent |
| `oxblood-100` | `#F2E3E0` | — | oxblood tint surface |
| **`brass-500` (Brass)** | `#947642` | 38 38% 42% | Museum Folio `brass` — fig captions, rules, metadata |
| `brass-600` | `#6E572C` | — | brass words on paper (AA) |
| `brass-300` | `#C9A86A` | — | dark-mode brass |
| `brass-100` | `#F0E6CC` | — | brass tint surface |
| **`sage-600` (Sage)** | `#4F6958` | 140 14% 36% | Museum Folio success — verified states, ESG/certified |
| `sage-700` | `#3E5546` | — | sage text on tints |
| `sage-300` | `#8FAF9B` | — | dark-mode sage |
| `sage-100` | `#E4EBE4` | — | sage tint surface |

### 1.2 Warm neutral ramp (paper scale)

| Token | Hex | Role |
|---|---|---|
| `paper-50` | `#FAF9F4` | raised surface — Museum Folio `paper-raised` (cards, plates, inputs) |
| **`paper-100`** | `#F5F2EB` | **page ground** — Museum Folio `paper` (ivory) |
| `paper-200` | `#EDE7DA` | recessed surface, table zebra |
| `paper-300` | `#E4DECE` | hover on recessed |
| **`neutral-400` (Hairline)** | `#D9D3C9` | Museum Folio `hairline` — decorative border, always 1 px (1.33:1 — decorative only) |
| `neutral-500` | `#B9AE97` | strong decorative border |
| `neutral-600` | `#8A8272` | **interactive border** (3.40:1 ✓ 1.4.11), muted-light large text (AA-large only) |
| `neutral-700` | `#5C5546` | muted body text (6.97:1 AA ✓) |

---

## 2. Color — Tier 2 semantic (light + dark)

### 2.1 Light mode (default)

| Semantic token | Value | Used for | Contrast (vs. stated ground) |
|---|---|---|---|
| `color.bg.canvas` | `paper-100 #F5F2EB` | app background | — |
| `color.bg.surface` | `paper-50 #FAF9F4` | cards, archival plates, tables, inputs | — |
| `color.bg.recessed` | `paper-200 #EDE7DA` | wells, metric tracks, zebra | — |
| `color.bg.hover` | `paper-300 #E4DECE` | hover on recessed rows | — |
| `color.bg.inverse` | `ink-900 #221E1B` | top bar, footer band, tooltips | — |
| `color.text.primary` | `ink-900 #221E1B` | headings, body | 14.79:1 on canvas AAA ✓ · 15.69:1 on surface AAA ✓ |
| `color.text.muted` | `ink-700 #58514B` | secondary text, labels | 6.97:1 AA ✓ |
| `color.text.subtle` | `neutral-600 #8A8272` | captions ≥12 px bold, placeholders | 3.40:1 AA-large only — never for body |
| `color.text.inverse` | `#FAF9F4` | text on ink fills | 15.69:1 on ink-900 AAA ✓ |
| `color.text.link` | `oxblood-700 #74362F` | inline links (always underlined) | 8.13:1 AA ✓ |
| `color.action.primary.bg` | `oxblood-700 #74362F` | primary button fill | paper-raised text 8.62:1 AAA ✓ |
| `color.action.primary.hover` | `oxblood-800 #5E2B25` | primary hover | white 11.36:1 AAA ✓ |
| `color.action.secondary.bg` | `ink-900 #221E1B` | secondary button fill | paper-raised 15.69:1 AAA ✓ |
| `color.action.secondary.hover` | `ink-700 #58514B` | secondary hover | white 7.80:1 AA ✓ |
| `color.accent.oxblood` | `oxblood-700 #74362F` | seals, active nav, underlines, key figures | on canvas 8.13:1 AA ✓ |
| `color.accent.brass` | `brass-500 #947642` | fig captions, rules, metadata (non-text) | decorative · ink text 3.88:1 AA-large only |
| `color.accent.brass.text` | `brass-600 #6E572C` | brass words on paper | 6.13:1 AA ✓ |
| `color.brand.sage` | `sage-600 #4F6958` | verified states, ESG, certifications | white 6.01:1 AA ✓ · on canvas 5.38:1 AA ✓ |
| `color.border.decorative` | `neutral-400 #D9D3C9` | card hairlines, dividers — always 1 px | decorative (no requirement) |
| `color.border.strong` | `neutral-500 #B9AE97` | table outer frame | decorative |
| `color.border.interactive` | `neutral-600 #8A8272` | input/select/checkbox outlines | 3.40:1 ✓ 1.4.11 |
| `color.border.focus` | `oxblood-700 #74362F` | focus ring (2 px + 2 px offset) | 8.13:1 ✓ 1.4.11 |

### 2.2 Functional / status (light)

| Token | Text/base | Tint bg | Pairing check |
|---|---|---|---|
| `color.status.success` | `#4F6958` (sage-600) · text-on-tint `#3E5546` | `#E4EBE4` | on canvas 5.38:1 AA ✓ · on tint 6.67:1 AA ✓ · white on base 6.01:1 AA ✓ |
| `color.status.warning` | `#A36A29` · text-on-tint `#7E521F` | `#F6EBD8` | on canvas 4.04:1 AA-large · on tint 5.71:1 AA ✓ · white on base 4.52:1 AA ✓ |
| `color.status.danger` | `#962C2C` | `#F5E0DE` | on canvas 6.97:1 AA ✓ · on tint 6.16:1 AA ✓ · white on base 7.80:1 AA ✓ |
| `color.status.info` | `#6E572C` (brass-600) | `#F0E6CC` | on canvas 6.13:1 AA ✓ · on tint 5.52:1 AA ✓ — Museum Folio has no blue; informational states are brass |

### 2.3 Cup-score semantic scale (CQI tiers — used by badges, charts, filters)

| Tier | Range | Token pair | Rationale |
|---|---|---|---|
| Outstanding | 90.0–100 | `brass-300` bg + `ink-900` text (7.32:1 AAA ✓) | brass is *earned* |
| Excellent | 85.0–89.9 | `oxblood-700` bg + `paper-50` (8.62:1 AAA ✓) | house tier |
| Very Good | 80.0–84.9 | `sage-600` bg + white (6.01:1 AA ✓) | specialty floor |
| Below specialty | < 80.0 | `neutral-700` bg + white (7.39:1 AAA ✓) | de-emphasized |

### 2.4 Dark mode (`data-theme="dark"` or `prefers-color-scheme`)

Warm espresso-ink darks — **never pure black, never cool gray.**

| Semantic token | Dark value | Contrast |
|---|---|---|
| `color.bg.canvas` | `#16120E` | — |
| `color.bg.surface` | `#211B14` | — |
| `color.bg.recessed` | `#2A2318` | text on it 13.31:1 AAA ✓ |
| `color.bg.hover` | `#362C1E` | — |
| `color.bg.inverse` | `#F5F2EB` | — |
| `color.text.primary` | `#F2EDE3` | 15.97:1 on canvas AAA ✓ · 14.61:1 on surface AAA ✓ |
| `color.text.muted` | `#B3A996` | 8.01:1 on canvas AA ✓ · 7.33:1 on surface AA ✓ |
| `color.text.subtle` | `#8A8272` | 4.90:1 on canvas AA ✓ (captions only) |
| `color.text.inverse` | `#16120E` | for text on oxblood-300/brass-300 fills (7.37/8.25:1 AAA ✓) |
| `color.text.link` | `#C9978F` (oxblood-300) | 7.37:1 AAA ✓ |
| `color.action.primary.bg` | `#C9978F` (oxblood-300) | canvas-ink text `#16120E` 7.37:1 AAA ✓ |
| `color.action.primary.hover` | `#D8B0A8` | — |
| `color.action.secondary.bg` | `#3A3226` | text `#F2EDE3` 10.82:1 AAA ✓ |
| `color.action.secondary.hover` | `#4A3F2E` | — |
| `color.accent.oxblood` | `#C9978F` (oxblood-300) | canvas text 7.37:1 AAA ✓ |
| `color.accent.brass` | `#C9A86A` (brass-300) | canvas text 8.25:1 AAA ✓ |
| `color.brand.sage` | `#8FAF9B` (sage-300) | 7.78:1 AAA ✓ |
| `color.border.decorative` | `#3A3226` | decorative |
| `color.border.strong` | `#4A3F2E` | decorative |
| `color.border.interactive` | `#7A6F5C` | 3.46:1 ✓ 1.4.11 |
| `color.border.focus` | `#C9978F` | 7.37:1 ✓ |
| `color.status.*` | success `#8FAF9B` / warning `#D9A45C` / danger `#E08A80` / info `#C9A86A` on tints at 12% alpha | 7.20–8.35:1 on canvas, all AAA/AA ✓ |

**Chart dark-mode rule:** categorical series keep light-mode hues but step one rung lighter (oxblood-700→300, brass-500→300, sage-600→300) to hold ≥3:1 against `#211B14`.

---

## 3. Typography

### 3.1 Families

| Token | Stack | Role |
|---|---|---|
| `font.display` | `"Playfair Display", Georgia, serif` | wordmark, page titles, hero numerals, italic lede, pull quotes |
| `font.sans` | `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` | UI text, labels, tables; small-caps micro-labels at 10–11 px uppercase, letter-spacing 0.18em–0.35em |
| `font.mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` | **all figures**: prices, cup scores, weights, table numerals, merge tags, FIG./PLATE captions, codes |

Families load via Google Fonts in `index.html`.

Numerals rule (from product code): every price, score, and quantity renders in `font.mono` with `font-variant-numeric: tabular-nums` — columns of figures must align like the paper ledger.

### 3.2 Modular scale — 1.25 (major third) on a 16 px base

| Token | px | rem | Line-height | Weight / face | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `text.caption` | 12.8 → **13** | 0.8125 | 1.3 | Inter 500 | +0.02em | table captions, axis labels, timestamps |
| `text.sm` | 14 | 0.875 | 1.5 | Inter 400/500 | 0 | secondary body, badges, chips |
| `text.base` | 16 | 1 | 1.5 | Inter 400 | 0 | body, inputs, table cells |
| `text.lg` | 20 | 1.25 | 1.4 | Inter 500 | −0.005em | card titles, lead paragraphs |
| `text.xl` | 25 | 1.5625 | 1.3 | Inter 600 | −0.01em | section headings (h3) |
| `text.2xl` | 31.25 → **31** | 1.9531 | 1.25 | Playfair Display 560 | −0.012em | page titles (h2) |
| `text.3xl` | 39.06 → **39** | 2.4414 | 1.2 | Playfair Display 560 | −0.015em | view headers (h1) |
| `text.4xl` | 48.83 → **49** | 3.0518 | 1.15 | Playfair Display 560 | −0.018em | marketing hero, KPI hero numerals |
| `text.5xl` | 61.04 → **61** | 3.8147 | 1.1 | Playfair Display 480 | −0.02em | brand moments only (landing) |

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
| `overline` | caption · Inter 700 · +0.18em · uppercase · `text.muted` | small-caps micro-labels ("BUDGET CEILING"), folio metadata lines, table group headers |
| `folio` | overline · brass-600 | `FOLIO 03 — THE LEDGER` metadata lines, `PLATE IV` / `FIG. 05-A` captions (mono variant for figure numbers) |
| `figure` | mono 500 · tabular-nums | prices, lbs, scores inside sentences |
| `figure.strong` | mono 700 | KPI values, composite scores |
| `label` | sm · Inter 600 | form labels, button text |
| `link` | base · oxblood-700 · underline offset 3px | hover: oxblood-800 |

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
| `radius.xs` | 2 | table cell highlights, archival plates |
| `radius.sm` | 4 | checkboxes, small chips, sort buttons, cards |
| `radius.md` | 6 | inputs, buttons |
| `radius.lg` | 8 | dropdowns |
| `radius.xl` | 12 | modals, drawer panels |
| `radius.2xl` | 16 | sheets, hero panels |
| `radius.full` | 9999 | badges, score pills, avatar, metric tracks |

Brand note: corners stay **squared or barely rounded** (2–4) — the brand is an archival folio, not a toy. `xl`+ reserved for overlays and marketing surfaces.

## 6. Elevation (warm-tinted, ink-based shadows)

Light mode shadows are tinted with Ink `rgb(34 30 27)` — never neutral black — so depth feels printed, not dropped.

| Token | Light value | Dark value |
|---|---|---|
| `elevation.0` | none | none |
| `elevation.1` | `0 1px 2px 0 rgb(34 30 27 / 0.07)` | `0 1px 2px 0 rgb(0 0 0 / 0.40)` |
| `elevation.2` | `0 2px 4px -1px rgb(34 30 27 / 0.08), 0 4px 8px -2px rgb(34 30 27 / 0.06)` | `0 2px 4px -1px rgb(0 0 0 / 0.45), 0 4px 8px -2px rgb(0 0 0 / 0.40)` |
| `elevation.3` | `0 4px 8px -2px rgb(34 30 27 / 0.09), 0 10px 20px -4px rgb(34 30 27 / 0.08)` | `0 4px 8px -2px rgb(0 0 0 / 0.50), 0 10px 20px -4px rgb(0 0 0 / 0.45)` |
| `elevation.4` | `0 8px 16px -4px rgb(34 30 27 / 0.10), 0 20px 32px -8px rgb(34 30 27 / 0.10)` | `0 8px 16px -4px rgb(0 0 0 / 0.55), 0 20px 32px -8px rgb(0 0 0 / 0.50)` |
| `elevation.5` | `0 16px 48px -8px rgb(34 30 27 / 0.18)` | `0 16px 48px -8px rgb(0 0 0 / 0.60)` |

Placement: cards rest at `1` → hover `3`; dropdowns/popovers `2`; sticky bars `2`; modals `4`; drawers/toasts `5`. Archival plates add a 1 px hairline border at every elevation.

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
| `ease.seal` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | spring settle: badge pop, seal stamp, winner reveal, toast |

Choreography rules: stagger list items ≤ 40ms each, max 8 items; metric bars fill once on mount (`slow`/`ease.out`); **nothing loops** except the loading spinner; `prefers-reduced-motion` collapses all durations to `instant` and disables parallax/stagger.

## 8. Layout, breakpoints, z-index, opacity

| Token | Value |
|---|---|
| `breakpoint.xs/sm/md/lg/xl/2xl` | 480 / 640 / 768 / 1024 / 1280 / 1536 px |
| `container.sm/md/lg/xl/2xl` | 640 / 768 / 1024 / 1280 / 1536 px |
| App shell | sidebar 264 px (collapses to 72 px icon rail < lg; overlay drawer < md); topbar 64 px |
| `z.base/dropdown/sticky/modal/overlay/max` | 1 / 10 / 20 / 50 / 100 / 999 |
| `opacity.disabled` | 0.45 (plus `cursor: not-allowed`) |
| `opacity.scrim` | ink-900 at 0.5 |
| `opacity.stamp` | 0.9 (Verification Seal texture) |

---

## 9. `tokens.json` — W3C Design Tokens (DTCG) format

Theme switching: `color.semantic.light` / `color.semantic.dark` mirror each other 1:1; build tooling (Style Dictionary) emits `:root{...}` and `[data-theme="dark"]{...}` from this file.

```json
{
  "$description": "Auctum Ledger design tokens v2.0 — Auctum master brand, Museum Folio palette. W3C DTCG draft format.",
  "auctum": {
    "color": {
      "primitive": {
        "ink": {
          "900": { "$value": "#221E1B", "$type": "color", "$description": "Ink — primary brand ink" },
          "700": { "$value": "#58514B", "$type": "color", "$description": "Ink Soft — secondary text" }
        },
        "oxblood": {
          "800": { "$value": "#5E2B25", "$type": "color" },
          "700": { "$value": "#74362F", "$type": "color", "$description": "Oxblood — THE accent: active nav, seals, underlines, key figures" },
          "300": { "$value": "#C9978F", "$type": "color" },
          "100": { "$value": "#F2E3E0", "$type": "color" }
        },
        "brass": {
          "600": { "$value": "#6E572C", "$type": "color", "$description": "Brass text on paper (AA)" },
          "500": { "$value": "#947642", "$type": "color", "$description": "Brass — fig captions, rules, metadata" },
          "300": { "$value": "#C9A86A", "$type": "color" },
          "100": { "$value": "#F0E6CC", "$type": "color" }
        },
        "sage": {
          "700": { "$value": "#3E5546", "$type": "color" },
          "600": { "$value": "#4F6958", "$type": "color", "$description": "Sage — success / verified" },
          "300": { "$value": "#8FAF9B", "$type": "color" },
          "100": { "$value": "#E4EBE4", "$type": "color" }
        },
        "paper": {
          "50":  { "$value": "#FAF9F4", "$type": "color", "$description": "Paper Raised — cards/plates" },
          "100": { "$value": "#F5F2EB", "$type": "color", "$description": "Paper — ivory page ground" },
          "200": { "$value": "#EDE7DA", "$type": "color" },
          "300": { "$value": "#E4DECE", "$type": "color" }
        },
        "neutral": {
          "400": { "$value": "#D9D3C9", "$type": "color", "$description": "Hairline — borders, always 1px" },
          "500": { "$value": "#B9AE97", "$type": "color" },
          "600": { "$value": "#8A8272", "$type": "color" },
          "700": { "$value": "#5C5546", "$type": "color" }
        },
        "status": {
          "success": { "$value": "#4F6958", "$type": "color" },
          "successBg": { "$value": "#E4EBE4", "$type": "color" },
          "warning": { "$value": "#A36A29", "$type": "color" },
          "warningBg": { "$value": "#F6EBD8", "$type": "color" },
          "danger":  { "$value": "#962C2C", "$type": "color" },
          "dangerBg":  { "$value": "#F5E0DE", "$type": "color" },
          "info":    { "$value": "#6E572C", "$type": "color", "$description": "Informational states are brass — Museum Folio has no blue" },
          "infoBg":    { "$value": "#F0E6CC", "$type": "color" }
        }
      },
      "semantic": {
        "light": {
          "bg-canvas":    { "$value": "{auctum.color.primitive.paper.100}", "$type": "color" },
          "bg-surface":   { "$value": "{auctum.color.primitive.paper.50}", "$type": "color" },
          "bg-recessed":  { "$value": "{auctum.color.primitive.paper.200}", "$type": "color" },
          "bg-hover":     { "$value": "{auctum.color.primitive.paper.300}", "$type": "color" },
          "bg-inverse":   { "$value": "{auctum.color.primitive.ink.900}", "$type": "color" },
          "text-primary": { "$value": "{auctum.color.primitive.ink.900}", "$type": "color" },
          "text-muted":   { "$value": "{auctum.color.primitive.ink.700}", "$type": "color" },
          "text-subtle":  { "$value": "{auctum.color.primitive.neutral.600}", "$type": "color" },
          "text-inverse": { "$value": "{auctum.color.primitive.paper.50}", "$type": "color" },
          "text-link":    { "$value": "{auctum.color.primitive.oxblood.700}", "$type": "color" },
          "action-primary-bg":     { "$value": "{auctum.color.primitive.oxblood.700}", "$type": "color" },
          "action-primary-hover":  { "$value": "{auctum.color.primitive.oxblood.800}", "$type": "color" },
          "action-secondary-bg":   { "$value": "{auctum.color.primitive.ink.900}", "$type": "color" },
          "action-secondary-hover":{ "$value": "{auctum.color.primitive.ink.700}", "$type": "color" },
          "accent-oxblood":    { "$value": "{auctum.color.primitive.oxblood.700}", "$type": "color" },
          "accent-brass":      { "$value": "{auctum.color.primitive.brass.500}", "$type": "color" },
          "accent-brass-text": { "$value": "{auctum.color.primitive.brass.600}", "$type": "color" },
          "brand-sage":        { "$value": "{auctum.color.primitive.sage.600}", "$type": "color" },
          "border-decorative": { "$value": "{auctum.color.primitive.neutral.400}", "$type": "color" },
          "border-strong":     { "$value": "{auctum.color.primitive.neutral.500}", "$type": "color" },
          "border-interactive":{ "$value": "{auctum.color.primitive.neutral.600}", "$type": "color" },
          "border-focus":      { "$value": "{auctum.color.primitive.oxblood.700}", "$type": "color" },
          "status-success":    { "$value": "{auctum.color.primitive.status.success}", "$type": "color" },
          "status-success-bg": { "$value": "{auctum.color.primitive.status.successBg}", "$type": "color" },
          "status-warning":    { "$value": "{auctum.color.primitive.status.warning}", "$type": "color" },
          "status-warning-bg": { "$value": "{auctum.color.primitive.status.warningBg}", "$type": "color" },
          "status-danger":     { "$value": "{auctum.color.primitive.status.danger}", "$type": "color" },
          "status-danger-bg":  { "$value": "{auctum.color.primitive.status.dangerBg}", "$type": "color" },
          "status-info":       { "$value": "{auctum.color.primitive.status.info}", "$type": "color" },
          "status-info-bg":    { "$value": "{auctum.color.primitive.status.infoBg}", "$type": "color" }
        },
        "dark": {
          "bg-canvas":    { "$value": "#16120E", "$type": "color" },
          "bg-surface":   { "$value": "#211B14", "$type": "color" },
          "bg-recessed":  { "$value": "#2A2318", "$type": "color" },
          "bg-hover":     { "$value": "#362C1E", "$type": "color" },
          "bg-inverse":   { "$value": "{auctum.color.primitive.paper.100}", "$type": "color" },
          "text-primary": { "$value": "#F2EDE3", "$type": "color" },
          "text-muted":   { "$value": "#B3A996", "$type": "color" },
          "text-subtle":  { "$value": "#8A8272", "$type": "color" },
          "text-inverse": { "$value": "#16120E", "$type": "color" },
          "text-link":    { "$value": "{auctum.color.primitive.oxblood.300}", "$type": "color" },
          "action-primary-bg":     { "$value": "{auctum.color.primitive.oxblood.300}", "$type": "color" },
          "action-primary-hover":  { "$value": "#D8B0A8", "$type": "color" },
          "action-secondary-bg":   { "$value": "#3A3226", "$type": "color" },
          "action-secondary-hover":{ "$value": "#4A3F2E", "$type": "color" },
          "accent-oxblood":    { "$value": "{auctum.color.primitive.oxblood.300}", "$type": "color" },
          "accent-brass":      { "$value": "{auctum.color.primitive.brass.300}", "$type": "color" },
          "accent-brass-text": { "$value": "{auctum.color.primitive.brass.300}", "$type": "color" },
          "brand-sage":        { "$value": "{auctum.color.primitive.sage.300}", "$type": "color" },
          "border-decorative": { "$value": "#3A3226", "$type": "color" },
          "border-strong":     { "$value": "#4A3F2E", "$type": "color" },
          "border-interactive":{ "$value": "#7A6F5C", "$type": "color" },
          "border-focus":      { "$value": "{auctum.color.primitive.oxblood.300}", "$type": "color" },
          "status-success":    { "$value": "#8FAF9B", "$type": "color" },
          "status-success-bg": { "$value": "#1E2A20", "$type": "color" },
          "status-warning":    { "$value": "#D9A45C", "$type": "color" },
          "status-warning-bg": { "$value": "#332713", "$type": "color" },
          "status-danger":     { "$value": "#E08A80", "$type": "color" },
          "status-danger-bg":  { "$value": "#331A16", "$type": "color" },
          "status-info":       { "$value": "#C9A86A", "$type": "color" },
          "status-info-bg":    { "$value": "#2A2210", "$type": "color" }
        }
      }
    },
    "font": {
      "family": {
        "display": { "$value": ["Playfair Display", "Georgia", "serif"], "$type": "fontFamily" },
        "sans":    { "$value": ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"], "$type": "fontFamily" },
        "mono":    { "$value": ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"], "$type": "fontFamily" }
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
        "overline": { "$value": "0.18em",   "$type": "dimension" }
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
      "1": { "$value": "0 1px 2px 0 rgb(34 30 27 / 0.07)", "$type": "shadow" },
      "2": { "$value": "0 2px 4px -1px rgb(34 30 27 / 0.08), 0 4px 8px -2px rgb(34 30 27 / 0.06)", "$type": "shadow" },
      "3": { "$value": "0 4px 8px -2px rgb(34 30 27 / 0.09), 0 10px 20px -4px rgb(34 30 27 / 0.08)", "$type": "shadow" },
      "4": { "$value": "0 8px 16px -4px rgb(34 30 27 / 0.10), 0 20px 32px -8px rgb(34 30 27 / 0.10)", "$type": "shadow" },
      "5": { "$value": "0 16px 48px -8px rgb(34 30 27 / 0.18)", "$type": "shadow" }
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
        "seal":     { "$value": "cubic-bezier(0.34, 1.56, 0.64, 1)", "$type": "cubicBezier" }
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
      "stamp":    { "$value": "0.9",  "$type": "number" }
    }
  }
}
```

---

## 10. Tailwind CSS config extension

Consume semantic tokens as CSS variables so dark mode is a single attribute flip. Add to `tailwind.config.js`:

```js
// tailwind.config.js — Auctum Ledger extension
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // semantic (CSS-var backed; vars emitted from tokens.json)
        canvas:    'rgb(var(--auctum-bg-canvas) / <alpha-value>)',
        surface:   'rgb(var(--auctum-bg-surface) / <alpha-value>)',
        recessed:  'rgb(var(--auctum-bg-recessed) / <alpha-value>)',
        ink:       'rgb(var(--auctum-text-primary) / <alpha-value>)',
        muted:     'rgb(var(--auctum-text-muted) / <alpha-value>)',
        subtle:    'rgb(var(--auctum-text-subtle) / <alpha-value>)',
        // brand primitives (static) — Museum Folio
        oxblood: { DEFAULT: '#74362F', 800: '#5E2B25', 300: '#C9978F', 100: '#F2E3E0' },
        brass:   { DEFAULT: '#947642', 600: '#6E572C', 300: '#C9A86A', 100: '#F0E6CC' },
        sage:    { DEFAULT: '#4F6958', 700: '#3E5546', 300: '#8FAF9B', 100: '#E4EBE4' },
        ink:     { 900: '#221E1B', 700: '#58514B' },
        paper:   { DEFAULT: '#F5F2EB', 50: '#FAF9F4', 200: '#EDE7DA', 300: '#E4DECE' },
        neutral: { 400: '#D9D3C9', 500: '#B9AE97', 600: '#8A8272', 700: '#5C5546' },
        success: { DEFAULT: '#4F6958', bg: '#E4EBE4' },
        warning: { DEFAULT: '#A36A29', bg: '#F6EBD8' },
        danger:  { DEFAULT: '#962C2C', bg: '#F5E0DE' },
        info:    { DEFAULT: '#6E572C', bg: '#F0E6CC' },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
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
        'e1': '0 1px 2px 0 rgb(34 30 27 / 0.07)',
        'e2': '0 2px 4px -1px rgb(34 30 27 / 0.08), 0 4px 8px -2px rgb(34 30 27 / 0.06)',
        'e3': '0 4px 8px -2px rgb(34 30 27 / 0.09), 0 10px 20px -4px rgb(34 30 27 / 0.08)',
        'e4': '0 8px 16px -4px rgb(34 30 27 / 0.10), 0 20px 32px -8px rgb(34 30 27 / 0.10)',
        'e5': '0 16px 48px -8px rgb(34 30 27 / 0.18)',
      },
      transitionDuration: {
        instant: '100ms', fast: '150ms', base: '250ms', slow: '350ms', slower: '500ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        seal:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
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
  --auctum-bg-canvas: 245 242 235;   /* paper-100 */
  --auctum-bg-surface: 250 249 244;
  --auctum-bg-recessed: 237 231 218;
  --auctum-text-primary: 34 30 27;
  --auctum-text-muted: 88 81 75;
  --auctum-text-subtle: 138 130 114;
}
[data-theme="dark"] {
  --auctum-bg-canvas: 22 18 14;
  --auctum-bg-surface: 33 27 20;
  --auctum-bg-recessed: 42 35 24;
  --auctum-text-primary: 242 237 227;
  --auctum-text-muted: 179 169 150;
  --auctum-text-subtle: 138 130 114;
}
```

---

## 11. Token traceability ledger

| Token | Traces to |
|---|---|
| ink-900 `#221E1B` | Museum Folio `ink 24 12% 12%` (master brand), held at AAA on paper grounds |
| oxblood-700 `#74362F` | Museum Folio `oxblood 6 42% 32%` (master brand) — the single earned accent |
| brass-500 `#947642` | Museum Folio `brass 38 38% 42%` (master brand); brass-600 `#6E572C` derived for text AA |
| paper-100 `#F5F2EB` | Museum Folio `paper 42 33% 94%` (master brand ivory ground) |
| paper-50 `#FAF9F4` | Museum Folio `paper-raised 45 40% 97%` — archival plates |
| neutral-400 `#D9D3C9` | Museum Folio `hairline 38 18% 82%` — borders, always 1 px |
| sage-600 `#4F6958` | Museum Folio `success 140 14% 36%`; warning `#A36A29` = `32 60% 40%`; danger `#962C2C` = `0 55% 38%` |
| status.info → brass-600 | Museum Folio has no blue; informational states resolved to brass (see §2.2) |
| type scale 1.25 / Playfair Display / Inter / JetBrains Mono | Museum Folio typography (master brand); modular ratio retained from legacy §4.1 fluid clamps |
| radius 2–16, durations 100–500, easings | legacy §4.1 values, pruned (bounce → `ease.seal`, scoped to badge/seal/winner moments); radius re-anchored to 2–4 per Museum Folio |
| dark mode `#16120E–#362C1E` | new to this system — warm espresso-ink darks derived from the ink/paper hue family; no legacy equivalent |

**Governance:** any new token requires (a) a role name, (b) a computed contrast note, (c) an entry in this ledger. Ad-hoc hex in product code fails CI stylelint.
