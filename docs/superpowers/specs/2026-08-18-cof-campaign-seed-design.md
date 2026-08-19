# COF-001 → COF-005 Campaign Seed Data — Design

## Goal

Replace the placeholder campaign/rule seed data in the Greensheet app with the complete COF-001 → COF-005 nurture-engine definitions from `marketing/02-cof-campaign-expansion.md`, so the existing CampaignsPage and automation-rule layer display real campaign definitions, templates, merge tokens, and A/B variants.

## Scope

**In scope:**
- Add marketing-specific types (`MarketingTemplate`, `CampaignToken`).
- Add a canonical merge-token registry and a template library covering every email/SMS touch in COF-001..005.
- Seed `db.campaigns`, `db.rules`, and `db.templates` with accurate COF data.
- Update `api.campaigns.performance` to return campaign-specific metrics.
- Update `CampaignsPage` mock A/B analytics to derive from the seeded templates.
- Update affected tests.

**Out of scope:**
- Public landing pages (`/kits/claim`, `/feedback`, `/shortlist`, `/second-cup`, `/reorder`).
- Real email/SMS delivery or orchestrator execution.
- Bayesian runtime engine or trigger evaluation.

## Architecture

The app currently uses an in-memory mock DB (`app/src/api/db.ts`) seeded at startup. Campaigns, rules, and (after this change) templates are read by the existing Zustand store and rendered by `CampaignsPage`.

```
marketing/02-cof-campaign-expansion.md
        │
        ▼
app/src/types/marketing.ts          (new types)
app/src/api/marketing-data.ts       (tokens + templates)
        │
        ▼
app/src/api/db.ts                   (seed campaigns, rules, templates)
        │
        ▼
app/src/api/client.ts               (per-campaign performance)
        │
        ▼
app/src/pages/CampaignsPage.tsx     (derive A/B mock from seeded data)
```

## File changes

| File | Change |
|------|--------|
| `app/src/types/marketing.ts` | New types: `MarketingTemplate`, `CampaignToken`, `CampaignVariantDef`. |
| `app/src/api/marketing-data.ts` | Constants `CAMPAIGN_TOKENS` (18 canonical tokens from §0.2 plus 6 extended copy tokens) and `MARKETING_TEMPLATES` (all 12 COF email/SMS templates with A/B subjects and body copy). |
| `app/src/api/db.ts` | Replace placeholder `db.campaigns` and `db.rules`; add a runtime `db.templates` array seeded from `marketing-data.ts` (no API schema change). |
| `app/src/api/client.ts` | Update `api.campaigns.performance` to return metrics that match each COF campaign's primary metric and funnel. |
| `app/src/pages/CampaignsPage.tsx` | Replace hard-coded `CAMPAIGN_RULES_MOCK` with a helper that builds subject variants and A/B data from the seeded templates. |
| `app/src/stores/__tests__/campaigns-slice.test.ts` | Update assertions that depend on old seed campaign/rule names or counts. |

## Campaign seed definitions

### COF-001 — First Crack
- **Trigger:** `lead.qualified` with `lead_score_min: 55`
- **Audience:** `micro`, `boutique`
- **Actions:**
  1. Send `COF-001-E1` email immediately (A/B subject).
  2. Send `COF-001-E2` email after 4,320 min (3 days) if unopened.
  3. Send `COF-001-S1` SMS after 7,200 min (5 days) if opened but no kit request.
  4. Update CRM lifecycle to `kit_offered`.
  5. Halt on `sample_kit.requested`, `user.unsubscribed`, or `order.created`.

### COF-002 — The Cupping
- **Trigger:** `sample_kit.delivered` + 4 days
- **Actions:**
  1. Send `COF-002-E1` email.
  2. Send `COF-002-S1` SMS after 4,320 min (3 days) if no feedback.
  3. Update lifecycle to `kit_cupping_window`.
  4. Halt on `feedback.submitted`, `order.created`, or `user.unsubscribed`; route to COF-003 or COF-005.

