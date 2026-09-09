# Auctum Ledger Full Rebrand — Design Spec

**Date:** 2025-01-23
**Project:** Greensheet Expansion
**Owner:** Auctum Ledger Product Team
**Strategy:** Hard Cut (Option A)
**Scope:** Full frontend + backend rebrand — no new features, no route changes

---

## 1. Visual Identity Mapping

### Palette

| Auctum Token | Hex | Replaces | Old Value |
|---|---|---|---|
| Parchment | `#F1F2EA` | `--gs-bg-canvas` | (coffee cream) |
| Ink | `#17231D` | `--gs-text` | (dark brown) |
| Oxblood | `#8C2F22` | `--gs-text-critical` | (cherry red) |
| Sage | `#7B8E7F` | `--gs-text-muted` / `--gs-border` | (leaf green) |
| Slate | `#5B6A5F` | `--gs-bg-subtle` | (muted) |
| Compass Navy | `#16323E` | `--gs-nav-bg` | (dark) |
| Constellation Teal | `#2A6E73` | `--gs-accent` | (teal) |
| Core Gold | `#C9A34A` | `--gs-gold` | (gold) |

### Typography

Fonts are **unchanged**:
- **Fraunces** — display headings
- **Archivo** — body copy
- **IBM Plex Mono** — code, data tables

Confirmed in `app/tailwind.config.js`.

### CSS Variables

All `--gs-*` variables become `--al-*` with updated values:
```
--gs-bg-canvas → --al-bg-canvas (#F1F2EA)
--gs-text → --al-text (#17231D)
--gs-text-muted → --al-text-muted (#7B8E7F)
--gs-border → --al-border (#7B8E7F)
--gs-text-critical → --al-text-critical (#8C2F22)
--gs-accent → --al-accent (#2A6E73)
--gs-nav-bg → --al-nav-bg (#16323E)
--gs-gold → --al-gold (#C9A34A)
... (all ~30 variables in tokens.css)
```

Tailwind color names (`navy`, `teal`, `gold`, `cherry`, `roast`, `leaf`, `parchment`) are preserved — only the `leaf` comment changes from `// greensheet green` to `// auctum sage`, and values update to the palette above.

### Verification Badge

The Auctum Ledger verification mark (described in `design-system/01-brand-identity.md`) is a compass-inspired icon within a circle. Implementation of the SVG component will be handled in a follow-up UI feature task — this spec covers only the token-level palette mapping.

---

## 2. Vocabulary Migration Table

| Category | Old (Greensheet) | New (Auctum Ledger) |
|---|---|---|
| App name | `Greensheet` | `Auctum Ledger` |
| CSS var prefix | `--gs-*` | `--al-*` |
| localStorage: locale | `greensheet:locale` | `auctum:locale` |
| localStorage: theme | `greensheet:theme` | `auctum:theme` |
| localStorage: store | `greensheet-store` | `auctum-store` |
| localStorage: ai | `greensheet:ai` | `auctum:ai` |
| Zustand store name | `GreensheetStore` | `AuctumLedgerStore` |
| Zustand storage key | `greensheet-store` | `auctum-store` |
| Error code prefix | `GS-` | `AL-` |
| Error namespace: General | `GS-GEN-*` | `AL-GEN-*` |
| Error namespace: Catalog | `GS-CAT-*` | `AL-CAT-*` |
| Error namespace: Commerce | `GS-CMP-*` | `AL-CMP-*` |
| Error namespace: CRM | `GS-CRM-*` | `AL-CRM-*` |
| Error namespace: Analytics | `GS-ANL-*` | `AL-ANL-*` |
| Ref code prefix | `GS-REF-1001` | `AL-REF-1001` |
| Referral code prefix | `GS-RVR-001` | `AL-RVR-001` |
| Campaign codes | `COF-001`–`COF-005` | `ALT-001`–`ALT-005` |
| Campaign slug IDs | `cof-001`–`cof-005` | `alt-001`–`alt-005` |
| Campaign name | `Auctum Trading Coffee` | `Auctum Ledger Trading` |
| TypeScript: CoffeeLot | `CoffeeLot` | `LedgerLot` |
| TypeScript: CoffeeLotCreate | `CoffeeLotCreate` | `LedgerLotCreate` |
| TypeScript: CoffeeLotPatch | `CoffeeLotPatch` | `LedgerLotPatch` |
| Field: processingMethod | `processingMethod` | `processMethod` |
| API domain | `api.greensheet.io` | `api.auctum.io` |
| CSV download filename | `greensheet_catalog_` | `auctum_ledger_catalog_` |
| ErrorBoundary label | `[Greensheet Platform ErrorBoundary]` | `[Auctum Ledger Platform ErrorBoundary]` |

### Decision: Campaign Code Prefix

`COF-` originally mapped to "Coffee." Under the rebrand, chosen as `ALT-` (Auctum Ledger Trading). Alternative considered: `LGR-` (Ledger). `ALT-` selected as it reads as "Auctum Ledger" abbreviation and aligns with the "Trading" sub-brand name.

### Decision: Interface Reconciliation

