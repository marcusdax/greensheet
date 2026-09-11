# Auctum Ledger Full Rebrand — Documentation Phase Design Spec

**Date:** 2025-01-23
**Project:** Greensheet Expansion
**Owner:** Auctum Ledger Product Team
**Strategy:** Hard Cut — documentation-only sweep (app code already rebranded)
**Phase:** Documentation Rebrand (Phase 2, following app code Phase 1)

---

## 1. Overview

The Auctum Ledger app code has already been fully rebranded and verified
(238 tests pass, build succeeds). This spec covers the **documentation
rebrand** — all written documentation, specs, plans, scripts, and READMEs
across the repository.

This is a **documentation-only** change. No application source code is
modified in this phase. All file replacements are pure text edits to
markdown and script files.

---

## 2. Brand Identity

### Name & Positioning

- **Name:** "Auctum Ledger by Auctum" — independent brand identity
- **Archetypes:** Curator (50%), Craftsman (35%), Trusted Ledger (15%)
- **Iconography:** Seal / folio (replaces "compass" in brand contexts)
- **Banned words:** "elevated," "curated," "journey," "ritual," "premium"

### Palette

| Token | Light Hex | Dark Hex | Replaces |
|---|---|---|---|
| Ink / Canvas | `#221E1B` | `#16120E` | Compass Navy |
| Oxblood | `#74362F` | `#C9978F` | (cherry) |
| Brass | `#947642` | `#C9A86A` | Core Gold |
| Sage | `#4F6958` | `#947642` | Constellation Teal / Slate |
| Paper / Text | `#F5F2EB` | `#F2EDE3` | Parchment |

### Typography

| Role | Font | Replaces |
|---|---|---|
| Display | Playfair Display | Fraunces |
| UI | Inter | Archivo |
| Code/Data | JetBrains Mono | IBM Plex Mono |

---

## 3. Vocabulary Migration Table

| Category | Old (Greensheet) | New (Auctum Ledger) |
|---|---|---|
| App name | `Greensheet` | `Auctum Ledger` |
| CSS var prefix | `--gs-*` | `--al-*` |
| Error code prefix | `GS-*` | `AL-*` |
| Error: General | `GS-GEN-*` | `AL-GEN-*` |
| Error: Catalog | `GS-CAT-*` | `AL-CAT-*` |
| Error: Commerce | `GS-CMP-*` | `AL-CMP-*` |
| Error: CRM | `GS-CRM-*` | `AL-CRM-*` |
| Error: Analytics | `GS-ANL-*` | `AL-ANL-*` |
| Referral code prefix | `GS-RVR-001` | `AL-RVR-001` |
| Campaign codes | `COF-001`–`COF-005` | `ALT-001`–`ALT-005` |
| Campaign slug IDs | `cof-001`–`cof-005` | `alt-001`–`alt-005` |
| TypeScript: CoffeeLot | `CoffeeLot` | `LedgerLot` |
| Field: processingMethod | `processingMethod` | `processMethod` |
| API domain | `api.greensheet.io` | `api.auctum.io` |
| auth domain | `auth.greensheet.io` | `auth.auctum.io` |
| App domain | `app.greensheet.co` | `app.auctum.io` |
| CSV filename prefix | `greensheet_catalog_` | `auctum_ledger_catalog_` |
| localStorage: locale | `greensheet:locale` | `auctum:locale` |
| localStorage: theme | `greensheet:theme` | `auctum:theme` |
| localStorage: store | `greensheet-store` | `auctum-store` |
| localStorage: ai | `greensheet:ai` | `auctum:ai` |
| Zustand store name | `GreensheetStore` | `AuctumLedgerStore` |
| Referral prefix | `GS-REF-*` | `AL-REF-*` |
| Docker image | `greensheet-app:prod` | `auctum-ledger-app:prod` |
| Campaign name | `Auctum Trading Coffee` | `Auctum Ledger Trading` |
| Widget title (AI agent) | `ODASI Coffee Agent` | `Auctum Coffee Agent` |
| Protected tokens (locale validation) | `("Greensheet", "SCA", "ESG", "Q Grader")` | `("Auctum", "Ledger")` |

---

## 4. Preserved (No Change)

The following are explicitly **out of scope** and must NOT be changed:

