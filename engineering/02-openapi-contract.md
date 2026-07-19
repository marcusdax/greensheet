# 02 — Public REST API: OpenAPI 3.1 Contract

> **Extends:** Base Doc §V (Backend Services & API Architecture), §I.3 (Idempotency for Financial Operations), and the marketing schema (campaigns/automation tables).
> **Scope:** the public REST surface for the bounded contexts defined in `01-domain-model-event-storming.md`: Roasters (CRM), Catalog/Lots, Campaigns (COF-001–005), Sample Kits, Automation Rules, and Webhooks. The full machine-readable contract is embedded below and is the single source of truth for client SDK generation, Pact consumer tests (`06-testing-chaos-ci.md`), and the developer portal.

---

## 1. Versioning Strategy

1. **URI major versioning** — every path is prefixed `/v{n}`. A new major version is introduced only for **breaking changes** (removing a field, changing a field's type/meaning, tightening validation, changing error semantics).
2. **Additive changes are non-breaking** and ship in the current version: new optional request fields, new response fields, new enum values **only where documented as extensible** (`x-extensible-enum`), new endpoints.
3. **Sunset policy** — a deprecated version returns `Sunset: <HTTP-date>` and `Deprecation: <HTTP-date>` response headers (RFC 8594 / RFC 9745) for **12 months** before retirement, plus a `Link: <…/migration-guide>; rel="deprecation"` header.
4. **Media-type stability** — `application/json` only. Problem responses use `application/problem+json` (RFC 9457).
5. **Contract enforcement** — the YAML below is linted in CI (`vacuum` + `oasdiff` breaking-change detector) and drives Pact provider verification (see `06-testing-chaos-ci.md` §6).

## 2. Idempotency

All mutating endpoints that create financial or dispatch side-effects (`POST /v1/roasters`, `POST /v1/catalog/lots/{lotId}/reservations`, `POST /v1/sample-kits`, `POST /v1/campaigns`, `POST /v1/automation-rules`) require the `Idempotency-Key` header (Base Doc §I.3, Redis-TTL implementation):

- Key format: opaque string, 16–128 chars (UUIDv7 recommended for time-ordered debugging).
- Server stores `(key, account_scope) → response` for **24h** (Redis `SET … NX EX 86400`, cf. `CacheService.acquireLock`, Base Doc §IX.9.2).
- Replay with the **same key + same body** → `200 OK` with the original response body and header `Idempotent-Replay: true`.
- Replay with the **same key + different body** → `422` + problem `GS-GEN-1003` (`idempotency_key_conflict`).
- Missing key on a required endpoint → `400` + `GS-GEN-1004`.

## 3. Error Model

Errors follow **RFC 9457 Problem Details**. Every problem carries a stable machine `code` from the catalogue below; `type` URIs dereference to human documentation.

```json
{
  "type": "https://api.greensheet.io/problems/GS-CAT-1001",
  "title": "Insufficient inventory",
  "status": 409,
  "code": "GS-CAT-1001",
  "detail": "Lot 9f2… has 320 lbs available; 500 lbs requested.",
  "instance": "/v1/catalog/lots/9f2…/reservations",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": [
    { "field": "quantityLbs", "code": "exceeds_available", "message": "Requested 500, available 320" }
  ]
}
```

**Error code catalogue (namespace: `GS-<CONTEXT>-<NNNN>`):**

| Code | HTTP | Meaning |
|---|---|---|
| `GS-GEN-1000` | 400 | `validation_failed` — schema/field validation (details in `errors[]`) |
| `GS-GEN-1001` | 401 | `unauthenticated` — missing/expired OIDC token |
| `GS-GEN-1002` | 403 | `forbidden` — RBAC denial (see `07-security-compliance.md` §2) |
| `GS-GEN-1003` | 422 | `idempotency_key_conflict` — key reused with different payload |
| `GS-GEN-1004` | 400 | `idempotency_key_required` |
| `GS-GEN-1005` | 404 | `resource_not_found` |
| `GS-GEN-1006` | 409 | `version_conflict` — optimistic-lock `ETag`/`If-Match` mismatch |
| `GS-GEN-1007` | 429 | `rate_limited` (see `Retry-After`, `07-security-compliance.md` §6) |
| `GS-GEN-1008` | 400 | `invalid_cursor` — pagination cursor tampered/expired |
| `GS-CRM-1001` | 409 | `roaster_already_exists` (unique on `business_registration`) |
| `GS-CRM-1002` | 422 | `roaster_anonymized` — resource is GDPR-erased, no further mutation |
| `GS-CAT-1001` | 409 | `insufficient_inventory` |
| `GS-CAT-1002` | 409 | `lot_retired` — no new reservations |
| `GS-CAT-1003` | 422 | `price_below_cost` — margin floor warning requires `confirm: true` |
| `GS-CMP-1001` | 409 | `campaign_halted` — dispatch blocked (COF-005 `EXECUTE_CAMPAIGN_HALT`) |
| `GS-CMP-1002` | 422 | `rule_condition_invalid` — `conditionsJson` failed schema validation |
| `GS-CMP-1003` | 409 | `rule_code_in_use` — COF code already bound to an active rule |
| `GS-SMP-1001` | 409 | `kit_limit_exceeded` — >2 active kits per roaster (domain invariant §01) |
| `GS-SMP-1002` | 410 | `feedback_token_expired` — one-time feedback link consumed/expired |
| `GS-WHB-1001` | 422 | `webhook_url_invalid` — HTTPS + ownership challenge failed |

## 4. Pagination, Filtering, Rate Limits

- **Cursor pagination** on all list endpoints: `?limit=1..100 (default 25)` + opaque `?cursor=` (signed, 10-min TTL). Response envelope: `{ "data": [...], "page": { "nextCursor": "…", "hasMore": true } }`.
- **Filtering** via documented query params only (no arbitrary query language); multi-value params are comma-separated (`origins=Ethiopia,Colombia`), mirroring the Navigator filters in Base Doc §IV.4.2 (`minCupScore`, `origins`, `processes`, `maxPricePerLb`).
- **Rate limiting** headers on every response: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; `429` includes `Retry-After` (token-bucket design in `07-security-compliance.md` §6).

---

## 5. The Contract (OpenAPI 3.1)

```yaml
openapi: 3.1.0
info:
  title: Greensheet Platform API
  version: 1.4.0
  summary: Public REST API for the Greensheet specialty green-coffee distribution platform.
  description: |
    Covers the CRM (roasters), Catalog (coffee lots), Campaigns (COF-001–005 nurture
    automation), Samples (kit fulfilment), and Webhook subscription surfaces.
    Domain model: see engineering/01-domain-model-event-storming.md.
    Event transport: see engineering/03-event-driven-pipeline.md.
  contact:
    name: Greensheet Platform Engineering
    url: https://developers.greensheet.io
  license:
    name: Proprietary
  x-audiences: [roaster-portal, internal-ops, integration-partners]
servers:
  - url: https://api.greensheet.io
    description: Production
  - url: https://api.staging.greensheet.io
    description: Staging (canary target, see 06-testing-chaos-ci.md)
tags:
  - name: roasters
    description: CRM context — roaster accounts, LTV and churn telemetry.
  - name: catalog
    description: Catalog context — coffee lots and inventory reservations.
  - name: campaigns
    description: Campaigns context — COF-001–005 nurture rules, performance.
  - name: sample-kits
    description: Samples context — kit request, tracking, feedback.
  - name: automation-rules
    description: Cross-campaign automation rule administration.
  - name: webhooks
    description: Outbound event subscriptions (CloudEvents JSON over HTTPS).
paths:
  # ------------------------------------------------------------------ roasters
  /v1/roasters:
    get:
      tags: [roasters]
      operationId: listRoasters
      summary: List roasters with lifecycle and risk filters.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: status
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [active, trial, dormant, churned]
          style: form
          explode: false
        - name: segment
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [micro, boutique, commercial]
          style: form
          explode: false
        - name: minChurnRisk
          in: query
          description: Return only roasters with churnRiskScore >= value (0–1).
          schema: { type: number, minimum: 0, maximum: 1 }
      responses:
        '200':
          description: Page of roasters.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Roaster' }
                  page: { $ref: '#/components/schemas/PageInfo' }
        '400': { $ref: '#/components/responses/ValidationProblem' }
        '401': { $ref: '#/components/responses/Unauthenticated' }
        '429': { $ref: '#/components/responses/RateLimited' }
      security: [{ oauth2: [roasters:read] }]
    post:
      tags: [roasters]
      operationId: createRoaster
      summary: Register a roaster (entry of the acquisition funnel).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RoasterCreate' }
      responses:
        '201':
          description: Roaster created; emits `crm.roaster_registered`.
          headers:
            Location:
              schema: { type: string, format: uri }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Roaster' }
        '200':
          description: Idempotent replay of a previous creation.
          headers:
            Idempotent-Replay:
              schema: { type: boolean, enum: [true] }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Roaster' }
        '400': { $ref: '#/components/responses/ValidationProblem' }
        '409':
          description: Duplicate business registration.
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
              example:
                type: https://api.greensheet.io/problems/GS-CRM-1001
                title: Roaster already exists
                status: 409
                code: GS-CRM-1001
      security: [{ oauth2: [roasters:write] }]
  /v1/roasters/{roasterId}:
    parameters:
      - $ref: '#/components/parameters/RoasterId'
    get:
      tags: [roasters]
      operationId: getRoaster
      summary: Fetch one roaster.
      responses:
        '200':
          description: The roaster.
          headers:
            ETag:
              description: Weak entity tag for optimistic concurrency.
              schema: { type: string }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Roaster' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [roasters:read] }]
    patch:
      tags: [roasters]
      operationId: updateRoaster
      summary: Update mutable roaster fields (optimistic-locked via If-Match).
      parameters:
        - name: If-Match
          in: header
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RoasterPatch' }
      responses:
        '200':
          description: Updated roaster.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Roaster' }
        '409':
          description: Version conflict (GS-GEN-1006).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [roasters:write] }]
  /v1/roasters/{roasterId}/ltv:
    parameters:
      - $ref: '#/components/parameters/RoasterId'
    get:
      tags: [roasters]
      operationId: getRoasterLtv
      summary: Discounted LTV snapshot (Base Doc §II.2.1 model output).
      responses:
        '200':
          description: LTV computation snapshot.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LtvSnapshot' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [roasters:read, analytics:read] }]
  /v1/roasters/{roasterId}/churn-risk:
    parameters:
      - $ref: '#/components/parameters/RoasterId'
    get:
      tags: [roasters]
      operationId: getRoasterChurnRisk
      summary: Latest churn risk score and top contributing features (Cox PH model).
      responses:
        '200':
          description: Risk score detail.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ChurnRisk' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [roasters:read, analytics:read] }]

  # ------------------------------------------------------------------ catalog
  /v1/catalog/lots:
    get:
      tags: [catalog]
      operationId: listLots
      summary: Search coffee lots (backs the Origin Navigator, Base Doc §IV.4.2).
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: origins
          in: query
          schema: { type: array, items: { type: string } }
          style: form
          explode: false
        - name: processes
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [washed, natural, honey, anaerobic]
          style: form
          explode: false
        - name: minCupScore
          in: query
          schema: { type: number, minimum: 0, maximum: 100 }
        - name: maxPricePerLb
          in: query
          description: Budget ceiling in USD/lb (converted to cents server-side).
          schema: { type: number, minimum: 0 }
        - name: certifications
          in: query
          schema:
            type: array
            items:
              type: string
              enum: [fair_trade, organic, rainforest_alliance]
          style: form
          explode: false
        - name: sort
          in: query
          schema:
            type: string
            enum: [weighted, price, cup, esg, -price, -cup, -esg]
            default: weighted
      responses:
        '200':
          description: Page of lots with normalized scoring metrics.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/CoffeeLot' }
                  page: { $ref: '#/components/schemas/PageInfo' }
        '400': { $ref: '#/components/responses/ValidationProblem' }
      security: [{ oauth2: [catalog:read] }]
    post:
      tags: [catalog]
      operationId: createLot
      summary: Register a new lot (emits `catalog.lot_registered`).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CoffeeLotCreate' }
      responses:
        '201':
          description: Lot created.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CoffeeLot' }
        '400': { $ref: '#/components/responses/ValidationProblem' }
        '422':
          description: Price below cost without confirmation (GS-CAT-1003).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [catalog:write] }]
  /v1/catalog/lots/{lotId}:
    parameters:
      - $ref: '#/components/parameters/LotId'
    get:
      tags: [catalog]
      operationId: getLot
      summary: Fetch one lot.
      responses:
        '200':
          description: The lot.
          headers:
            ETag: { schema: { type: string } }
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CoffeeLot' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [catalog:read] }]
    patch:
      tags: [catalog]
      operationId: updateLot
      summary: Update lot attributes (price changes emit `catalog.price_changed`).
      parameters:
        - name: If-Match
          in: header
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CoffeeLotPatch' }
      responses:
        '200':
          description: Updated lot.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CoffeeLot' }
        '409': { $ref: '#/components/responses/VersionConflict' }
      security: [{ oauth2: [catalog:write] }]
  /v1/catalog/lots/{lotId}/reservations:
    parameters:
      - $ref: '#/components/parameters/LotId'
    post:
      tags: [catalog]
      operationId: reserveInventory
      summary: Soft-hold inventory for checkout (30-min TTL; saga step in §01).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [quantityLbs, orderId]
              properties:
                quantityLbs: { type: integer, minimum: 1 }
                orderId: { type: string, format: uuid }
      responses:
        '201':
          description: Reservation created (emits `catalog.inventory_reserved`).
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Reservation' }
        '409':
          description: Insufficient inventory (GS-CAT-1001) or lot retired (GS-CAT-1002).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [catalog:write] }, { serviceAccount: [] }]

  # ----------------------------------------------------------------- campaigns
  /v1/campaigns:
    get:
      tags: [campaigns]
      operationId: listCampaigns
      summary: List campaigns (e.g. `cof-nurture-2025`).
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, active, paused, retired]
      responses:
        '200':
          description: Page of campaigns.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/Campaign' }
                  page: { $ref: '#/components/schemas/PageInfo' }
      security: [{ oauth2: [campaigns:read] }]
    post:
      tags: [campaigns]
      operationId: createCampaign
      summary: Create a campaign with tokens/templates container.
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CampaignCreate' }
      responses:
        '201':
          description: Campaign created.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Campaign' }
      security: [{ oauth2: [campaigns:write] }]
  /v1/campaigns/{campaignId}:
    parameters:
      - $ref: '#/components/parameters/CampaignId'
    get:
      tags: [campaigns]
      operationId: getCampaign
      summary: Fetch one campaign including compiled rule view.
      responses:
        '200':
          description: The campaign.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Campaign' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [campaigns:read] }]
    patch:
      tags: [campaigns]
      operationId: updateCampaign
      summary: Update campaign metadata or lifecycle status.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CampaignPatch' }
      responses:
        '200':
          description: Updated campaign.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Campaign' }
      security: [{ oauth2: [campaigns:write] }]
  /v1/campaigns/{campaignId}/rules:
    parameters:
      - $ref: '#/components/parameters/CampaignId'
    get:
      tags: [campaigns]
      operationId: listCampaignRules
      summary: List automation rules (COF-001…005) for a campaign.
      responses:
        '200':
          description: Rules with actions (mirrors `view_compiled_campaign_rules`).
          content:
            application/json:
              schema:
                type: object
                required: [data]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/AutomationRule' }
      security: [{ oauth2: [campaigns:read] }]
    post:
      tags: [campaigns]
      operationId: createCampaignRule
      summary: Bind a new rule to the campaign.
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AutomationRuleCreate' }
      responses:
        '201':
          description: Rule created.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
        '409':
          description: Rule code already in use (GS-CMP-1003).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
        '422':
          description: Condition JSON failed validation (GS-CMP-1002).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [campaigns:write] }]
  /v1/campaigns/{campaignId}/rules/{ruleCode}:
    parameters:
      - $ref: '#/components/parameters/CampaignId'
      - name: ruleCode
        in: path
        required: true
        description: Stable business code of the rule.
        schema:
          type: string
          pattern: '^COF-00[1-9]$'
          example: COF-001
    get:
      tags: [campaigns]
      operationId: getCampaignRule
      summary: Fetch one rule by COF code.
      responses:
        '200':
          description: The rule.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [campaigns:read] }]
    patch:
      tags: [campaigns]
      operationId: updateCampaignRule
      summary: |
        Update conditions/actions. Creates a new rule version; in-flight
        sequences pin the version they started on (hotspot §01-7.4).
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AutomationRulePatch' }
      responses:
        '200':
          description: Updated rule (new `version`).
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
      security: [{ oauth2: [campaigns:write] }]
  /v1/campaigns/{campaignId}/performance:
    parameters:
      - $ref: '#/components/parameters/CampaignId'
    get:
      tags: [campaigns]
      operationId: getCampaignPerformance
      summary: Funnel + A/B Bayesian results (backs CampaignIntelligence, §IV.4.4).
      responses:
        '200':
          description: Performance snapshot.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CampaignPerformance' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [campaigns:read, analytics:read] }]
  /v1/campaigns/{campaignId}/halt:
    parameters:
      - $ref: '#/components/parameters/CampaignId'
    post:
      tags: [campaigns]
      operationId: haltCampaign
      summary: Execute campaign halt (mirrors EXECUTE_CAMPAIGN_HALT rule action).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                reason: { type: string, maxLength: 500 }
                scope:
                  type: string
                  enum: [global, per_roaster]
                  default: global
                roasterId: { type: string, format: uuid }
      responses:
        '202':
          description: Halt accepted; emits `campaigns.halted`.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Campaign' }
      security: [{ oauth2: [campaigns:write] }]

  # --------------------------------------------------------------- sample-kits
  /v1/sample-kits:
    get:
      tags: [sample-kits]
      operationId: listSampleKits
      summary: List kits with status filter.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: status
          in: query
          schema:
            type: string
            enum: [requested, assembling, shipped, delivered, feedback_pending, feedback_received, exception]
        - name: roasterId
          in: query
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Page of kits.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/SampleKit' }
                  page: { $ref: '#/components/schemas/PageInfo' }
      security: [{ oauth2: [samples:read] }]
    post:
      tags: [sample-kits]
      operationId: createSampleKit
      summary: Request a sample kit (starts temporal.io fulfilment workflow).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SampleKitCreate' }
      responses:
        '201':
          description: Kit requested; emits `samples.kit_requested`.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SampleKit' }
        '409':
          description: Active kit limit exceeded (GS-SMP-1001).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [samples:write] }]
  /v1/sample-kits/{kitId}:
    parameters:
      - $ref: '#/components/parameters/KitId'
    get:
      tags: [sample-kits]
      operationId: getSampleKit
      summary: Fetch kit with lot snapshots and tracking.
      responses:
        '200':
          description: The kit.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SampleKit' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [samples:read] }]
  /v1/sample-kits/{kitId}/feedback:
    parameters:
      - $ref: '#/components/parameters/KitId'
    post:
      tags: [sample-kits]
      operationId: submitSampleFeedback
      summary: |
        Submit cupping feedback. Public endpoint — authentication is the signed
        one-time `feedbackToken` from the kit email (mitigates hotspot §01-7.3).
        Emits `feedback.submitted`, the trigger for COF-002/COF-003.
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SampleFeedback' }
      responses:
        '201':
          description: Feedback recorded.
          content:
            application/json:
              schema:
                type: object
                properties:
                  feedbackId: { type: string, format: uuid }
                  submittedAt: { type: string, format: date-time }
        '410':
          description: Feedback token expired/consumed (GS-SMP-1002).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }

  # ----------------------------------------------------------- automation-rules
  /v1/automation-rules:
    get:
      tags: [automation-rules]
      operationId: listAutomationRules
      summary: Cross-campaign rule registry; filter by trigger event.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: triggerEvent
          in: query
          schema:
            type: string
            enum:
              - sample_kit.delivered
              - feedback.submitted
              - campaigns.link_clicked
              - order.created
              - crm.churn_risk_detected
          x-extensible-enum: true
      responses:
        '200':
          description: Page of rules.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/AutomationRule' }
                  page: { $ref: '#/components/schemas/PageInfo' }
      security: [{ oauth2: [campaigns:read] }]
    post:
      tags: [automation-rules]
      operationId: createAutomationRule
      summary: Create a rule in any campaign (admin surface).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AutomationRuleCreate' }
      responses:
        '201':
          description: Rule created.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
        '422':
          description: Invalid conditions (GS-CMP-1002).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [campaigns:write] }]
  /v1/automation-rules/{ruleId}:
    parameters:
      - name: ruleId
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      tags: [automation-rules]
      operationId: getAutomationRule
      summary: Fetch a rule by ID.
      responses:
        '200':
          description: The rule.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [campaigns:read] }]
    patch:
      tags: [automation-rules]
      operationId: updateAutomationRule
      summary: Patch a rule (new version).
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/AutomationRulePatch' }
      responses:
        '200':
          description: Updated rule.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/AutomationRule' }
      security: [{ oauth2: [campaigns:write] }]
    delete:
      tags: [automation-rules]
      operationId: deleteAutomationRule
      summary: Retire a rule (soft delete; in-flight dispatches complete).
      responses:
        '204': { description: Retired. }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [campaigns:write] }]

  # ------------------------------------------------------------------ webhooks
  /v1/webhooks:
    get:
      tags: [webhooks]
      operationId: listWebhooks
      summary: List webhook subscriptions.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
      responses:
        '200':
          description: Page of subscriptions.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/WebhookSubscription' }
                  page: { $ref: '#/components/schemas/PageInfo' }
      security: [{ oauth2: [webhooks:manage] }]
    post:
      tags: [webhooks]
      operationId: createWebhook
      summary: |
        Create a subscription. The endpoint must pass an ownership challenge
        (POST with `challenge` field must echo it within 10s).
      parameters:
        - $ref: '#/components/parameters/IdempotencyKey'
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/WebhookSubscriptionCreate' }
      responses:
        '201':
          description: Created (signing secret returned once).
          content:
            application/json:
              schema: { $ref: '#/components/schemas/WebhookSubscriptionWithSecret' }
        '422':
          description: URL invalid or challenge failed (GS-WHB-1001).
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
      security: [{ oauth2: [webhooks:manage] }]
  /v1/webhooks/{webhookId}:
    parameters:
      - name: webhookId
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      tags: [webhooks]
      operationId: getWebhook
      summary: Fetch a subscription (secret never re-exposed).
      responses:
        '200':
          description: The subscription.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/WebhookSubscription' }
        '404': { $ref: '#/components/responses/NotFound' }
      security: [{ oauth2: [webhooks:manage] }]
    patch:
      tags: [webhooks]
      operationId: updateWebhook
      summary: Update subscribed events, URL, or pause/resume.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/WebhookSubscriptionPatch' }
      responses:
        '200':
          description: Updated subscription.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/WebhookSubscription' }
      security: [{ oauth2: [webhooks:manage] }]
    delete:
      tags: [webhooks]
      operationId: deleteWebhook
      summary: Delete a subscription.
      responses:
        '204': { description: Deleted. }
      security: [{ oauth2: [webhooks:manage] }]
  /v1/webhooks/{webhookId}/deliveries:
    parameters:
      - name: webhookId
        in: path
        required: true
        schema: { type: string, format: uuid }
    get:
      tags: [webhooks]
      operationId: listWebhookDeliveries
      summary: Delivery log with status/latency for debugging integrations.
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Cursor'
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, delivered, failed, exhausted]
      responses:
        '200':
          description: Page of deliveries.
          content:
            application/json:
              schema:
                type: object
                required: [data, page]
                properties:
                  data:
                    type: array
                    items: { $ref: '#/components/schemas/WebhookDelivery' }
                  page: { $ref: '#/components/schemas/PageInfo' }
      security: [{ oauth2: [webhooks:manage] }]
```

*(continued below — components, schemas, and outbound webhook definitions)*

## 6. Components & Schemas

```yaml
components:
  securitySchemes:
    oauth2:
      type: oauth2
      description: OIDC authorization-code + PKCE (see 07-security-compliance.md §1).
      flows:
        authorizationCode:
          authorizationUrl: https://auth.greensheet.io/oauth2/authorize
          tokenUrl: https://auth.greensheet.io/oauth2/token
          refreshUrl: https://auth.greensheet.io/oauth2/token
          scopes:
            roasters:read: Read roaster accounts
            roasters:write: Create/update roasters
            catalog:read: Read coffee lots
            catalog:write: Create/update lots and reservations
            campaigns:read: Read campaigns and rules
            campaigns:write: Manage campaigns, rules, halts
            samples:read: Read sample kits
            samples:write: Request sample kits
            analytics:read: Read LTV/churn/performance projections
            webhooks:manage: Manage webhook subscriptions
    serviceAccount:
      type: apiKey
      in: header
      name: X-GS-Service-Token
      description: mTLS-bound service token for internal saga participants.

  parameters:
    Limit:
      name: limit
      in: query
      schema: { type: integer, minimum: 1, maximum: 100, default: 25 }
    Cursor:
      name: cursor
      in: query
      schema: { type: string }
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      schema: { type: string, minLength: 16, maxLength: 128 }
    RoasterId:
      name: roasterId
      in: path
      required: true
      schema: { type: string, format: uuid }
    LotId:
      name: lotId
      in: path
      required: true
      schema: { type: string, format: uuid }
    CampaignId:
      name: campaignId
      in: path
      required: true
      schema: { type: string, format: uuid }
    KitId:
      name: kitId
      in: path
      required: true
      schema: { type: string, format: uuid }

  responses:
    ValidationProblem:
      description: Field validation failed.
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
          example:
            type: https://api.greensheet.io/problems/GS-GEN-1000
            title: Validation failed
            status: 400
            code: GS-GEN-1000
            errors:
              - { field: quantityLbs, code: too_small, message: must be >= 1 }
    Unauthenticated:
      description: Missing or expired token.
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
          example:
            type: https://api.greensheet.io/problems/GS-GEN-1001
            title: Unauthenticated
            status: 401
            code: GS-GEN-1001
    NotFound:
      description: Resource not found.
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
          example:
            type: https://api.greensheet.io/problems/GS-GEN-1005
            title: Resource not found
            status: 404
            code: GS-GEN-1005
    VersionConflict:
      description: ETag mismatch.
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
          example:
            type: https://api.greensheet.io/problems/GS-GEN-1006
            title: Version conflict
            status: 409
            code: GS-GEN-1006
    RateLimited:
      description: Rate limit exceeded.
      headers:
        Retry-After: { schema: { type: integer } }
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
          example:
            type: https://api.greensheet.io/problems/GS-GEN-1007
            title: Rate limited
            status: 429
            code: GS-GEN-1007

  schemas:
    Problem:
      type: object
      required: [type, title, status, code]
      properties:
        type: { type: string, format: uri }
        title: { type: string }
        status: { type: integer }
        code:
          type: string
          pattern: '^GS-[A-Z]{3}-[0-9]{4}$'
        detail: { type: string }
        instance: { type: string }
        traceId: { type: string }
        errors:
          type: array
          items:
            type: object
            required: [field, code, message]
            properties:
              field: { type: string }
              code: { type: string }
              message: { type: string }
    PageInfo:
      type: object
      required: [hasMore]
      properties:
        nextCursor: { type: string, nullable: true }
        hasMore: { type: boolean }

    Roaster:
      type: object
      required: [id, roasterName, status, createdAt]
      properties:
        id: { type: string, format: uuid }
        roasterName: { type: string, maxLength: 200 }
        companySize:
          type: string
          enum: [single_roaster, small_chain, regional, national]
        segment:
          type: string
          enum: [micro, boutique, commercial]
        status:
          type: string
          enum: [active, trial, dormant, churned]
        churnRiskScore: { type: number, minimum: 0, maximum: 1, nullable: true }
        ltvCents: { type: integer, nullable: true }
        cacCents: { type: integer, nullable: true }
        paybackMonths: { type: integer, nullable: true }
        daysSinceLastOrder: { type: integer, nullable: true }
        totalRevenueCents: { type: integer, nullable: true }
        totalOrders: { type: integer, nullable: true }
        billingCycle:
          type: string
          enum: [monthly, quarterly, annual]
        businessRegistration: { type: string, maxLength: 50 }
        lastActivityAt: { type: string, format: date-time, nullable: true }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    RoasterCreate:
      type: object
      required: [roasterName, primaryContact]
      properties:
        roasterName: { type: string, maxLength: 200 }
        companySize: { $ref: '#/components/schemas/Roaster/properties/companySize' }
        segment: { $ref: '#/components/schemas/Roaster/properties/segment' }
        businessRegistration: { type: string, maxLength: 50 }
        billingCycle: { $ref: '#/components/schemas/Roaster/properties/billingCycle' }
        primaryContact:
          type: object
          required: [fullName, email, marketingOptIn]
          properties:
            fullName: { type: string }
            email: { type: string, format: email }
            phone: { type: string }
            marketingOptIn: { type: boolean }
            consentLegalBasis:
              type: string
              enum: [consent, legitimate_interest, contract]
        utm:
          $ref: '#/components/schemas/UtmAttribution'
        referralCode: { type: string, maxLength: 32 }
    RoasterPatch:
      type: object
      properties:
        roasterName: { type: string, maxLength: 200 }
        segment: { $ref: '#/components/schemas/Roaster/properties/segment' }
        status: { $ref: '#/components/schemas/Roaster/properties/status' }
        billingCycle: { $ref: '#/components/schemas/Roaster/properties/billingCycle' }
    UtmAttribution:
      type: object
      properties:
        utmSource: { type: string, maxLength: 100 }
        utmMedium: { type: string, maxLength: 100 }
        utmCampaign: { type: string, maxLength: 100 }
        utmContent: { type: string, maxLength: 100 }
    LtvSnapshot:
      type: object
      properties:
        roasterId: { type: string, format: uuid }
        ltvCents: { type: integer }
        netLtvCents: { type: integer }
        cacCents: { type: integer }
        paybackMonths: { type: integer }
        discountRate: { type: number, example: 0.10 }
        computedAt: { type: string, format: date-time }
        modelVersion: { type: string, example: ltv-dcf-1.2 }
    ChurnRisk:
      type: object
      properties:
        roasterId: { type: string, format: uuid }
        riskScore: { type: number, minimum: 0, maximum: 1 }
        threshold: { type: number, example: 0.7 }
        modelVersion: { type: string, example: coxph-2025.05 }
        topFeatures:
          type: array
          items:
            type: object
            properties:
              feature: { type: string, example: days_since_last_activity }
              contribution: { type: number }
        scoredAt: { type: string, format: date-time }

    CoffeeLot:
      type: object
      required: [id, origin, pricePerLbCents, costPerLbCents, availableQuantityLbs, status]
      properties:
        id: { type: string, format: uuid }
        origin: { type: string, maxLength: 100 }
        varietal: { type: string, maxLength: 100, nullable: true }
        processingMethod:
          type: string
          enum: [washed, natural, honey, anaerobic]
          nullable: true
        elevation: { type: integer, exclusiveMinimum: 0, nullable: true }
        cupScore: { type: number, minimum: 0, maximum: 100 }
        pricePerLbCents: { type: integer, minimum: 1 }
        costPerLbCents: { type: integer, minimum: 0 }
        availableQuantityLbs: { type: integer, minimum: 0 }
        totalProductionLbs: { type: integer, minimum: 0 }
        esgScore: { type: number, minimum: 0, maximum: 1, nullable: true }
        logisticsScore: { type: number, minimum: 0, maximum: 1, nullable: true }
        carbonFootprintKgCo2PerLb: { type: number, nullable: true }
        certifications:
          type: object
          properties:
            fairTrade: { type: boolean }
            organic: { type: boolean }
            rainforestAlliance: { type: boolean }
        flavorNotes:
          type: array
          items: { type: string }
        sensoryProfile:
          type: object
          properties:
            acidity: { type: integer, minimum: 0, maximum: 10 }
            body: { type: integer, minimum: 0, maximum: 10 }
            sweetness: { type: integer, minimum: 0, maximum: 10 }
        portOfOrigin: { type: string, nullable: true }
        estimatedArrival: { type: string, format: date, nullable: true }
        status:
          type: string
          enum: [active, retired]
        metrics:
          description: Navigator normalized scores (0–100), Base Doc §IV.4.2 algorithm.
          type: object
          properties:
            costNorm: { type: integer }
            cupNorm: { type: integer }
            esgNorm: { type: integer }
            logisticsNorm: { type: integer }
            weightedScore: { type: number }
        lastUpdatedAt: { type: string, format: date-time }
    CoffeeLotCreate:
      type: object
      required: [origin, cupScore, pricePerLbCents, costPerLbCents, availableQuantityLbs, totalProductionLbs]
      properties:
        origin: { type: string }
        varietal: { type: string }
        processingMethod: { $ref: '#/components/schemas/CoffeeLot/properties/processingMethod' }
        elevation: { type: integer }
        cupScore: { type: number }
        pricePerLbCents: { type: integer }
        costPerLbCents: { type: integer }
        availableQuantityLbs: { type: integer }
        totalProductionLbs: { type: integer }
        esgScore: { type: number }
        flavorNotes: { type: array, items: { type: string } }
        confirmBelowCost:
          type: boolean
          description: Must be true when pricePerLbCents < costPerLbCents (GS-CAT-1003).
    CoffeeLotPatch:
      type: object
      properties:
        pricePerLbCents: { type: integer }
        priceChangeReason: { type: string, maxLength: 200 }
        availableQuantityLbs: { type: integer }
        status: { $ref: '#/components/schemas/CoffeeLot/properties/status' }
        esgScore: { type: number }
    Reservation:
      type: object
      properties:
        id: { type: string, format: uuid }
        lotId: { type: string, format: uuid }
        orderId: { type: string, format: uuid }
        quantityLbs: { type: integer }
        status:
          type: string
          enum: [active, consumed, released, expired]
        expiresAt: { type: string, format: date-time }
        createdAt: { type: string, format: date-time }

    Campaign:
      type: object
      required: [id, name, status, version]
      properties:
        id: { type: string, format: uuid }
        slug: { type: string, example: cof-nurture-2025 }
        name: { type: string }
        description: { type: string }
        status:
          type: string
          enum: [draft, active, paused, retired]
        version: { type: integer }
        targetAudience:
          type: object
          properties:
            segments: { type: array, items: { type: string, enum: [micro, boutique, commercial] } }
            minCupScorePreference: { type: number }
        ruleCodes:
          type: array
          items: { type: string, example: COF-001 }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    CampaignCreate:
      type: object
      required: [slug, name]
      properties:
        slug: { type: string, pattern: '^[a-z0-9-]+$' }
        name: { type: string }
        description: { type: string }
        targetAudience: { $ref: '#/components/schemas/Campaign/properties/targetAudience' }
    CampaignPatch:
      type: object
      properties:
        name: { type: string }
        status: { $ref: '#/components/schemas/Campaign/properties/status' }
        targetAudience: { $ref: '#/components/schemas/Campaign/properties/targetAudience' }
    AutomationRule:
      type: object
      required: [id, ruleCode, campaignId, triggerEvent, version, status]
      properties:
        id: { type: string, format: uuid }
        ruleCode: { type: string, pattern: '^COF-00[1-9]$', example: COF-001 }
        campaignId: { type: string, format: uuid }
        ruleName: { type: string, example: Touch 1 — Origin story after kit delivery }
        triggerEvent:
          type: string
          example: sample_kit.delivered
          x-extensible-enum: true
        conditionsJson:
          type: object
          description: JSONB condition tree (marketing schema §2); validated per trigger.
          example: { days_since_delivery: 4 }
        version: { type: integer }
        status:
          type: string
          enum: [armed, paused, retired]
        actions:
          type: array
          items: { $ref: '#/components/schemas/RuleAction' }
    AutomationRuleCreate:
      type: object
      required: [ruleCode, campaignId, ruleName, triggerEvent, actions]
      properties:
        ruleCode: { type: string, pattern: '^COF-00[1-9]$' }
        campaignId: { type: string, format: uuid }
        ruleName: { type: string }
        triggerEvent: { type: string }
        conditionsJson: { type: object }
        actions:
          type: array
          minItems: 1
          items: { $ref: '#/components/schemas/RuleAction' }
    AutomationRulePatch:
      type: object
      properties:
        conditionsJson: { type: object }
        status: { $ref: '#/components/schemas/AutomationRule/properties/status' }
        actions:
          type: array
          items: { $ref: '#/components/schemas/RuleAction' }
    RuleAction:
      type: object
      required: [actionType]
      properties:
        actionType:
          type: string
          enum: [SEND_TEMPLATE, EXECUTE_CAMPAIGN_HALT, UPDATE_CRM_LIFECYCLE, CREATE_CRM_TASK, ADD_SUPPRESSION]
        templateId: { type: string, format: uuid, nullable: true }
        channel:
          type: string
          enum: [email, sms]
        payload:
          type: object
          description: 'Action-specific params (e.g. {"lifecycle_stage": "needs_attention"}).'
        delayMinutes: { type: integer, minimum: 0 }
    CampaignPerformance:
      type: object
      properties:
        campaignId: { type: string, format: uuid }
        sent: { type: integer }
        openRate: { type: number }
        clickRate: { type: number }
        conversionRate: { type: number }
        funnel:
          type: object
          properties:
            kitSent: { type: integer }
            opened: { type: integer }
            clicked: { type: integer }
            ordered: { type: integer }
        variants:
          type: array
          items:
            type: object
            properties:
              variantName: { type: string, example: subject_variant_a }
              sampleSize: { type: integer }
              conversions: { type: integer }
              conversionRate: { type: number }
              credibleInterval95:
                type: object
                properties:
                  lower: { type: number }
                  upper: { type: number }
              probabilityBest: { type: number }
              isWinner: { type: boolean }
        computedAt: { type: string, format: date-time }

    SampleKit:
      type: object
      required: [id, roasterId, status, requestedAt]
      properties:
        id: { type: string, format: uuid }
        roasterId: { type: string, format: uuid }
        status:
          type: string
          enum: [requested, assembling, shipped, delivered, feedback_pending, feedback_received, exception]
        lots:
          type: array
          description: Snapshot of lot data at assembly time (§01 Samples invariants).
          items:
            type: object
            properties:
              lotId: { type: string, format: uuid }
              origin: { type: string }
              cupScore: { type: number }
              pricePerLbCentsAtAssembly: { type: integer }
              sampleWeightGrams: { type: integer }
        trackingNumber: { type: string, nullable: true }
        carrier: { type: string, nullable: true }
        requestedAt: { type: string, format: date-time }
        shippedAt: { type: string, format: date-time, nullable: true }
        deliveredAt: { type: string, format: date-time, nullable: true }
        temporalWorkflowId: { type: string, nullable: true }
    SampleKitCreate:
      type: object
      required: [roasterId, lotIds, shippingAddress]
      properties:
        roasterId: { type: string, format: uuid }
        lotIds:
          type: array
          minItems: 1
          maxItems: 8
          items: { type: string, format: uuid }
        shippingAddress:
          type: object
          required: [line1, city, region, postalCode, country]
          properties:
            line1: { type: string }
            line2: { type: string }
            city: { type: string }
            region: { type: string }
            postalCode: { type: string }
            country: { type: string, minLength: 2, maxLength: 2 }
    SampleFeedback:
      type: object
      required: [feedbackToken, rating]
      properties:
        feedbackToken: { type: string, minLength: 32 }
        rating: { type: integer, minimum: 1, maximum: 5 }
        notes: { type: string, maxLength: 2000 }
        lotRatings:
          type: array
          items:
            type: object
            properties:
              lotId: { type: string, format: uuid }
              rating: { type: integer, minimum: 1, maximum: 5 }
              wouldOrder: { type: boolean }
        submittedFromIp: { type: string, format: ipv4 }

    WebhookSubscription:
      type: object
      required: [id, url, events, status]
      properties:
        id: { type: string, format: uuid }
        url: { type: string, format: uri, pattern: '^https://' }
        description: { type: string }
        events:
          type: array
          minItems: 1
          items:
            type: string
            description: CloudEvents type, e.g. order.created, sample_kit.delivered
        status:
          type: string
          enum: [active, paused, failing]
        createdAt: { type: string, format: date-time }
    WebhookSubscriptionCreate:
      type: object
      required: [url, events]
      properties:
        url: { type: string, format: uri }
        description: { type: string }
        events: { $ref: '#/components/schemas/WebhookSubscription/properties/events' }
    WebhookSubscriptionPatch:
      type: object
      properties:
        url: { type: string, format: uri }
        events: { $ref: '#/components/schemas/WebhookSubscription/properties/events' }
        status:
          type: string
          enum: [active, paused]
    WebhookSubscriptionWithSecret:
      allOf:
        - $ref: '#/components/schemas/WebhookSubscription'
        - type: object
          properties:
            signingSecret:
              type: string
              description: Shown once; used for HMAC-SHA256 delivery signatures.
    WebhookDelivery:
      type: object
      properties:
        id: { type: string, format: uuid }
        eventType: { type: string }
        status:
          type: string
          enum: [pending, delivered, failed, exhausted]
        attempts: { type: integer }
        lastStatusCode: { type: integer, nullable: true }
        lastAttemptAt: { type: string, format: date-time, nullable: true }
        nextAttemptAt: { type: string, format: date-time, nullable: true }
        durationMs: { type: integer, nullable: true }
```

## 7. Outbound Webhooks (OpenAPI 3.1 `webhooks` section)

Subscribers receive **CloudEvents 1.0 in structured JSON mode** with an HMAC signature:

- `Content-Type: application/cloudevents+json`
- `X-GS-Signature-256: t=<unix_ts>,v1=<hex(hmac_sha256(secret, ts + "." + body))>` — reject if clock skew > 5 min (replay protection).
- Retry policy: exponential backoff `1m, 5m, 30m, 2h, 12h` (5 attempts), then `exhausted` and the subscription flips to `failing` (auto-pauses after 1,000 consecutive failures; alert in `07-security-compliance.md` runbook).
- Ordering: best-effort per aggregate (`Ce-Subject` = `/orders/{id}`); consumers must be idempotent on `Ce-Id`.

```yaml
webhooks:
  orderCreated:
    post:
      operationId: onOrderCreated
      summary: order.created
      requestBody:
        content:
          application/cloudevents+json:
            schema:
              type: object
              required: [specversion, id, source, type, subject, time, data]
              properties:
                specversion: { const: '1.0' }
                id: { type: string, format: uuid }
                source: { const: '//greensheet/orders' }
                type: { const: order.created }
                subject: { type: string, example: /orders/6d2f… }
                time: { type: string, format: date-time }
                data:
                  type: object
                  properties:
                    orderId: { type: string, format: uuid }
                    accountId: { type: string, format: uuid }
                    lineItems:
                      type: array
                      items:
                        type: object
                        properties:
                          lotId: { type: string, format: uuid }
                          quantityLbs: { type: integer }
                          unitPriceCents: { type: integer }
                    finalTotalCents: { type: integer }
      responses:
        '2XX': { description: Acknowledged. Any other status schedules a retry. }
  sampleKitDelivered:
    post:
      operationId: onSampleKitDelivered
      summary: sample_kit.delivered (COF-001 trigger)
      requestBody:
        content:
          application/cloudevents+json:
            schema:
              type: object
              properties:
                specversion: { const: '1.0' }
                id: { type: string, format: uuid }
                source: { const: '//greensheet/samples' }
                type: { const: sample_kit.delivered }
                subject: { type: string, example: /sample-kits/91ab… }
                time: { type: string, format: date-time }
                data:
                  type: object
                  properties:
                    kitId: { type: string, format: uuid }
                    roasterId: { type: string, format: uuid }
                    deliveredAt: { type: string, format: date-time }
                    lotIds:
                      type: array
                      items: { type: string, format: uuid }
      responses:
        '2XX': { description: Acknowledged. }
  campaignConverted:
    post:
      operationId: onCampaignConverted
      summary: campaigns.converted
      requestBody:
        content:
          application/cloudevents+json:
            schema:
              type: object
              properties:
                specversion: { const: '1.0' }
                id: { type: string, format: uuid }
                source: { const: '//greensheet/campaigns' }
                type: { const: campaigns.converted }
                data:
                  type: object
                  properties:
                    campaignId: { type: string, format: uuid }
                    ruleCode: { type: string, example: COF-004 }
                    roasterId: { type: string, format: uuid }
                    convertedOrderId: { type: string, format: uuid }
      responses:
        '2XX': { description: Acknowledged. }
  churnRiskDetected:
    post:
      operationId: onChurnRiskDetected
      summary: crm.churn_risk_detected (risk >= 0.7 threshold crossing only)
      requestBody:
        content:
          application/cloudevents+json:
            schema:
              type: object
              properties:
                specversion: { const: '1.0' }
                id: { type: string, format: uuid }
                source: { const: '//greensheet/crm' }
                type: { const: crm.churn_risk_detected }
                data:
                  type: object
                  properties:
                    roasterId: { type: string, format: uuid }
                    riskScore: { type: number }
                    modelVersion: { type: string }
      responses:
        '2XX': { description: Acknowledged. }
```

---

## 8. Contract Governance

1. **Source of truth:** this YAML lives at `api/openapi/greensheet-v1.yaml`; docs and SDKs are generated artifacts.
2. **Breaking-change gate:** CI runs `oasdiff breaking openapi-prev.yaml greensheet-v1.yaml`; a breaking diff requires a `/v2` bump (see `06-testing-chaos-ci.md` §7).
3. **Mock server:** `prism mock greensheet-v1.yaml` backs consumer-driven contract tests and partner sandboxes.
4. **Consistency checks:** CI asserts every `triggerEvent` enum value exists in the Kafka event catalogue (`03-event-driven-pipeline.md` §2) and every error `code` is registered in the error catalogue above.
