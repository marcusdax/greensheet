# Auctum Ledger — Brand Identity System

**Version 2.0 · Auctum Master Brand Product Family · Status: Approved for implementation**

---

## 0. Provenance & Traceability

Every decision in this document traces to one of three sources:

| Source | What it contributes |
|---|---|
| **Auctum master brand** (the Auctum seal; Museum Folio palette: paper ivory, ink, oxblood accent, brass metadata; trade lockup *"Auctum. Verified, from origin."*) | Structural DNA: seal geometry, folio metadata lines, oxblood/brass discipline, the master-brand voice |
| **The historical "green sheet"** — the green-coffee offer sheets and market reports that importers pin to roastery walls | Name lineage, parchment-paper materiality, tabular/ledger aesthetics, the lot-sheet stamp motif |
| **The Auctum Ledger (formerly Greensheet) product codebase** (platform expansion architecture §IV) | Legacy palette anchors absorbed into Museum Folio (ink, paper, oxblood), domain vocabulary (cup score, lot, origin, process, ESG) |

The Auctum Ledger succeeds the platform formerly known as Greensheet; the Auctum master brand succeeds the ODASI product family. Legacy marks are retired, not referenced, in shipped UI.

---

## 1. Brand Platform

### 1.1 What the Auctum Ledger is

The Auctum Ledger is the verified B2B distribution platform of the Auctum ecosystem — the market-intelligence and CRM layer for the specialty green-coffee trade. Importers and exporters publish lots; roasters discover, compare, score, and source them. It replaces the photocopied offer sheet, the WhatsApp thread, and the spreadsheet with one verified source of truth.

### 1.2 Positioning statement

> **For specialty-coffee importers, exporters, and roasters** who drown in scattered offer sheets and stale spreadsheets, **the Auctum Ledger** is the verified sourcing platform that turns every coffee lot into a comparable, scoreable, traceable record — because it is built by Auctum on the belief that value is co-created, not extracted.

### 1.3 Brand essence

**"The offer sheet, elevated to an instrument."**

The green sheet was always an instrument of record — it told a roaster *where the good coffee is, and at what terms*. The Auctum Ledger makes that literal: it carries the Auctum seal, and the seal is only rendered from verified values.

### 1.4 Brand archetypes

| Archetype | Weight | Expression |
|---|---|---|
| **Curator** (Sage × Ruler, inherited from the Auctum master brand) | 50% | The Auctum seal, folio metadata lines, plate/figure captions, benchmarking dashboards |
| **Craftsman** (Creator) | 35% | Cup-score precision, Q-grader vocabulary, roast-tone materiality, respect for origin craft |
| **Trusted Ledger** (Ruler, light) | 15% | Tabular rigor, audit trails, LTV/churn unit economics, "source of truth" reliability |

**Explicitly not:** Magician (no AI mysticism), Jester (no quirky coffee puns in UI chrome), Hero (no conquest language — we serve both sides of the trade).

### 1.5 Personality sliders

| Axis | Position | Consequence |
|---|---|---|
| Warm ↔ Clinical | 65% warm | Paper grounds, serif display face, round price figures never truncated |
| Heritage ↔ Futurist | 60% heritage | Ledger hairlines and plate captions, but fluid type scale and motion |
| Authoritative ↔ Conversational | 55% authoritative | States findings ("This lot is over budget") not questions |
| Dense ↔ Spacious | 45% dense (data-rich but aired) | 4dp rhythm, generous card padding, Tufte data-ink discipline |
| Playful ↔ Serious | 80% serious | Humor allowed only in empty states, never in money or quality data |

### 1.6 Voice (UI copy principles)

1. **Trade vocabulary, used correctly:** "lot," "cup score," "process," "offer," "position" — never "product," "rating," "method."
2. **Numbers first:** lead with the figure, qualify after — "86.5 cup · $5.20/lb · 1,320 lbs." Every claim carries a number.
3. **No dark patterns, no hype:** no countdown timers, no "Hurry!" — scarcity is stated as inventory fact ("18 bags remain").
4. **Ledger register, not military register:** "verify," "record," "settle" are permitted; "operation," "campaign assault," and conquest metaphors are retired. Banned words in UI copy: "elevated," "curated," "journey," "ritual," "premium" (as self-description).

---

## 2. Logo Concept System

The system has **one primary mark (the Auctum seal), one monogram, one endorsement lockup, and one functional glyph set.** All marks are constructed on the same 24-unit grid and share the Museum Folio stroke DNA: 1px hairlines, round caps, no gradients.

### 2.1 Primary mark — "The Auctum seal"

**Concept:** A circular wordmark seal — the archival stamp of a verified record. The outer ring carries the legend **"AUCTUM · VERIFIED, FROM ORIGIN · MMXXVI"**; the center holds the lot numeral or the bean cross-section. The seal says: *this value was verified at origin.* The seal is **earned, never decorative** — it renders only from verified database values and never appears on unverified data.

#### 2.1.1 Construction spec (for designer or AI image generator)

