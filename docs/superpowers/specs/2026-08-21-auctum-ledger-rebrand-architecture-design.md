# Auctum Ledger Rebrand — Architecture Design Spec

**Spec ID:** AUCTUM-REBRAND-2026-001  
**Date:** 2026-08-21  
**Status:** Draft — pending user review  
**Source of truth:** AUCTUM Identity Core (2026-08-21) + Auctum Unified Marketing Strategy  
**Scope:** Front-end (`app/src/`) + back-end (`app/server/`) + design system docs (`design-system/`) + public assets (`app/public/`)

---

## 0. Executive Summary

The Greensheet application is being rebranded as **Auctum Ledger** under the Auctum master brand. The source code is ~95% complete for text/strings — all user-facing labels, localStorage keys, system prompts, API namespaces, and marketing data have already been migrated. The remaining work is concentrated in three layers:

1. **Visual foundation** — aligning the color palette, typography, and design tokens to the Auctum identity core (parchment grounds, ink, Compass Navy, oxblood, sage, slate)
2. **Verification sealing** — implementing the "AUCTUM VERIFIED ORIGIN" earned seal as a UI component
3. **Governance encoding** — the four voice registers (House, Ledger, Counter, Verification) encoded as content patterns; cleanup of residual "LotSpace" file names, imports, and mock strings

**Routes are preserved** — all 11 existing routes remain unchanged.

---

## 1. Brand Identity Mapping

### 1.1 Master Brand
| Element | Value | Source |
|---|---|---|
| Master name | AUCTUM (all-caps for seal/legal; "Auctum" in editorial) | identity_core.md:14 |
| Pronunciation | "AWK-tum" | identity_core.md:10 |
| Doctrine | Value is co-created, not extracted | identity_core.md:12 |
| Standard | Verified, from origin | identity_core.md:12 |
| Master tagline | "Auctum. Value is co-created, not extracted." | identity_core.md:49 |
| Trade lockup | "Auctum. Verified, from origin." | identity_core.md:51 |

### 1.2 Product Label
| Element | Value |
|---|---|
| Product name | Auctum Ledger |
| Endorsement | "by Auctum" at 40–60% optical size |
| Status | Successor to Greensheet — the verified B2B distribution platform |

### 1.3 Voice Registers
The four governed registers map to the application's audience:

| Register | Audience | Used in app for |
|---|---|---|
| **House** (luxury) | Atelier clients, auctions, press | Future: Atelier commission flows, press pages |
| **Ledger** (trade/professional) | Roasters, importers, partners | **Primary register for all current B2B UI** |
| **Counter** (consumer/punk) | Consumers, social, campaigns | Future: LotSpace consumer social features |
| **Verification** (operational) | Staff, auditors, farmers, courts | Future: farmer Spaces, runbooks, receipts |

**Binding rule:** Registers are never mixed in one view. The current app (B2B trade platform) uses the Ledger register as its primary voice.

### 1.4 Color Palette Mapping

The identity core specifies:

| Brand color | Hex | Current codebase token | Action |
|---|---|---|---|
| Parchment (paper ground) | `#F1F2EA` / `#D5DAC6` | `--al-bg-canvas: 241 242 234` (light) | **Update** — current uses `#F6F1E7`; align to `#F1F2EA` |
| Ink (primary text) | `#17231D` | `--al-text-primary: 34 29 22` (`#221D16`) | **Update** — align from `#221D16` to `#17231D` |
| Compass Navy | (from design-system docs) `#16323E` | `--al-navy: #16323E` | **Retain** — already matches |
| Oxblood stamp | `#8C2F22` | `--al-cherry: #8C3B34` | **Update** — align from `#8C3B34` to `#8C2F22` |
| Sage | `#7B8E7F` | `--al-teal: #2A6E73` / `--al-leaf: #3E6B50` | **Reorganize** — identity core names this "sage"; current code has it as `--al-leaf` |
| Slate | `#5B6A5F` | `--al-text-muted: #5C5546` or `#7B8E7F` | **Align** — update muted text to `#5B6A5F` or closest match |

**Key semantic decisions:**
- **Primary action color** → Compass Navy (`#16323E`) replaces teal as the dominant brand color
- **Earned excellence** (cup scores 90+, verified seals, A/B winners) → gold/bronze (`#C9A34A` / brass) is retained from the design system — gold = earned, never decorative
- **Origin/terroir** → oxblood (`#8C2F22`) replaces cherry for origin accents and destructive actions
- **ESG/subsistence** → sage (`#7B8E7F`) for green sustainability markers
- **Price** → teal (`#2A6E73`) is retained as the "ledger" color for financial data (per design-system docs §3.1, where teal is "primary accents and brand highlights")

