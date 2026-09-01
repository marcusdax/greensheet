# Auctum Ledger — Verified, From Origin

The Auctum Ledger is the verified B2B distribution platform of the Auctum ecosystem (formerly Greensheet): the marketing, CRM, and transaction layer for specialty green coffee, connecting importers/exporters with roasters around verified, lot-level data. This repository contains the comprehensive expansion layer produced by a four-expert swarm (engineering, design, growth, localization), extending the base implementation architecture into a production-grade ecosystem.

## What's New

- Rebranded from "Greensheet" to "Auctum Ledger" and consolidated brand guidance.
- Expanded the repository with production-grade engineering docs: OpenAPI contracts, event-driven pipeline (Kafka/CloudEvents/Avro), outbox pattern, and telemetry/database evolution.
- Added security & compliance guidance (OIDC/RBAC, SOC 2, GDPR/CCPA) and a testing/chaos CI strategy.
- Introduced a full design system: design tokens, component library, and production-ready email templates.
- Published marketing playbooks, referral & churn playbooks, and a video/content production bible.
- Internationalization support added for en-US, zh-CN, es-MX, pt-BR with locale validation scripts and an i18n audit CI.

These highlights align README with the new architecture, operational, and localization work now present in the repo.

## Structure

```text
engineering/        Systems & software architecture expansion
  01-domain-model-event-storming.md   Bounded contexts, domain events, policies (Mermaid)
  02-openapi-contract.md              OpenAPI 3.1 public API, webhooks, idempotency, GS-* error model
  03-event-driven-pipeline.md         Kafka topology, CloudEvents/Avro, outbox pattern
  04-database-evolution.md            TimescaleDB telemetry, referral + churn + i18n migrations
  05-state-management-zustand.md      useReducer→Zustand migration, React Query integration
  06-testing-chaos-ci.md              Test pyramid, Pact, chaos experiments, GitHub Actions
  07-security-compliance.md           OIDC/RBAC, SOC 2, GDPR/CCPA, audit ledger

design-system/      Brand identity & design system (Auctum master brand)
  01-brand-identity.md                The Auctum seal, co-branding rules
  02-design-tokens.md                 170-token W3C DTCG tokens.json, Tailwind config, WCAG-annotated
  03-component-library.md             Buttons, lot cards, cup-score badges, tables, charts
  04-email-campaign-visual-system.md  COF email visual system + 2 production HTML emails
  05-ui-implementation-prompt.md      Implementation-ready React build prompt

marketing/          Growth architecture & playbooks
  01-growth-architecture.md           GTM system, pricing, LTV:CAC model, north-star metrics
  02-cof-campaign-expansion.md        Full COF-001–005 campaigns: copy, Bayesian A/B rules, automation JSON
  03-referral-engine-playbook.md      "Give a Kit, Get a Bag" viral engine + fraud stack
  04-churn-intervention-playbook.md   Hazard tiers, intervention ladder, save-offer economics
  05-video-content-ecosystem.md       Anchor series scripts, cutdown matrix, perf framework
  06-production-bible.md              Style frames, sonic branding, B-roll bank, voice guide

localization/       International expansion (en-US / zh-CN / es-MX / pt-BR)
  01-i18n-architecture.md             react-i18next wiring, routing, namespaces, SEO
  02-locale-files/                    Four parity-checked locale JSONs (1,036 keys)
  03-campaign-localization-playbook.md Per-market COF adaptation + compliance (PIPL/LGPD/LFPDPPP)
  04-translation-pipeline.md          TM/glossary ops, AI+human review workflow
  05-i18n-audit-ci.md                 CI parity/placeholder validation
  scripts/                            Locale validators & audit tooling
```

## Canonical conventions

- Campaign IDs: COF-001–005 · Events: `sample_kit.delivered`, `feedback.submitted`
- Automation actions: `SEND_EMAIL`, `SEND_SMS`, `UPDATE_CRM_LIFECYCLE`, `EXECUTE_CAMPAIGN_HALT`
- Merge tags (byte-identical across locales): `{sca_cup_score}`, `{process_method}`, `{origin}`, `{varietal}`, `{price_per_lb}`, …
- Economics: blended CAC $378 (cap $500) · referral CAC ≤ $200 · churn hazard threshold 0.70 · discount rate 10%
- Brand: "Auctum" and "Auctum Ledger" are never translated; master brand Auctum.

*Auctum Ledger is a product of Auctum (legacy entity: ODASI Technologies, Inc.).*

**Auctum. Value is co-created, not extracted.**