Two distinct `CoffeeLot` interfaces exist:
- **`app/src/types/api.ts`** (canonical) — uses `pricePerLbCents` (int), nested `certifications` array, nullable fields
- **`app/src/data/lots.ts`** (legacy) — uses `pricePerLb` (float), flat `certifications` booleans

Both rename to `LedgerLot`. The legacy shape is **not** kept as a separate type — seed data in `db.ts` is updated to match the canonical `api.ts` shape. All consumer property accesses updated accordingly (e.g., `lot.processingMethod` → `lot.processMethod`).

---

## 3. Frontend Changes (File-by-File)

### CSS / Design Tokens
- **`app/src/styles/tokens.css`** — all `--gs-*` → `--al-*`, values updated to Auctum palette (~30 variables)
- **`app/tailwind.config.js`** — color references updated to `--al-*` vars, `leaf` comment updated

### App Shell
- **`app/src/App.tsx`** — L21: `localStorage.getItem('greensheet:locale')` → `'auctum:locale'`; L50: ErrorBoundary string; L69: `localStorage.removeItem('greensheet-store')` → `'auctum-store'`
- **`app/src/i18n/index.ts`** — L34: `lookupLocalStorage: 'greensheet:locale'` → `'auctum:locale'`
- **`app/src/AppLayout.tsx`** — L37: locale storage read; L45: theme storage read; L52: locale storage write; L126: sidebar wordmark → "Auctum Ledger"

### State Management (Zustand)
- **`app/src/stores/root-store.ts`** — L68: `name: 'greensheet-store'` → `'auctum-store'`; L96: `{ name: 'GreensheetStore' }` → `{ name: 'AuctumLedgerStore' }`
- **`app/src/stores/slices/ui-slice.ts`** — L39, L45: `localStorage.setItem('greensheet:theme', ...)` → `'auctum:theme'`
- **`app/src/stores/ai-store.ts`** — L17: `name: 'greensheet:ai'` → `'auctum:ai'`
- **`app/src/lib/ai-persist-storage.ts`** — L4: `export const AI_STORAGE_KEY = 'greensheet:ai'` → `'auctum:ai'`

### API Layer
- **`app/src/api/problems.ts`** — L5: domain URL → `https://api.auctum.io/problems/${code}`; L14: `export const GS =` → `export const AL =`; L15-22: all error code strings (`GS-GEN-*` → `AL-GEN-*`, etc.)
- **`app/src/api/client.ts`** — L14-16: import renames (`CoffeeLot` → `LedgerLot`, etc.); L65: ref code generation `GS-${word}-${suffix}` → `AL-${word}-${suffix}`; L582: `processingMethod` → `processMethod`; L1080-1084: campaign IDs `cof-001` → `alt-001`; L1116: regex `/^GS-[A-Z]{2,6}-\d{1,4}$/` → `/^AL-[A-Z]{2,6}-\d{1,4}$/`; L1126, L1231, L1270, L1322, L1334: ref codes `GS-REF-1001` → `AL-REF-1001`
- **`app/src/api/db.ts`** — L5: interface import `CoffeeLot` → `LedgerLot`; L22: `CoffeeLot[]` → `LedgerLot[]`; L41, L62, L83, L104, L125: `processingMethod:` → `processMethod:`; L259-428: all `COF-001`–`COF-005` → `ALT-001`–`ALT-005`; L448, L456, L468, L486, L498, L511, L524, L533, L548, L558, L575: `GS-RVR-001`/`GS-RVR-002` → `AL-RVR-001`/`AL-RVR-002`; L594, L605, L636, L647: description strings
- **`app/src/api/schemas.ts`** — L30: `z.string().regex(/^COF-00[1-9]$/)` → `/^ALT-00[1-9]$/`; L47: `processingMethod:` → `processMethod:`
- **`app/src/api/marketing-data.ts`** — L34, L36-93, L56, L62-310: all `COF-001`–`COF-005` → `ALT-001`–`ALT-005`; L56, L83, L85, L124, L126, L183, L185: "Greensheet" → "Auctum Ledger" in email/SMS body text

### Data Layer
- **`app/src/types/api.ts`** — L280: `CoffeeLot` → `LedgerLot`; L284: `processingMethod: ProcessingMethod` → `processMethod: ProcessingMethod`; L304, L308, L316, L331: `CoffeeLotMetrics` → `LedgerLotMetrics`, `CoffeeLotCreate` → `LedgerLotCreate`, `CoffeeLotPatch` → `LedgerLotPatch`
- **`app/src/types/domain.ts`** — L1: `import type { CoffeeLot } from '../data/lots'` → `import type { LedgerLot } from '../types/api'`; L3: `export type { CoffeeLot }` → `export type { LedgerLot }`
- **`app/src/data/lots.ts`** — L1: `export interface CoffeeLot` → `LedgerLot`; L5: `processingMethod:` → `processMethod:`; L22: `CoffeeLot[]` → `LedgerLot[]`
- **`app/src/data/spaces.ts`** — verify for brand refs (grep inconclusive)
- **`app/src/data/feed.ts`** — verify (grep showed no brand identifiers)

