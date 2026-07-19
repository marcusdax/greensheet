# Greensheet — Brand Identity System

**Version 1.0 · ODASI Technologies Product Family · Status: Approved for implementation**

---

## 0. Provenance & Traceability

Every decision in this document traces to one of three sources:

| Source | What it contributes |
|---|---|
| **ODASI Technologies parent mark** (compass rose; deep navy `#142435`, constellation teal `#3D7681`, brass gold `#968853`; tagline *"Navigate your reality. Own your journey."*) | Structural DNA: compass geometry, constellation network, gold core, navy/teal/gold lineage |
| **The historical "green sheet"** — the green-coffee offer sheets and market reports that importers pin to roastery walls | Name, parchment-paper materiality, tabular/ledger aesthetics, the lot-sheet stamp motif |
| **Greensheet product codebase** (platform expansion architecture §IV) | Legacy palette anchors (ink `#26201a`, paper `#fbfaf6`, green `#2f6b4a`), domain vocabulary (cup score, lot, origin, process, ESG) |

---

## 1. Brand Platform

### 1.1 What Greensheet is

Greensheet is the market-intelligence and CRM platform for the specialty green-coffee trade. Importers and exporters publish lots; roasters discover, compare, score, and source them. It replaces the photocopied offer sheet, the WhatsApp thread, and the spreadsheet with one navigable source of truth.

### 1.2 Positioning statement

> **For specialty-coffee importers, exporters, and roasters** who drown in scattered offer sheets and stale spreadsheets, **Greensheet** is the sourcing intelligence platform that turns every coffee lot into a comparable, scoreable, navigable data point — because it is built by ODASI on the belief that great trade relationships, like great journeys, are navigated, not gambled.

### 1.3 Brand essence

**"The offer sheet, elevated to an instrument."**

The green sheet was always a navigation tool — it told a roaster *where the good coffee is*. Greensheet makes that literal: it inherits the ODASI compass and points it at coffee.

### 1.4 Brand archetypes

| Archetype | Weight | Expression |
|---|---|---|
| **Navigator** (Explorer × Sage, inherited from ODASI) | 50% | Compass mark, constellation flavor maps, "chart your sourcing" language, benchmarking dashboards |
| **Craftsman** (Creator) | 35% | Cup-score precision, Q-grader vocabulary, roast-tone materiality, respect for origin craft |
| **Trusted Ledger** (Ruler, light) | 15% | Tabular rigor, audit trails, LTV/churn unit economics, "source of truth" reliability |

**Explicitly not:** Magician (no AI mysticism), Jester (no quirky coffee puns in UI chrome), Hero (no conquest language — we serve both sides of the trade).

### 1.5 Personality sliders

| Axis | Position | Consequence |
|---|---|---|
| Warm ↔ Clinical | 65% warm | Parchment grounds, serif display face, round price figures never truncated |
| Heritage ↔ Futurist | 60% heritage | Ledger lines and lot stamps, but fluid type scale and motion |
| Authoritative ↔ Conversational | 55% authoritative | States findings ("This lot is over budget") not questions |
| Dense ↔ Spacious | 45% dense (data-rich but aired) | 4dp rhythm, generous card padding, Tufte data-ink discipline |
| Playful ↔ Serious | 80% serious | Humor allowed only in empty states, never in money or quality data |

### 1.6 Voice (UI copy principles)

1. **Trade vocabulary, used correctly:** "lot," "cup score," "process," "offer," "position" — never "product," "rating," "method."
2. **Numbers first:** lead with the figure, qualify after — "86.5 cup · $5.20/lb · 1,320 lbs."
3. **No dark patterns, no hype:** no countdown timers, no "Hurry!" — scarcity is stated as inventory fact ("18 bags remain").
4. **Compass metaphors are structural, not decorative:** "Navigate," "benchmark," "bearing" are permitted; avoid mixing in nautical clichés ("anchors aweigh").

---

## 2. Logo Concept System

The system has **one primary mark, two secondary marks, one endorsement lockup, and one functional glyph set.** All marks are constructed on the same 24-unit grid and share the ODASI stroke DNA.

### 2.1 Primary mark — "The Lot Compass"

**Concept:** The ODASI compass rose, re-drawn as a coffee instrument. The north needle is a **coffee leaf**; the east point is a **cherry stem**; the constellation network maps **flavor-note points**; the gold core is the **cross-section of a coffee bean** (the flat-sided groove, or "center cut," rendered as a gold ellipse). The mark says: *the compass that finds coffee.*

#### 2.1.1 Construction spec (for designer or AI image generator)

