# 06 — Video Production Bible

> The craft companion to `05-video-content-ecosystem.md` (which owns what/where/how-measured). This file owns *how it looks, moves, sounds, and speaks*. Visual system is derived from the Greensheet design tokens (base doc §4.1) — the design-system workstream's token spec is canonical; this bible translates it to motion. Parent-brand mark: the ODASI compass (half-line, half-network) appears only in corporate/end-card contexts — Greensheet content carries its own identity.

---

## 1. North-star look (one paragraph)

Documentary honesty + data elegance. Real places, real hands, real steam — shot with patience — then a crisp, quiet data layer laid over it like a scoresheet on a clipboard. Nothing that looks like a SaaS ad: no stock smiles, no gradient blobs, no whooshes for their own sake. If a frame could run as a still in a coffee annual, it belongs; if it could run in a generic B2B explainer, it's cut.

## 2. Style frames (described for boards/AI-frame generation)

**SF-01 "The Scoresheet" (signature frame — opens every anchor):** Extreme macro, 100mm, raking soft light from frame-left. Off-white Q-grader scoresheet fills 80% of frame; a carpenter-pencil tip enters and circles "86.5". Paper grain visible; shallow DOF melts a stainless cupping spoon in the background. Palette: paper `#FBFAF6`, ink `#26201A`, single green accent `#2F6B4A` on the circled score. Mood: evidence, not advertising.

**SF-02 "Ridge at Dawn" (origin):** Wide drone, Gedeb-style highlands, 06:10 light — blue-green ridgelines stacked in haze, one farmer with a cherry basket walking a contour line. Desaturated greens, amber rim light `#A8721F` on the figure. A hairline data overlay draws the contour and labels "2,100 masl" in Fraunces italic — the graphic must feel *surveyed*, not decorated.

**SF-03 "The Break" (cupping):** Overhead locked shot, five white bowls in a row on a dark walnut table. A spoon breaks the crust in the center bowl; grounds sink in slow motion (120 fps conformed to 24). Steam curls. Caption plate fades in lower-third: "the break — 4:00". Symmetry, silence, ritual.

**SF-04 "Warehouse Honesty" (logistics):** Handheld but steady 35mm, jute bags stacked three high, GrainPro liners, a worker chalking lot numbers. Dust motes in a skylight shaft. Counter GFX bottom-right ticks "40 → 39" in IBM Plex Mono. Grade: neutral-warm, contrast +5, no teal-orange cliché.

**SF-05 "Day Nine" (customer story):** Roastery morning, hero roaster at the drum, face lit by trier-port glow, checking color against a sample. Through-frame depth: green bags foreground, roaster mid, café lights bokeh back. Feels earned, calm, competent — the emotional payoff frame of Ep3.

**SF-06 "End Card" (system frame):** Paper background, subtle coffee-ring watermark at 6% opacity, Greensheet wordmark in Fraunces, one line of CTA copy, one QR (quiet zone respected, 300×300 min), green check-seal. 5-second hold with sonic logo (§4). Nothing else. Discipline is the brand.

## 3. Motion & typography lockups

### 3.1 Type system (from design tokens — do not deviate)

| Role | Face | Usage | Motion rule |
|---|---|---|---|
| Display / numbers | **Fraunces** 72–144 pt (optical "Display", SOFT 30, WONK 0) | Cup scores, prices, episode titles | Numbers count-up over 600 ms with `--ease-out`; never spin, never bounce |
| Body / captions | **Archivo** SemiBold (burned captions per file 05 §5) | VO captions, lower-thirds | Fade+rise 8 px over 150 ms (`--duration-fast`) |
| Data / mono | **IBM Plex Mono** 400/500 | Counters, timestamps, lot codes, day stamps | Typewriter at 12 cps for day-stamps; counters tick with a 30 ms blur |
| Stamps | Archivo 700, letter-spaced +120, rotated −4° | "UNVERIFIED" / "VERIFIED ✓" motifs | Slams in 3 frames with a paper-grain texture overlay; ink red `#A63F33` (problem) / green `#2F6B4A` (verified) |

**Lockup rules:** max 2 type families per frame; data plates sit on 55%-opacity ink scrims or paper chips (never floating text over busy b-roll); safe margins 5% all sides (10% bottom on 9:16); every on-screen number must match the VO number verbatim (caption-verbatim rule, file 05 §5).