### COF-003 — The Shortlist
- **Trigger:** `feedback.submitted`
- **Actions:**
  1. Send `COF-003-E1` email after 120 min (2 hours), branching on feedback valence.
  2. Send `COF-003-E2` email after 7,200 min (5 days) if no order.
  3. Send `COF-003-S1` SMS after 14,400 min (10 days) if no order.
  4. Update lifecycle to `shortlist_presented`.
  5. Halt on `order.created` or `user.unsubscribed`; route to COF-005.

### COF-004 — Second Cup
- **Trigger:** `sample_kit.delivered` + 9 days, no feedback, no order
- **Actions:**
  1. Send `COF-004-E1` email.
  2. Send `COF-004-S1` SMS after 7,200 min (5 days) if no structured response.
  3. Schedule exit to quarterly newsletter at day 21 with lead-score decay.
  4. Halt on `feedback.submitted`, `order.created`, `structured_response.logged`, or `user.unsubscribed`; route to COF-003 or COF-005.

### COF-005 — The Regular
- **Trigger:** `order.delivered` + 14 days, first order
- **Actions:**
  1. Send `COF-005-E1` referral email.
  2. Send `COF-005-E2` reorder email after 44,640 min (31 days) if no reorder.
  3. Send `COF-005-S1` SMS after 54,720 min (38 days) if no reorder and previous click.
  4. Update lifecycle to `first_order_active`.
  5. Halt on `order.created` or `user.unsubscribed`.

## Schema mapping notes

The marketing spec uses `SEND_EMAIL` / `SEND_SMS` action types and rule IDs such as `COF-001-R1`. The app's existing `RuleActionType` enum only defines `SEND_TEMPLATE`, plus `UPDATE_CRM_LIFECYCLE` and `EXECUTE_CAMPAIGN_HALT`. To keep seed data compatible with the existing API/types without expanding the runtime schema, rule actions will:
- Use `SEND_TEMPLATE` with `channel: 'email'` or `channel: 'sms'` for all sends.
- Store `ab_test_id` and `fire_if` inside the action `payload`.
- Keep `ruleCode` values as `COF-001` … `COF-005` to match the existing `^COF-00[1-9]$` validation and the campaign codes.

## Template data

Every template includes:
- `id` (matches rule actions)
- `campaignId`, `touchpoint`, `channel`
- `subjectA`, `subjectB`
- `body` (full copy with merge tokens)
- `mergeTokens` (array of token strings used)
- `metrics` (baseline/target for display)

## Merge-token registry

`CAMPAIGN_TOKENS` contains the 18 canonical tokens from §0.2 plus the 6 extended tokens that appear in copy (`{feedback_highlight}`, `{bags_sold_since}`, `{days_left_on_lock}`, `{peer_count}`, `{first_order_lbs}`, `{days_since_order}`). Each token stores:
- `token` — e.g. `{first_name}`
- `sourceField` — e.g. `users.first_name` or `template-derived`
- `tooltip` — UI description

## Performance API

`api.campaigns.performance(id)` returns a `CampaignPerformance` shaped to the campaign's primary metric:
- COF-001: funnel `kitSent → opened → clicked → requested`
- COF-002: funnel `kitSent → opened → feedbackSubmitted`
- COF-003: funnel `feedbackSubmitted → opened → ordered`
- COF-004: funnel `kitSent → opened → responded`
- COF-005: funnel `firstOrders → referralSent → reordered`

Variants A/B are derived from the seeded templates.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Existing tests assert on old seed names/counts | Update tests to match new seed data. |
| `RuleForm` ruleCode regex limits to `COF-00[1-9]` | New rule codes stay within this pattern. |
| Large markdown copy in code | Store templates in a dedicated data file, not inline in components. |

## Success criteria

- `npm run test:run` passes.
- CampaignsPage loads and shows five COF campaigns with correct names, triggers, and rule sequences.
- Selecting each campaign displays subject A/B variants and funnel metrics that match the marketing spec.
- No placeholders or TODOs remain in the seeded data.