**Conflict resolution:** The identity core (ratified 2026-08-21) takes precedence over the design-system docs where they conflict. Where the design-system docs are silent, the identity core values apply. The current `tokens.css` deviates from both in some values (ink `#221D16` vs. identity core `#17231D`); these will be aligned to the identity core.

### 1.5 Typography

| Role | Font family | Current in code | Alignment needed |
|---|---|---|---|
| Display (titles, wordmark) | Fraunces | `font-display: ['Fraunces', 'Cormorant Garamond', 'Georgia', 'serif']` | **OK** — Fraunces is first |
| UI (sans-serif) | Archivo | `font-sans: ['Archivo', 'Inter', 'system-ui', 'sans-serif']` | **OK** — Archivo is first |
| Data/ledger (mono) | IBM Plex Mono | `font-mono: ['IBM Plex Mono', 'JetBrains Mono', 'ui-monospace', 'monospace']` | **OK** — IBM Plex Mono is first |

Typography is already aligned. No changes needed.

---

## 2. Visual Foundation Changes

### 2.1 Token System (`tokens.css` + `tailwind.config.js`)

**Files to modify:**
- `app/src/styles/tokens.css` — update color values to identity core
- `app/tailwind.config.js` — add `compassNavy` and `oxblood` color families; remap `teal` → semantic role clarification

**Changes:**

**`tokens.css` light mode:**
```css
:root {
  /* surfaces */
  --al-bg-canvas: 241 242 234;   /* parchment #F1F2EA (identity core) */
  --al-bg-surface: 253 251 245;  /* #FDFBF5 */
  --al-bg-recessed: 239 232 218; /* #EFE8DA → align to #D5DAC6 */
  --al-bg-hover: 228 220 201;    /* #E4DCC9 → align to #D5DAC6 */
  /* text */
  --al-text-primary: 23 33 29;   /* ink #17231D (identity core) */
  --al-text-muted: 91 106 95;    /* slate #5B6A5F (identity core) */
  --al-text-subtle: 138 130 114;
  /* brand statics */
  --al-navy: #16323E; --al-navy-hover: #12252F;  /* Compass Navy — primary action */
  --al-teal: #2A6E73; --al-teal-hover: #1F4F54;  /* retained for data/financial */
  --al-gold: 201 163 74; --al-gold-text: #7A5F22; /* brass — earned excellence */
  --al-cherry: #8C2F22; --al-roast: #4A3527; --al-leaf: #7B8E7F; /* oxblood stamp, roast, sage */
  ...
}
```

**`tailwind.config.js`** — add new semantic color aliases:
```js
colors: {
  // existing semantic (unchanged)
  canvas: 'rgb(var(--al-bg-canvas) / <alpha-value>)',
  surface: 'rgb(var(--al-bg-surface) / <alpha-value>)',
  // map teal → navy as primary action
  navy:   { DEFAULT: '#16323E', 800: '#12252F', 900: '#0E1A22', 600: '#1F4F54' },
  // teal retained as ledger/data color
  teal:   { DEFAULT: '#2A6E73', 700: '#1F4F54', 500: '#3D8A90', 300: '#7FB6BA', 100: '#DCEAEA' },
  oxblood: { DEFAULT: '#8C2F22', 300: '#B04E3E', 100: '#F9E6E2' },
  gold:   { DEFAULT: '#C9A34A', 600: '#7A5F22', 300: '#D4B96A', 100: '#F0E6CC' },
  roast:  { DEFAULT: '#4A3527', 800: '#3A2A1E', 100: '#E9DFD2' },
  leaf:   { DEFAULT: '#7B8E7F', 300: '#B8C9BA', 100: '#E6EDE9' }, /* sage, identity core */
  parchment: { DEFAULT: '#F1F2EA', 50: '#FDFBF5', 200: '#D5DAC6', 300: '#C2CDC0' },
  ...
}
```

### 2.2 Logo & Assets (`app/public/`)

**Changes:**
- **`favicon.svg`** — regenerate as the AL Monogram (lot-stamp: ink `#16323E` field with brass `#C9A34A` bean core, negative-space "AL")
- **`index.html`** — update `<title>` from `app` to `Auctum Ledger — Verified Green Coffee Marketplace`