```
Canvas:            240 × 240 units, mark centered at (120,120)
Grid:              24-unit base grid; all points land on grid or half-grid
Outer ring:        Circle, radius 96 units, stroke 2 units, Ink (#221E1B).
Inner ring:        Circle, radius 76 units, stroke 1 unit, Ink (#221E1B).
Legend ring:       Text on the circular path between the rings:
                     "AUCTUM · VERIFIED, FROM ORIGIN · MMXXVI"
                     set in Inter 600 small caps, 11 units cap height,
                     letter-spacing 0.30em, following the circle clockwise
                     from 12 o'clock; middle dots at 4 and 8 o'clock.
Center:            Concentric at (120,120):
                     coffee-bean cross-section: ellipse 28 × 18 units,
                     rotated 30°, with a 2.5-unit center-cut groove,
                     stroked in Oxblood (#74362F); OR a verified numeral
                     (e.g., cup score "86.5") in Playfair Display 72,
                     ink, for score seals.
Accent:            A single 1-unit oxblood underline ticks the baseline
                   of the wordmark when the seal locks up with type.
Line style:        Round caps and joins throughout. No fills. No gradients.
```

**AI-generator prompt (verbatim, for raster drafts):**
> "Minimal archival seal: two thin concentric circular rings in near-black ink #221E1B on warm ivory paper #F5F2EB, the circular legend 'AUCTUM · VERIFIED, FROM ORIGIN · MMXXVI' set in small-cap letterforms between the rings. At the center, a single-line coffee-bean cross-section in deep oxblood #74362F. Flat vector style, hairline strokes, generous negative space, no gradients, no shadows, museum-folio editorial trademark, coffee trade heritage."

#### 2.1.2 Clearspace & minimum sizes

- **Clearspace:** radius of the inner ring (76 units ≈ 1/3 of mark width) on all sides.
- **Minimum sizes:** print 12 mm · screen 32 px. Below 32 px use the AL monogram (§2.2).
- The seal is always reproduced in a single ink over paper/paper-raised, or reversed in paper over ink. Never on photography busier than 20% detail variance. **Never on unverified data.**

### 2.2 Secondary mark — "AL Monogram" (favicon / app icon / avatar)

- A square plate: 3 px radius corners, ink field, 1 px hairline border in hairline `#D9D3C9`.
- Inside: the letterforms **A L** in Playfair Display 72pt optical, set in paper, tracked +4%, stacked at 62% of the field height, divided by a 1 px brass rule.
- At 16 px the letters drop out and only the brass rule on ink remains (favicon variant). Export set: 16/32/48/180/512 px.

### 2.3 Secondary mark — "Verification Seal" (score seals for emails, certificates, sample-kit cards)

- The Auctum seal at 55% scale with a verified numeral (e.g., cup score "86.5") in the center, or the AUCTUM VERIFIED ORIGIN lockup for origin-verified lots.
- Rendered in ink `#221E1B` at 90% opacity with a subtle 0.5% noise texture to read as ink on paper. **Never** used as the primary identifier; **never** rendered for a value the Auctum Ledger has not verified — seals render only from database values.

### 2.4 Wordmark & lockups

**Wordmark:** "Auctum Ledger" set in **Playfair Display** (Georgia fallback), weight 560, tracked −1%. Two words, capital A and L. Never letterspaced; all-caps "AUCTUM LEDGER" is reserved for the seal ring, folio metadata lines, and legal lines.

| Lockup | Arrangement | Use |
|---|---|---|
| **Primary horizontal** | Auctum seal left, wordmark right, baseline-aligned; gap = 1 inner-ring radius | Marketing site header, email header, deck covers |
| **Stacked** | Seal above wordmark, centered | App splash, social avatars (square) |
| **Wordmark only** | Playfair wordmark, no mark | In-product top bar (space-constrained) |
| **Master-brand lockup** | Wordmark + "by Auctum" in Inter 500 small caps, letter-spacing 0.18em, set in ink-soft | Public marketing, first-run onboarding (see §5) |
| **Folio metadata line** | `FOLIO 03 — THE LEDGER` small-caps brass above the lockup | Document covers, section headers, empty states |

### 2.5 Symbolism rationale (semiotic ledger)

| Element | Signified | Inherited from |
|---|---|---|
| Circular seal rings | A closed record — the lot is verified, the ledger is complete | Auctum seal (master brand) |
| Legend "VERIFIED, FROM ORIGIN" | Verification at origin; the trade lockup made architectural | Auctum master brand |
| MMXXVI | The founding year; archival dating | Museum Folio system |
| Bean cross-section | The lot at the heart of every decision; value | Auctum Ledger |
| Oxblood single accent | The accent is earned — seals, key figures, active states | Museum Folio palette |
| Ivory paper field | The physical green sheet pinned in the roastery | Trade heritage |

---

## 3. Color expression (identity level — engineering values in `02-design-tokens.md`)

Museum Folio palette — restraint, archival, editorial:

- **Ink `#221E1B`** (`24 12% 12%`) — primary identity ink. 55% of brand color area.
- **Ink Soft `#58514B`** (`26 8% 32%`) — secondary text. 10%.
- **Oxblood `#74362F`** (`6 42% 32%`) — THE accent. 8%. Active nav, seals, underlines, key figures; also destructive-adjacent emphasis. *Oxblood is earned, never decorative wallpaper.*
- **Brass `#947642`** (`38 38% 42%`) — secondary accent. 5%. Fig captions, rules, metadata.
- **Paper `#F5F2EB`** (`42 33% 94%`) — the ground everything sits on.
- **Paper Raised `#FAF9F4`** (`45 40% 97%`) — cards and archival plates.
- **Hairline `#D9D3C9`** (`38 18% 82%`) — borders, always 1 px.
- Functional: **Sage `#4F6958`** (success), **Warning `#A36A29`**, **Destructive `#962C2C`**.

**Forbidden:** blue→purple gradients, neon cyan, saturated fills, pure black `#000000`, pure white page backgrounds (use paper-raised `#FAF9F4`), Material-Design default palette, drop-shadowed or beveled seal renditions.

---

## 4. Usage rules — Do / Don't

### Do
- Reproduce the seal in ink on paper, or reverse paper on ink.
- Pair the seal with generous paper negative space — the brand breathes like a well-set folio page.
- Use the Verification Seal at 90% opacity as a *supporting* mark in email headers and kit cards — always bound to a database value.
- Use Oxblood only for: active nav, seals, underlines, and key figures.
- Keep the legend ring intact and legible: "AUCTUM · VERIFIED, FROM ORIGIN · MMXXVI".

### Don't
- Don't recolor the seal outside the approved ink pairs (ink/paper, paper/ink, brass-rule exception as specced).
- Don't rotate, skew, outline, or add effects (shadows, glows, gradients) to the seal.
- Don't place the seal on photography darker than 60% brightness without a paper chip behind it.
- Don't set the wordmark in any face other than Playfair Display; don't letterspace it.
- Don't let the seal ever appear to *certify* a score the Auctum Ledger didn't verify — score seals render only from database values.
- Don't use gradients or saturated fills anywhere in the identity system.

---

## 5. Co-branding with Auctum (master brand)

The Auctum Ledger is an endorsed product brand: **product-led, master-brand-endorsed.**

### 5.1 Hierarchy rules

1. The Auctum Ledger wordmark always leads; Auctum endorses at 40–60% of the Auctum Ledger mark's optical size.
2. The endorsement line is text, not the full seal: **"Auctum Ledger by Auctum"** — Auctum set in Playfair Display or, when unavailable, Inter 600 small caps tracked +18%.
3. The full Auctum seal appears alongside the Auctum Ledger wordmark only in: corporate decks, legal footers, app-store developer pages, and the email footer endorsement block. In those cases, divider = 1 px hairline in border color, or a 24 px vertical gap.

### 5.2 Shared & separated territory

| Shared (harmony) | Separated (distinction) |
|---|---|
| Paper/ink/oxblood/brass palette; hairline geometry; folio metadata lines | Auctum Ledger owns plate captions, ledger tables, the lot-sheet stamp motif, and trade vocabulary |
| "Verified, from origin" language | Auctum speaks to *value co-creation*; the Auctum Ledger speaks to *lots, quality, supply* |
| Motion easings, focus-ring spec | Auctum Ledger UI never borrows sibling-product marks (Atelier, Flavor Foundry, LotSpace) |

### 5.3 Lockup clearances

- Minimum separation between the Auctum Ledger wordmark and the Auctum master-brand mark: 2× the inner-ring radius (152 units).
- Never enclose both marks in one container shape; never recolor one to match the other.
- Dark-mode endorsement: "by Auctum" renders in muted-dark ink, never oxblood (oxblood-on-oxblood confusion with active states).

### 5.4 Sign-off examples (copy)

- Product: `Auctum Ledger · by Auctum`
- Legal: `The Auctum Ledger is a product of Auctum.`
- Email footer: `Auctum. Value is co-created, not extracted.` (optional line, campaigns only)

---

## 6. Asset deliverables checklist (for the design engineer)

| Asset | Formats | Notes |
|---|---|---|
| Auctum seal (primary) | SVG (1-ink, reverse, mono) + PNG @1–4× | SVG paths must be expanded, no strokes; legend ring as outlined text |
| AL Monogram | SVG + ICO/PNG 16–512 | rule-only 16 px variant |
| Verification Seal | SVG with parametric center numeral | noise texture as separate overlay layer |
| Wordmark | SVG, horizontal + stacked + "by Auctum" | Playfair Display converted to outlines |
| Email header lockup | PNG @2× 1200×240 + SVG fallback | see `04-email-campaign-visual-system.md` |
| Favicon set | ICO, PNG 32/180, SVG (prefers-color-scheme aware) | dark-mode favicon inverts field |