### 3.2 Motion language

- **Pacing:** shot change or GFX event every ≤ 6 s in anchors, ≤ 3 s in 9:16 cutdowns — but motion is *reveal*, not *shake*. Camera moves are slow push-ins (2–4% scale) and laterals; no whip-pans, no zoom-transitions.
- **Transitions:** hard cuts on dialogue beats; 200 ms cross-dissolve only when time passes; "page turn" wipe (paper texture) reserved for day-stamp changes in Ep3.
- **Data layer:** line graphs draw left-to-right over 800 ms (`--ease-in-out`); lot-card UI appears as a paper chip sliding up 24 px + fade (250 ms), casting `--shadow-elevation-2`.
- **Check-seal animation:** the green verified seal draws its circle (400 ms) then the check (200 ms) — this is the motion equivalent of the brand promise; it never plays over anything untrue.

## 4. Sonic branding

**Leitmotif — "First Crack":** a three-note cell, ascending minor third + perfect fourth (A–C–F), always performed on felt piano + a subtle prepared-piano strike layered with a *real first-crack recording* (the pop of roasting coffee) pitched to the final note. 1.4 seconds. The metaphor is deliberate and on-brand: first crack is the moment green coffee becomes coffee — verification is the moment a claim becomes a fact.

- **Usage:** end cards (full 1.4 s logo), episode cold-opens (single struck note under the hook frame), UI ping in product-capture shots (first note only). Never under dialogue.
- **Score direction:** sparse, acoustic, room-tone-forward. Instrumentation: felt piano, nylon guitar, hand percussion (caxixi/shaker evoking parchment in beds), low strings for stakes beats. No corporate marimba, no EDM risers. Tempo 72–84 bpm (calm confidence); silence is a scored element — the slurp in SF-03 plays naked, no music.
- **Sound design signature:** tactile foley of the trade — burlap drag, cupping spoon on porcelain, the suction pop of a vac-seal sample bag, warehouse radio chatter at −24 dB. The audience should *feel the materials*.
- **Mix:** VO −6 dBFS peak, music bed −18 dB under VO, duck 4 dB on caption flashes; deliver −14 LUFS-I (YouTube/social) and −16 LUFS-I (podcast-feed repurposing) masters.
- **Voice casting:** presenter = working green buyer, not VO talent — mid-register, unhurried, allowed to say "look" and "honestly." Regional warmth welcome; no "announcer" read. Pickup sessions batch-recorded against the shoot's field audio for room continuity.

## 5. B-roll shot list (quarterly bank — shoot once, cut all quarter)

### 5.1 Origin (if budget confines to one origin trip, prioritize: washing station > farm > dry mill)

| # | Shot | Spec | Used in |
|---|---|---|---|
| O1 | Drone: ridgelines at dawn, stacked contours | 4K 24p, 3 moves (push, lateral, rise) | Ep2, SF-02 |
| O2 | Cherry picking close-up: hands selecting ripe only | 85mm, f/2, natural light | Ep2, spine |
| O3 | Depulper running, mucilage slick on parchment | 100mm macro + 120fps pass | Ep2 process beat |
| O4 | Fermentation tanks, worker testing by hand | 35mm handheld | Ep2 |
| O5 | Raised beds: raking patterns, overhead | Drone top-down, 120fps conf. | Ep2, SF alt |
| O6 | Moisture meter readout on parchment | Macro, screen legible | data-credibility inserts |
| O7 | Farmer portrait, looking off-camera left, golden hour | 50mm, 10 s hold | Ep2 reflection, thumbnails |
| O8 | Jute bag stenciling (lot code, origin) | 35mm, shallow | Ep2/Ep3, stamp motif source |
| O9 | Container loading at port, manifest close-up | Handheld doc | Ep2 logistics beat |

### 5.2 Warehouse / logistics