No image logo files exist — the brand logo is rendered as text in `AppLayout.tsx`. The sidebar currently shows "Auctum Ledger" in `font-display` (Fraunces) with "BY Auctum" microline. This is correct per the brand architecture (product label + "by Auctum" endorsement).

### 2.3 App Shell (`AppLayout.tsx`)

**Changes needed:**
- Sidebar background: already `bg-navy` (`#16323E` = Compass Navy) — **OK**
- Sidebar text: already `text-parchment-50` — **needs parchment color update** from `#F6F1E7` to `#F1F2EA`
- Wordmark "Auctum Ledger" — already present in `font-display` — **OK**
- Microline "BY Auctum" — already correct — **OK**
- Footer: "Auctum Ledger • Navigate Your Reality" → update to "Auctum Ledger • Verified, from origin."
- Accent line on active nav: currently `bg-gold` — gold is retained for earned excellence; active nav indicator should use `bg-oxblood` or `bg-teal` (ledger accent) instead. Per the identity core, gold is for "earned excellence" — nav selection is not earned excellence. **Change active indicator to `bg-teal`** (the ledger/data accent color) or `bg-oxblood` (origin accent).

**Decision:** Use `bg-teal` for active nav (ledger register, professional context). Gold remains for cup scores 90+, verified seals, and A/B winners.

---

## 3. Component Refit

### 3.1 `VerificationBadge` → `AuctumVerifiedOrigin` Seal (new component)

**File:** `app/src/components/AuctumVerifiedOrigin.tsx`

**Replaces:** `app/src/components/VerificationBadge.tsx`

This component implements the "AUCTUM VERIFIED ORIGIN" seal from the identity core. The seal is **earned, never decorative** — it only renders the full seal when a lot has passed the full verification stack (`audit_verified` tier).

```tsx
interface AuctumVerifiedOriginProps {
  verified: boolean;
  tier: VerificationTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

**States:**
| Tier | Seal appearance | Rule |
|---|---|---|
| `audit_verified` | Full "AUCTUM VERIFIED ORIGIN" seal in brass (#C9A34A) on parchment | Only for lots that passed the full verification stack |
| `agent_verified` | Simplified "Verified" in Compass Navy on canvas | Agent-verified lots (partial verification) |
| `self_declared` | Outline "Declared" in sage on recessed | Self-declared only — no seal impression |
| `verified: false` | No seal rendered | The seal is never shown on unverified lots |

**Import updates** — all 5 files that import `VerificationBadge` switch to `AuctumVerifiedOrigin`:
- `app/src/components/FeedPostCard.tsx`
- `app/src/components/SpaceCard.tsx`
- `app/src/components/CuppingScoreDisplay.tsx`
- `app/src/stores/slices/feeds-slice.ts` (if it renders the badge)
- Any test files for `VerificationBadge`

### 3.2 Voice Register Component (new)

**File:** `app/src/components/VoiceRegister.tsx`

A thin wrapper that tags UI content blocks with a `register` prop and enforces register rules at render time.

```tsx
interface VoiceRegisterProps {
  register: 'house' | 'ledger' | 'counter' | 'verification';
  children: React.ReactNode;
  title?: string;      // register-gated heading text
  caption?: string;     // register-gated caption text
}
```

**Purpose:** Ensures no register is mixed within a single view. The B2B platform uses Ledger register content throughout. This component provides a runtime guard and a CSS class hook (`register--house`, `register--ledger`, etc.) so that future consumer-facing features (Counter) or atelier features (House) can apply distinct typography and styling without mixing.

**Usage:** Wrap page-level content in `<VoiceRegister register="ledger">` to enforce the Ledger register. Future: `<VoiceRegister register="counter">` for consumer-facing LotSpace sections.

### 3.3 CupScoreBadge — Visual Alignment

**File:** `app/src/components/CupScoreBadge.tsx`

**Changes:**
- Score ≥ 90: `bg-gold` (brass) text `ink` — already correct ("gold is earned")
- Score 85–89: `bg-navy` (Compass Navy) text `parchment` — change from `bg-teal`
- Score 80–84: `bg-teal` (ledger) text `white` — change from `bg-leaf`
- Score < 80: `bg-slate` text `white` — change from `bg-neutral-700`

**Rationale:** Per the cup-score semantic scale in `02-design-tokens.md`, 90+ = gold (earned), 85 = teal (house tier), 80 = green (specialty floor). But per the identity core, oxblood = origin/terroir, not a cup-score tier. The design-system docs already have a cup-score scale (§2.3) that maps correctly. **Decision: follow the design-system docs' cup-score scale** — it's already aligned with the Auctum Ledger system. Only minor remapping needed: `teal` → `navy` for the 85 tier (Compass Navy as "house tier" in the new system), `leaf` (green) stays for 80 tier.

### 3.4 SubsistenceLedger — Color Alignment

**File:** `app/src/components/SubsistenceLedger.tsx`

**Changes:**
- Pillar colors currently use hardcoded hex (`#2A6E73` teal → change to sage `#7B8E7F` per identity core)
- Oxblood pillar (`#8C3B34` → `#8C2F22`)
- Surplus indicator: `bg-leaf` → `bg-sage` (using updated `leaf` token = `#7B8E7F`)