- **Route paths** — `/navigator`, `/catalog`, `/campaigns`, `/roasters`, `/analytics`
- **Tailwind color names** — `navy`, `teal`, `gold`, `cherry`, `roast`, `leaf`, `parchment`
- **`compass` easing function** — CSS easing name, not brand iconography
- **KMS CMK names** — `gs-rds`, `gs-msk`, `gs-secrets`, `gs-s3-audit`, `gs-pii` (infra identifiers)
- **`odasi-ai-v1`** — internal salt in `app/src/lib/ai-persist-storage.ts`
- **`BY ODASI`** / **`ODASI Technologies`** — parent brand endorsement in AppLayout
- **`Compass & Cup`** — roaster name (not Auctum/Ledger brand)
- **"Compass Circle"** — referral tier name (marketing doc) — *see note below*

### Note on "Compass" references

"Compass" appears in two contexts in the docs:

1. **Brand iconography** (design-system/01-brand-identity.md) — "Lot Compass,"
   "Compass Navy," "Compass rose," "Compass metaphors" → replace with seal/folio,
   Auctum Ledger palette
2. **Easing function** (`ease.compass` / `cubic-bezier(0.34, 1.56, 0.64, 1)`) —
   CSS technical term → **preserve unchanged**
3. **"Compass Circle"** (referral tiers in marketing docs) — brand tier name →
   replace with "Ledger Circle" (or appropriate Auctum tier name)

---

## 5. File Manifest

### Phase 1: design-system/ (5 files)

| # | File | Description |
|---|---|---|
| 1 | `design-system/01-brand-identity.md` | Brand identity — name, palette, iconography, voice |
| 2 | `design-system/02-design-tokens.md` | Design tokens — CSS vars, font stacks, color values |
| 3 | `design-system/03-component-library.md` | Component library — UI patterns, campaign references |
| 4 | `design-system/04-email-campaign-visual-system.md` | Email campaign visuals — COF codes, fonts, URLs |
| 5 | `design-system/05-ui-implementation-prompt.md` | UI implementation prompt — tokens, campaign codes |

### Phase 2: engineering/ (7 files)

| # | File | Description |
|---|---|---|
| 1 | `engineering/01-domain-model-event-storming.md` | Domain model — COF codes, event types |
| 2 | `engineering/02-openapi-contract.md` | OpenAPI spec — GS-GEN-* codes, domains |
| 3 | `engineering/03-event-driven-pipeline.md` | Event pipeline — namespace refs |
| 4 | `engineering/04-database-evolution.md` | DB schema — COF codes |
| 5 | `engineering/05-state-management-zustand.md` | Zustand stores — storage keys, store name |
| 6 | `engineering/06-testing-chaos-ci.md` | Testing — error codes, domains, campaign seeds |
| 7 | `engineering/07-security-compliance.md` | Security — OIDC, error codes, domains |

### Phase 3: marketing/ (6 files)

| # | File | Description |
|---|---|---|
| 1 | `marketing/01-growth-architecture.md` | Growth architecture — campaign codes |
| 2 | `marketing/02-cof-campaign-expansion.md` | Campaign expansion — COF codes throughout |
| 3 | `marketing/03-referral-engine-playbook.md` | Referral engine — GS-RVR-* codes, Compass Circle |
| 4 | `marketing/04-churn-intervention-playbook.md` | Churn — campaign codes |
| 5 | `marketing/05-video-content-ecosystem.md` | Video content — campaign journey |
| 6 | `marketing/06-production-bible.md` | Production bible — full brand identity |

### Phase 4: localization/ (5 files)

| # | File | Description |
|---|---|---|
| 1 | `localization/01-i18n-architecture.md` | i18n architecture — locale keys, domains |
| 2 | `localization/03-campaign-localization-playbook.md` | Campaign localization — COF codes |
| 3 | `localization/04-translation-pipeline.md` | Translation pipeline — glossary |
| 4 | `localization/05-i18n-audit-ci.md` | i18n audit — protected tokens |
| 5 | `localization/scripts/validate_locale_files.py` | Validation script — PROTECTED_TOKENS |

### Phase 5: root-level docs (3 files)