```
Canvas:            240 × 240 units, mark centered at (120,120)
Grid:              24-unit base grid; all points land on grid or half-grid
Outer ring:        Circle, radius 96 units, stroke 4 units, Compass Navy (#16323E).
                   Ring is broken at N/E/S/W by the four star points (gap 8 units).
Star points:       4-point compass star.
                     N point: elongated 88 units from center, 14 units wide at base,
                              drawn as a coffee LEAF — slight S-curve spine, serrated
                              edge suggested by 3 notches per side, solid navy.
                     E/W points: 56 units, straight, solid navy, classic compass taper.
                     S point: 44 units, straight, solid navy.
                   Between the cardinal points, 4 short intercardinal ticks (24 units,
                   stroke 3) at 45°/135°/225°/315°.
Constellation field: In the NE quadrant only (echoing the ODASI right-half network):
                     7 nodes (r = 3 units) joined by 1.5-unit hairlines, drawn in
                     Constellation Teal (#2A6E73). Nodes sit on a spiral arc from
                     center outward — reads as a rising flavor/aroma plume.
Core:              Concentric at (120,120):
                     ring r=20, stroke 3, navy;
                     coffee-bean cross-section: ellipse 24 × 16 units, rotated 30°,
                     with a 2.5-unit center-cut groove, filled Core Gold (#C9A34A).
Line style:        Round caps and joins throughout. No fills except leaf, bean, nodes.
```

**AI-generator prompt (verbatim, for raster drafts):**
> "Minimal geometric logo mark: a four-point compass rose inside a thin circular ring, deep navy #16323E lines on warm parchment #F6F1E7. The north needle is subtly shaped like a coffee leaf. In the upper-right quadrant, a small constellation of seven muted teal #2A6E73 dots connected by hairlines. At the center, a gold #C9A34A coffee-bean cross-section with its center groove. Flat vector style, round line caps, generous negative space, no gradients, no text, Swiss modernist trademark, coffee trade heritage."

#### 2.1.2 Clearspace & minimum sizes

- **Clearspace:** height of the gold core (40 units = 1/6 of mark width) on all sides.
- **Minimum sizes:** print 12 mm · screen 32 px. Below 32 px use the GS monogram (§2.2).
- The mark is always reproduced in a single ink over parchment/white, or reversed in parchment over navy/roast. Never on photography busier than 20% detail variance.

### 2.2 Secondary mark — "GS Monogram" (favicon / app icon / avatar)

- A square lot-stamp: radius 16% corners, Compass Navy field.
- Inside: the gold coffee-bean ellipse (as §2.1.1 core) with the letterforms **G S** in Fraunces 72pt optical, cut as negative space to either side of the bean groove; G above, S below, stacked at 62% of the field height.
- At 16 px the letters drop out and only the gold bean-on-navy remains (favicon variant). Export set: 16/32/48/180/512 px.

### 2.3 Secondary mark — "Lot Stamp" (decorative seal for emails, certificates, sample-kit cards)

- Circular rubber-stamp: double ring (outer 3 units, inner 1.5 units), text on ring "GREENSHEET · SPECIALTY GREEN COFFEE ·" set in Archivo 600, 8.5% letterspacing, following the circle.
- Center: the Lot Compass at 55% scale, or a cup score numeral in Fraunces (e.g., "86.5") for score seals.
- Rendered in Roast Brown `#4A3527` at 85% opacity with a subtle 0.5% noise texture to read as ink on paper. Rotated −4° to −8° when used decoratively. **Never** used as the primary identifier.

### 2.4 Wordmark & lockups

**Wordmark:** "Greensheet" set in **Fraunces** (Soft 0, Wonk 0, opsz 72), weight 560, tracked −1.5%. One word, capital G, lowercase remainder. Never letterspaced, never all-caps (all-caps "GREENSHEET" is reserved for the stamp ring and legal lines).

| Lockup | Arrangement | Use |
|---|---|---|
| **Primary horizontal** | Lot Compass left, wordmark right, baseline-aligned; gap = 1 core-width | Marketing site header, email header, deck covers |
| **Stacked** | Compass above wordmark, centered | App splash, social avatars (square) |
| **Wordmark only** | Fraunces wordmark, no mark | In-product top bar (space-constrained) |
| **Descriptor lockup** | Wordmark + "by ODASI" in Archivo 500, 60% of x-height, tracked +12%, set in muted ink | Public marketing, first-run onboarding (see §5) |

### 2.5 Symbolism rationale (semiotic ledger)

| Element | Signified | Inherited from |
|---|---|---|
| Compass rose | Navigation of the green-coffee market; the roaster's "bearing" | ODASI compass (parent) |
| North needle as coffee leaf | True north = the plant; quality at origin | Greensheet |
| NE constellation (7 nodes) | Flavor notes as a map; the 7 SCA cupping attributes (fragrance, flavor, aftertaste, acidity, body, balance, sweetness) | ODASI network (parent) |
| Gold bean core | The lot at the heart of every decision; value | ODASI gold core (parent) |
| Broken ring | An open market — the sheet is a starting point, not a fence | Greensheet |
| Parchment field | The physical green sheet pinned in the roastery | Trade heritage |