### Components
- **`app/src/components/LotDetailDrawer.tsx`** — L4: import path update; L45: `lot.processingMethod` → `lot.processMethod`
- **`app/src/components/ComparisonTray.tsx`** — L63: `lot.processingMethod` → `lot.processMethod`
- **`app/src/components/CuppingScoreDisplay.tsx`** — L79, L82: `rgb(var(--gs-border))` → `rgb(var(--al-border))`, `rgb(var(--gs-text-muted))` → `rgb(var(--al-text-muted))`
- **`app/src/lib/lot-form-helpers.ts`** — L6, L18, L30: `processingMethod` → `processMethod`
- **`app/src/components/forms/LotForm.tsx`** — L21, L33, L50, L76: `processingMethod` → `processMethod` (import, property access, input name)
- **`app/src/components/forms/RuleForm.tsx`** — L103: `placeholder="COF-001"` → `placeholder="ALT-001"`
- **`app/src/components/forms/WebhookForm.tsx`** — L46: `placeholder="https://api.example.com/webhooks/greensheet"` → `auctum`

### Pages
- **`app/src/pages/CatalogPage.tsx`** — L118: `greensheet_catalog_` → `auctum_ledger_catalog_`
- **`app/src/pages/CampaignsPage.tsx`** — L56-60: status map keys `'COF-001'` → `'ALT-001'`; L806, L810, L814: JSX span values `COF-001`, `COF-004`, `COF-005` → `ALT-001`, `ALT-004`, `ALT-005`

### Locale Files
- **`localization/02-locale-files/en-US.json`** — grep for "Greensheet", "greensheet", "COF-", "GS-"
- **`localization/02-locale-files/zh-CN.json`** — same
- **`localization/02-locale-files/es-MX.json`** — same
- **`localization/02-locale-files/pt-BR.json`** — same

---

## 4. Backend Changes

### Server File Audit
- **`app/server/index.ts`** — check for "Greensheet" or campaign code references
- **`app/server/routes/chat.ts`** — check for brand references in responses or system prompt loading
- **All system prompt files** (`app/server/prompts/*` or similar) — check if any reference "Greensheet" or `COF-` codes → update to "Auctum Ledger" / `ALT-`
- **All provider files** (`app/server/providers/*`) — check for brand references

### No New Endpoints
This is a rebrand only — no API contract changes. Routes, response shapes, and HTTP methods remain identical. Only internal string identifiers change.

### Error Code Namespace
`problems.ts` exports `GS = { GEN: 'GS-GEN', ... }` → renamed to `AL = { GEN: 'AL-GEN', ... }`. All references to `GS.GEN`, `GS.CAT`, etc. throughout the codebase and tests become `AL.GEN`, `AL.CAT`, etc.

---

## 5. Testing Strategy

All 236 tests assert on the identifiers being changed. Tests are updated in lockstep — never split from source changes.

### Test Files to Update
- **`app/src/api/__tests__/db.test.ts`** — L21: test description `COF-001` → `ALT-001`
- **`app/src/api/__tests__/client.test.ts`** — all `GS-GEN-1000`, `GS-REF-*`, `GS-CUSTOM-42`, `^GS-` regex, `COF-00x` assertions
- **`app/src/stores/__tests__/*.test.ts`** — all `GS-GEN-*`, `GS-CAT-*`, `GS-CMP-*`, `GS-CRM-*`, `GS-ANL-*` assertions
- **`app/src/pages/__tests__/*.test.tsx`** — all `COF-001`–`COF-005` assertions
- **`app/src/components/forms/__tests__/RuleForm.test.tsx`** — `COF-001`, `COF-006` assertions
- **`app/src/components/ui/__tests__/ui-primitives.test.tsx`** — check for brand refs
- **`app/src/stores/slices/__tests__/helpers/reset-ui.ts`** — check for storage key refs

### Test Changes
- Only assertion strings and expected values change — no test logic changes
- Run `npm test -- --watchAll=false` after full sweep to confirm all 236 pass
- Add one smoke test verifying `AL-` prefix ref code generation and `ALT-001` campaign code acceptance

---

## 6. Rollback & Reversibility

### Approach
Single atomic git commit containing all rebrand changes. Reversal is `git revert`.

### Preserved (No Change)
- Route paths — fully preserved
- Font families — Fraunces, Archivo, IBM Plex Mono unchanged
- Tailwind color names — `navy`, `teal`, `gold`, `cherry`, `roast`, `leaf`, `parchment` stay (only values + comments change)

### Irreversible Without Reverting
- Unified `LedgerLot` interface shape (if seed data is reformatted during merge)
- Locale file changes (harder to cherry-pick if squash-merged)

### No Feature Flags
Approach A (single atomic hard cut) — no dual-state to maintain.

---

## 7. Scope Exclusions

The following are explicitly **out of scope** for this rebrand and will be handled separately:
- Auctum Ledger verification badge SVG component (awaiting visual design from brand team)
- `ledger` Tailwind color alias (renaming `leaf` → `sage` considered but deferred — too many TSX references for scope)
- Any UI layout, component, or workflow changes
- Marketing copy rewriting beyond what's in seed data and locale files