| # | File | Description |
|---|---|---|
| 1 | `app/README.md` | App README — Greensheet Platform |
| 2 | `README.md` | Root README — Greensheet Platform |
| 3 | `docs/docker.md` | Docker docs — image tags |

### Phase 6: docs/superpowers/ (13 files)

| # | File | Type | Description |
|---|---|---|---|
| 1 | `docs/superpowers/specs/2026-07-29-lot-templates-settings-design.md` | spec | Design — COF codes |
| 2 | `docs/superpowers/specs/2026-08-06-ai-chatbot-vietnam-coffee-agent-design.md` | spec | AI chatbot — storage keys |
| 3 | `docs/superpowers/specs/2026-08-06-docker-localhost-design.md` | spec | Docker — brand refs |
| 4 | `docs/superpowers/specs/2026-08-18-cof-campaign-seed-design.md` | spec | Campaign seed — COF codes |
| 5 | `docs/superpowers/specs/2026-08-19-referral-engine-core-design.md` | spec | Referral — GS-RVR-* codes |
| 6 | `docs/superpowers/specs/2026-08-19-referral-engine-ui-fraud-card-design.md` | spec | Fraud card — Compass Circle |
| 7 | `docs/superpowers/plans/2026-07-27-greensheet-frontend-expansion.md` | plan | Frontend expansion |
| 8 | `docs/superpowers/plans/2026-08-19-referral-engine-core-plan.md` | plan | Referral engine |
| 9 | `docs/superpowers/plans/2026-08-19-referral-engine-ui-fraud-card-plan.md` | plan | UI fraud card |
| 10 | `docs/superpowers/plans/2026-08-19-growth-dashboard-widgets-plan.md` | plan | Dashboard widgets |
| 11 | `docs/superpowers/plans/2026-08-18-cof-campaign-seed-plan.md` | plan | Campaign seed |
| 12 | `docs/superpowers/plans/2026-08-06-docker-localhost-plan.md` | plan | Docker localhost |
| 13 | `docs/superpowers/plans/2026-08-06-ai-chatbot-vietnam-coffee-agent-plan.md` | plan | AI chatbot |

**Total: 31 files across 6 phases.**

---

## 6. Verification Badge (Design-System)

The Auctum Ledger verification mark is a **seal/folio icon** (NOT a compass
inspired icon). Brand iconography:
- Seal mark: circular foil-stamped emblem
- Folio: stacked ledger folio sheets
- Iconography replaces all "compass" brand references in `01-brand-identity.md`

---

## 7. Implementation Strategy

Single atomic git commit containing all 31 file edits. Rationale:
documentation changes are trivially reversible and should land together
for consistency. No feature flags.

### Parallelization

All 31 files are **independent** — no shared state or cross-file dependencies.
Each file is a pure text transformation (brand string replacements per the
migration table). Can be executed as 31 parallel subagent tasks via AgentSwarm.

### Subagent Task Template

Each subagent receives:
1. The migration table (above)
2. The specific file path
3. A mandate: replace ALL old brand references with new ones, preserve
   the preserved items, maintain markdown structure.

After all subagents complete, a final sweep agent runs grep to verify:
- Zero remaining `\bGreensheet\b` (except in this spec's migration table)
- Zero remaining `GS-GEN-`, `GS-CAT-`, `GS-CMP-`, `GS-CRM-`, `GS-ANL-`, `GS-REF-`, `GS-RVR-`
- Zero remaining `COF-00[1-5]` / `cof-00[1-5]`
- Zero remaining `--gs-` / `greensheet:*` / `api.greensheet.io` / `auth.greensheet.io`
- Zero remaining `Fraunces` / `Archivo` / `IBM Plex Mono` font references
- Zero remaining `Compass Navy` / `Constellation Teal` / `Core Gold` palette names (in brand contexts; `compass` easing and `Compass & Cup` roaster name preserved)

---

## 8. Scope Exclusions

Explicitly out of scope for this specification:

- App source code (already rebranded in Phase 1)
- The existing `2025-01-23-auctum-ledger-rebrand-design.md` spec itself — it
  contains old values as "before" migration references, which is intentional
  and should not be changed
- `app/src/data/spaces.ts` — "Compass & Cup" roaster name (not brand identity)
- `app/src/lib/ai-persist-storage.ts` — `odasi-ai-v1` salt (internal, non-brand)