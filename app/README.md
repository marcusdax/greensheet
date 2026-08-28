# Greensheet Platform — Working Application

A runnable full-stack implementation of the Greensheet expansion-pack specs (`../engineering/*.md`), built with React 19 + TypeScript + Vite + Tailwind + shadcn/ui on the front end, and Hono + tRPC 11 + Drizzle ORM (MySQL) on the back end.

## Feature ↔ Spec Mapping

| Feature (working) | Spec source |
|---|---|
| Catalog: lots, SCA cup-score badges, spot inventory, price changes, retire | `01-domain-model` §4.1, `02-openapi-contract` `/v1/catalog/lots` |
| CRM: roaster accounts, lifecycle stages, LTV/CAC, churn hazard (0.70 threshold), interventions | `01-domain-model` §4.2, `04-database-evolution` |
| Sample kits: state machine (requested→assembling→shipped→delivered→feedback), max 2 active kits, lot snapshots locked at assembly | `01-domain-model` §4.4 |
| Campaigns: COF-001…005 rule engine, arm/disarm, per-send dispatch ledger | `01-domain-model` §4.3, `../marketing/02-cof-campaign-expansion.md` |
| Orders: idempotent `CreateOrder`, atomic reservation, saga compensation on cancel (reservation released), LTV recalculation on delivery | `01-domain-model` §4.5 |
| Domain event outbox: every mutation emits its canonical event (`sample_kit.delivered`, `feedback.submitted`, `order.created`, …) into a queryable log | `01-domain-model` §6, `03-event-driven-pipeline` |
| Analytics dashboard: KPIs, campaign funnel, lifecycle distribution, churn watchlist, live event stream | `01-domain-model` §4.6 |

## Canonical conventions preserved

- Money is integer cents at rest (`*_cents`), dollars only at the presentation boundary.
- Event strings are byte-identical to the marketing schema contract (`sample_kit.delivered`, `feedback.submitted`).
- Automation actions: `SEND_EMAIL`, `SEND_SMS`, `UPDATE_CRM_LIFECYCLE`, `EXECUTE_CAMPAIGN_HALT`.
- Merge tags rendered by the rule engine: `{roaster_name}`, `{origin}`, `{varietal}`, `{process_method}`, `{sca_cup_score}`, `{price_per_lb}`.
- Economics: blended CAC $378 (referral CAC $196 via `GIVEKIT-`), churn hazard threshold 0.70.
- Error model: `GS-CAT-1001 InsufficientInventory`, `GS-SMP-1001/1003/1004/1005`, `GS-ORD-1001`, etc.

## Run

```bash
npm install
npm run db:push     # sync schema (requires DATABASE_URL in .env)
npx tsx db/seed.ts  # 8 lots, 5 roasters, campaign cof-nurture-2025 + COF-001…005
npm run dev         # http://localhost:3000
```

## Verified flows (e2e)

1. Request kit → deliver → **COF-001** Touch-1 email dispatched with rendered tokens.
2. Feedback rating 5 → **COF-002** pricing-sheet email (per-lot snapshot pricing).
3. Feedback rating 2 → **COF-003** lifecycle → `needs_attention`, churn risk ≥ 0.72, consultative SMS, sales-call intervention opened.
4. First order → inventory reserved atomically → **COF-005** nurture halted + conversion recorded.
5. Re-submitting `CreateOrder` with the same idempotency key returns the original order (no double charge).
6. Cancel releases the reservation back to the lot (`catalog.reservation_released`).
7. Delivery recalculates discounted LTV and writes back to the roaster record.

*An ODASI Technologies product — Navigate Your Reality. Own Your Journey.*