| # | Shot | Spec | Used in |
|---|---|---|---|
| W1 | Jute stacks three-high, skylight dust shaft | 35mm, SF-04 frame | Ep2/3, Warehouse Honesty |
| W2 | GrainPro liner being vac-sealed (suction pop — get clean foley) | Macro + separate audio pass | sonic signature, Ep3 |
| W3 | Chalking lot numbers on bags | 85mm | W-honesty verticals |
| W4 | Forklift pass with bag, lateral tracking | 35mm, 24p | Ep2 |
| W5 | Scale readout: 152 lbs, tare/settle | Macro, IBM Plex overlay later | counter motifs |
| W6 | Sample bagging station: 200 g portions, scoop, seal, label | Top-down 50mm | Ep3 kit assembly |
| W7 | Shipping label + tracking scan | Macro | Ep3 day-2 beat |
| W8 | The "oops" shelf: damaged bag + replacement being packed (transparency bank) | Handheld | Warehouse Honesty |

### 5.3 Cupping lab (the ritual bank — most-reused footage we own)

| # | Shot | Spec | Used in |
|---|---|---|---|
| C1 | Grinding: grounds falling into bowls, top-down | 120fps conformed | Ep1/3, Score Reveal |
| C2 | Water pour: kettle stream, bloom, crust forming | 100mm macro, raking light | Ep1/2/3 |
| C3 | **The break** (SF-03), spoon through crust, grounds sinking | Overhead locked, 120fps | signature shot, all eps |
| C4 | Skimming: two spoons clearing foam | 85mm side | Ep2 VO support |
| C5 | The slurp: profile close-up, aspirated spray in backlight | 50mm, 120fps, silhouette-friendly | hook variant C, pattern interrupt |
| C6 | Spittoon moment (honest, unfancy) | 35mm | hook C cutdowns |
| C7 | Scoresheet fill-in: pencil circling sub-scores | 100mm macro (SF-01) | all eps, thumbnails |
| C8 | Blind layout: numbered bowls, labels face-down | Top-down | Ep1 wager |
| C9 | Two scorecards side-by-side comparison | Overhead | Ep1/Ep3 proof beat |
| C10 | Eleven-minute stopwatch hitting 11:00 | Macro | Ep3 day-4 super |

**Field rules:** log every take with lot code + cup score so any coffee shown can be named truthfully in post (no anonymous "generic coffee" footage in score contexts); capture 30 s of clean room tone per location; releases for every identifiable person before the camera rolls.

## 6. Post & delivery specs (summary)

Master: 4K 24p ProRes 422, Rec.709; grain plate at 5% (35mm emulation, subtle); delivery: 16:9 4K + 1080, 9:16 1080×1920, 1:1 1080 — each reframed by an editor (no center-crop automation; data plates re-laid per aspect). Color: natural-warm grade, skin tones protected, greens pulled toward `#2F6B4A` family (never neon), whites to paper not blue. File naming: `GS_{EPISODE}_{ASPECT}_{HOOKVAR}_v{NN}` — mirrored in `utm_content` so creative analytics join cleanly.

## 7. Brand voice guide (applies to scripts, captions, thumbnails, VO direction)

**We are:** the colleague who cups blind and brings receipts. Specialty-literate, calm, funny exactly once per piece, and allergic to hype.

**Voice pillars:**
1. **Numbers before adjectives.** "86.5, washed, 2,100 masl" — never "exquisite premium heirloom." If an adjective survives edit, it must be sensory and defensible ("floral," "syrupy," "tea-like").
2. **Sensory specificity is respect.** Describe the cup like the reader has a palate: "apricot at temperature, black-tea finish as it cools," not "notes of fruit."
3. **Honesty about scarcity and failure.** Real bag counts. Real mistakes, repaired in public (Warehouse Honesty). The word "honestly" is allowed; the phrase "to be honest" is banned (implies the rest wasn't).
4. **Trade-fluent, never gatekeeping.** We say "the break" and then show it, so a new roaster learns the term without being tested. No jargon for status; jargon for precision.
5. **No manufactured urgency, no superlative inflation, no farmer-as-prop.** Origin footage dignifies labor: names, roles, and prices paid are said out loud when we know them. "Farmer partners" is banned unless a partnership contract exists; say the importer/exporter truth.

**Banned list (auto-fail in review):** premium, exotic, best, revolutionary, game-changing, "passion for coffee," "bean to cup," "unlock," fake countdowns, "limited time," stock-footage cuppings, anonymous farmer hands used to sell *our* brand values.

**Approved vocabulary:** verified, scoresheet, landed cost, blind, bags remaining, harvest week, first crack, proof, "cup it yourself," "the count is live."

**One-line test for every asset:** *Would a Q-grader nod, or smirk?* Ship only nods.