The hardcoded hex values in the PILLARS array need to be replaced with Tailwind classes that reference the updated token system.

### 3.5 SpaceCard — Color Alignment

**File:** `app/src/components/SpaceCard.tsx`

**Changes:**
- `bg-navy` avatar → already Compass Navy — **OK**
- `hover:border-teal` → change to `hover:border-navy` (Compass Navy is now primary; teal is data accent)
- `bg-teal/10` (roaster archetype) → `bg-navy/10` (Compass Navy)
- `bg-gold/10` (cooperative) → `bg-oxblood/10` (using updated oxblood)
- `text-teal` (roaster archetype) → `text-navy`
- `text-gold` (cooperative) → `text-oxblood`

### 3.6 FeedPostCard — Color Alignment

**File:** `app/src/components/FeedPostCard.tsx`

**Changes:**
- `hover:border-teal/30` → `hover:border-navy/30`
- `text-teal` (price metric) → `text-navy` (Compass Navy as primary)
- `text-cherry` (tip amount) → `text-oxblood`
- `bg-cherry/10` (tip button) → `bg-oxblood/10`

---

## 4. Structural Cleanup (Residual "LotSpace")

### 4.1 Rename type file

**Action:** Rename `app/src/types/lotspace.ts` → `app/src/types/ledger.ts`

**Import updates** (9 files, change `from '../types/lotspace'` / `'../../types/lotspace'` to `'../types/ledger'` / `'../../types/ledger'`):
1. `app/src/components/CuppingScoreDisplay.tsx`
2. `app/src/components/FeedPostCard.tsx`
3. `app/src/components/SpaceCard.tsx`
4. `app/src/components/SubsistencyLedger.tsx`
5. `app/src/components/TipModal.tsx`
6. `app/src/components/VerificationBadge.tsx`
7. `app/src/stores/slices/connections-slice.ts`
8. `app/src/stores/slices/feeds-slice.ts`
9. `app/src/stores/slices/reputation-slice.ts`
10. `app/src/stores/slices/spaces-slice.ts`

**Internal comment update:** `types/ledger.ts:2` — "LotSpace — Domain Type System" → "Auctum Ledger — Domain Type System"

### 4.2 Mock data cleanup

**`app/src/data/spaces.ts`:**
- Line 2: comment "LotSpace — Mock Spaces Data" → "Auctum Ledger — Mock Spaces Data"
- Line 758: roaster bio "building our first farm relationships through LotSpace." → "building our first farm relationships through Auctum Ledger."
- Line 795: café bio "sourcing exclusively from verified LotSpace farmers" → "sourcing exclusively from verified Auctum Ledger farmers"
- Line 888: cooperative bio "with LotSpace agent network" → "with Auctum Ledger agent network"

**`app/src/data/feed.ts`:**
- Line 2: comment "LotSpace — Mock Feed Posts & Competition Data" → "Auctum Ledger — Mock Feed Posts & Competition Data"
- Line 167: "LotSpace Dak Lak Cup" → "Auctum Dak Lak Cup"
- Line 260: "LotSpace Dak Lak Cup — 2025" → "Auctum Dak Lak Cup — 2025"

### 4.3 HTML title

**`app/index.html`:**
- `<title>app</title>` → `<title>Auctum Ledger — Verified Green Coffee Marketplace</title>`

---

## 5. Content & Copy Layer

### 5.1 Locale files (`localization/02-locale-files/`)

**Current state:** All 4 locale files already branded "Auctum Ledger" with correct meta tags. Content uses the Ledger register (warm, exact, collegial).