---

## 3. Color expression (identity level — engineering values in `02-design-tokens.md`)

- **Compass Navy `#16323E`** — primary identity ink. 55% of brand color area.
- **Constellation Teal `#2A6E73`** — secondary. 25%. Interactive, networks, links.
- **Core Gold `#C9A34A`** — reserved accent. 8%. The bean, the best-in-class signal, winner badges. *Gold is earned, never decorative wallpaper.*
- **Coffee Cherry `#8C3B34`** — origin/terroir accent; also destructive actions. 5%.
- **Roast Brown `#4A3527`** — depth, stamps, footer bands. 4%.
- **Greensheet Green `#3E6B50`** — the namesake; ESG, certifications, success. 3%.
- **Parchment `#F6F1E7`** — the ground everything sits on.

**Forbidden:** blue→purple gradients, neon cyan, pure black `#000000`, pure white page backgrounds (use `#FDFBF5`), Material-Design default palette, drop-shadowed or beveled logo renditions.

---

## 4. Usage rules — Do / Don't

### Do
- Reproduce the mark in navy on parchment, or reverse parchment on navy/roast.
- Pair the mark with generous parchment negative space — the brand breathes like a well-set ledger page.
- Use the Lot Stamp at 85% opacity, slightly rotated, as a *supporting* texture in email headers and kit cards.
- Use Core Gold only for: the bean core, cup-score "Outstanding" tier (90+), A/B winner badges, and the underline of the wordmark in celebratory contexts.
- Keep the 7-node constellation intact and in the NE quadrant.

### Don't
- Don't recolor the mark outside the approved ink pairs (navy/parchment, parchment/navy, roast/parchment, gold-bean exception as specced).
- Don't rotate, skew, outline, or add effects (shadows, glows, gradients) to the mark.
- Don't place the mark on coffee photography darker than 60% brightness without a parchment chip behind it.
- Don't use cherry red and gold adjacent at small sizes (<24 px) — vibration.
- Don't set the wordmark in any face other than Fraunces; don't letterspace it.
- Don't let the Lot Stamp ever appear to *certify* a score Greensheet didn't verify — score seals render only from database values.

---

## 5. Co-branding with ODASI (parent brand)

Greensheet is an endorsed product brand: **product-led, parent-endorsed.**

### 5.1 Hierarchy rules

1. Greensheet mark/wordmark always leads; ODASI endorses at 40–60% of the Greensheet mark's optical size.
2. The endorsement line is text, not the ODASI compass: **"Greensheet by ODASI"** — ODASI set in the ODASI serif (Trajan-style) or, when unavailable, Archivo 600 small caps tracked +18%.
3. The full ODASI compass mark appears alongside Greensheet only in: corporate decks, legal footers, app-store developer pages, and the email footer endorsement block. In those cases, divider = 1 px hairline in border color, or a 24 px vertical gap.

### 5.2 Shared & separated territory

| Shared (harmony) | Separated (distinction) |
|---|---|
| Navy, teal, gold triad; round-cap geometry; constellation motif | Greensheet owns parchment grounds, roast/cherry accents, Fraunces serif voice, stamp motif |
| "Navigate" language | ODASI navigates *reality/journey*; Greensheet navigates *lots, quality, supply* |
| Motion easings, focus-ring spec | Greensheet UI never uses ODASI's bright cyan node color `#4DD0D8` — Greensheet teal is muted |

### 5.3 Lockup clearances

- Minimum separation between Greensheet mark and ODASI mark: 2× the Greensheet core-width (80 units).
- Never enclose both marks in one container shape; never recolor one to match the other.
- Dark-mode endorsement: "by ODASI" renders in muted-dark ink `#A9A08C`, never gold (gold-on-gold confusion with the bean core).

### 5.4 Sign-off examples (copy)

- Product: `Greensheet · by ODASI`
- Legal: `Greensheet is a product of ODASI Technologies, Inc.`
- Email footer: `Navigate your reality. Own your journey. — ODASI Technologies` (optional line, campaigns only)

---

## 6. Asset deliverables checklist (for the design engineer)

| Asset | Formats | Notes |
|---|---|---|
| Lot Compass (primary) | SVG (1-ink, reverse, mono) + PNG @1–4× | SVG paths must be expanded, no strokes |
| GS Monogram | SVG + ICO/PNG 16–512 | bean-only 16 px variant |
| Lot Stamp | SVG with parametric center text | noise texture as separate overlay layer |
| Wordmark | SVG, horizontal + stacked + "by ODASI" | Fraunces converted to outlines |
| Email header lockup | PNG @2× 1200×240 + SVG fallback | see `04-email-campaign-visual-system.md` |
| Favicon set | ICO, PNG 32/180, SVG (prefers-color-scheme aware) | dark-mode favicon inverts field |