**Changes needed:**
- `en-US.json:4` — tagline "Green coffee, sourced with confidence." → align to trade lockup "Verified, from origin." or retain if "sourced with confidence" is the product tagline. Per identity core, the trade lockup is "Auctum. Verified, from origin." — **update tagline to "Verified green coffee, from origin."**
- `en-US.json:83` — meta title "Auctum Ledger — Specialty Green Coffee Sourcing" → update to "Auctum Ledger — Verified Green Coffee Marketplace"
- All 1,036 keys across 4 locale files: scan for any residual "Greensheet" or "LotSpace" references (none found in the en-US.json read — it's fully branded). Verify other 3 locale files for the same.

### 5.2 Email templates (`api/marketing-data.ts`)

**Current state:** All 5 ALT templates already branded "Auctum Ledger" with Ledger-register copy.

**Changes needed:**
- Verify the voice aligns with the Ledger register (warm, exact, collegial, every claim carries a number) — the templates already follow this pattern.
- Update any "ODASI" references → "Auctum" (check for founder references per hard constraint).

### 5.3 System prompt (`server/system-prompt/base.ts`)

**Current state:** "Auctum Vietnam Coffee Industry Omni-Expert" — correctly branded.

**No changes needed.**

---

## 6. Design System Docs Update

### 6.1 `design-system/01-brand-identity.md`

**Changes:**
- Line 3: "Version 1.0 · ODASI Technologies Product Family" → "Version 1.0 · Auctum Product Family"
- Line 13: "BY ODASI" in wordmark description → "BY Auctum"
- Line 31: tagline "Navigate your reality. Own your journey." → retirement note or update to Auctum tagline
- Line 128-129: "Auctum Ledger by ODASI" → "Auctum Ledger by Auctum" (but per brand architecture, the master brand IS Auctum, so endorsement is "by Auctum")
- Line 16: Remove "Auctum Ledger" green `#3E6B50` color reference if it conflicts with identity core
- Update all color references to match identity core hex values where they differ

### 6.2 `design-system/02-design-tokens.md`

**Changes:**
- Align all hex values to identity core (ink `#17231D`, parchment `#F1F2EA`, oxblood `#8C2F22`, sage `#7B8E7F`, slate `#5B6A5F`)
- Update font families from "Playfair Display / Inter / JetBrains Mono" to "Fraunces / Archivo / IBM Plex Mono" (identity core takes precedence)
- Update `tokens.json` W3C example to match corrected values

### 6.3 `design-system/05-ui-implementation-prompt.md`

**Changes:**
- Line 11: "Auctum Ledger is a product of ODASI Technologies" → "Auctum Ledger is a product of Auctum"
- Line 44: "BY ODASI" → "BY Auctum"
- Line 80: "Playfair Display" → "Fraunces"; "Inter" → "Archivo"; "JetBrains Mono" → "IBM Plex Mono"
- Line 92: "Playfair Display" → "Fraunces" in sidebar wordmark
- Line 121-128: Update wordmark font and endorsement line
- Line 183: "Auctum Ledger, 548 Market St" postal address — verify correctness

---

## 7. Back-End Changes

### 7.1 API layer (`src/api/`)

**Current state:** Already branded with Auctum identity (`api.auctum.io` namespace, "Auctum Ledger" in marketing data).

**Changes needed:**
- `src/api/problems.ts` — already correct namespace `https://api.auctum.io/problems/`
- `src/api/schemas.ts` — check for any "lotspace" references in Zod schema names or descriptions
- `src/api/client.ts` — check for residual brand references in endpoint URLs or comments

### 7.2 Server (`server/`)

**Current state:** Express API proxy with `/health` and `/api/v1/chat` SSE endpoint. System prompt branded as "Auctum Vietnam Coffee Industry Omni-Expert."

**Changes needed:**
- None structurally. The backend is minimal (chat proxy only). The EUDR compliance data schema lives in the type system (`types/lotspace.ts` → `types/ledger.ts`) and is already correctly branded.
- No new backend routes needed — the rebrand is presentation-layer only.

---

## 8. Testing Strategy

### 8.1 Existing test suite
- Vitest + Testing Library + jsdom (frontend)
- Supertest (backend)
- Test files co-located in `__tests__/` directories

### 8.2 Test changes needed

1. **Rename `VerificationBadge` tests** → `AuctumVerifiedOrigin` tests
   - Update test assertions: `VerificationBadge` → `AuctumVerifiedOrigin`
   - Add assertions for the "AUCTUM VERIFIED ORIGIN" seal text when `tier === 'audit_verified'`
   - Add test: seal does not render when `verified === false`

2. **Add `VoiceRegister` tests**
   - Test that register prop applies correct CSS class
   - Test that mixed-register children are rejected (runtime guard)

3. **Token migration tests**
   - Verify `tokens.css` values match identity core hex values
   - Verify `tailwind.config.js` has `navy`, `oxblood`, `gold`, `teal`, `leaf`, `parchment` color families

4. **Structural cleanup tests**
   - Verify no imports reference `types/lotspace` after rename
   - Verify no "LotSpace" strings remain in data files

5. **Content layer tests**
   - Verify `index.html` title contains "Auctum Ledger"
   - Verify locale `en-US.json` tagline aligns with trade lockup

### 8.3 Running tests
```bash
cd app
npm run test:run    # vitest run — all unit tests
```

---

## 9. File-Level Implementation Checklist

### Foundation Layer
- [ ] `app/src/styles/tokens.css` — update color values to identity core
- [ ] `app/tailwind.config.js` — add `oxblood` color family, verify `navy`/`teal`/`gold`/`leaf`/`parchment` alignment
- [ ] `app/index.html` — update `<title>`

### Component Layer
- [ ] `app/src/components/AuctumVerifiedOrigin.tsx` — new component (replace `VerificationBadge`)
- [ ] `app/src/components/VoiceRegister.tsx` — new component
- [ ] `app/src/components/VerificationBadge.tsx` — delete (replaced by `AuctumVerifiedOrigin`)
- [ ] `app/src/components/CupScoreBadge.tsx` — update color classes
- [ ] `app/src/components/SubsistenceLedger.tsx` — update hardcoded hex to Tailwind tokens
- [ ] `app/src/components/SpaceCard.tsx` — update color classes
- [ ] `app/src/components/FeedPostCard.tsx` — update color classes
- [ ] `app/src/components/AppLayout.tsx` — update footer text, active nav indicator color

### Structural Cleanup
- [ ] Rename `app/src/types/lotspace.ts` → `app/src/types/ledger.ts` + update header comment
- [ ] Update 9+ import paths from `types/lotspace` → `types/ledger`
- [ ] `app/src/data/spaces.ts` — update comment + 3 mock bio strings
- [ ] `app/src/data/feed.ts` — update comment + 2 competition names

### Public Assets
- [ ] `app/public/favicon.svg` — regenerate as Auctum Ledger AL Monogram

### Content Layer
- [ ] `localization/02-locale-files/en-US.json` — update tagline + meta title
- [ ] `localization/02-locale-files/zh-CN.json` — verify/align
- [ ] `localization/02-locale-files/es-MX.json` — verify/align
- [ ] `localization/02-locale-files/pt-BR.json` — verify/align
- [ ] `app/src/api/marketing-data.ts` — verify ODASI references (none expected)

### Design System Docs
- [ ] `design-system/01-brand-identity.md` — update ODASI references, color values
- [ ] `design-system/02-design-tokens.md` — align hex values, font families
- [ ] `design-system/05-ui-implementation-prompt.md` — update ODASI references, font names

### Tests
- [ ] Rename/update VerificationBadge tests → AuctumVerifiedOrigin tests
- [ ] Add VoiceRegister tests
- [ ] Add token alignment tests
- [ ] Add structural cleanup verification tests

---

## 10. Constraints & Guardrails

- **Routes preserved** — all 11 routes stay at `/:locale/:page`
- **No GitHub pushes** — `marcusdax/greensheet` is read-only reference
- **English deliverables** — all docs and specs in English
- **Vietnamese diacritics preserved** — `Intl` API handles natively; no i18n encoding changes needed
- **No founder personal-brand references** — Wylder/ODASI retired per identity core
- **Gold = earned only** — brass/gold never used decoratively, only for 90+ cup scores, verified seals, A/B winners
- **Verification seal never decorative** — "AUCTUM VERIFIED ORIGIN" only renders on `audit_verified` tier lots
- **Registers never mixed** — VoiceRegister component enforces this at runtime
- **Fact canon** — all numbers from `identity_core.md` §6 Fact Canon must be the single source of truth for UI values

---

## 11. Out of Scope

- Consumer-facing Counter register features (LotSpace social network) — not in current app
- House register features (Atelier bespoke commissions) — not in current app
- New backend routes — the API proxy is functional and already branded
- Marketing website — not part of the application repo
- Brand book production (logo SVG, brand marks) — handled by design, not engineering

---

*Spec written per AUCTUM Identity Core (2026-08-21) and Auctum Unified Marketing Strategy. Pending user review before implementation.*
