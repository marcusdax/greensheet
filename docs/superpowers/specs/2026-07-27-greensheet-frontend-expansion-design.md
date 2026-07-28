# Greensheet Frontend Expansion Design

**Date:** 2026-07-27  
**Scope:** Expand the existing `app/` demo frontend into a runnable, interactive surface that exposes every documented public REST capability from the engineering and marketing specs.  
**Approach:** Shared in-memory mock API + domain Zustand stores + per-subsystem pages and forms.

---

## 1. Goal

Turn the current demo frontend into a comprehensive single-page application that demonstrates the full Greensheet platform surface:

- CRM (roasters, contacts, interventions, churn risk, LTV)
- Campaigns (COF-001…005 nurture engine, A/B analytics, enable/disable/retire)
- Automation Rules (cross-campaign rule registry and editor)
- Catalog (coffee lots, inventory reservations)
- Sample Kits (request, track, feedback)
- Orders (lifecycle, line items, idempotency)
- Webhooks (subscriptions, delivery log)
- Analytics (LTV, churn, cohorts, funnel, viral coefficient, inventory forecast)

The backend runtime (Kafka, Temporal, Stripe, Postgres, MSK) is **out of scope**; the frontend simulates the documented OpenAPI contract via an in-memory mock service.

---

## 2. Architecture

### 2.1 Stack (existing)

- Vite + React 19 + TypeScript 5
- Tailwind CSS 3 with the existing Greensheet design tokens
- Zustand 5 for state management
- React Router 6 for routing
- i18next with the existing locale files
- Recharts for analytics charts
- lucide-react for icons

### 2.2 Additions

- `react-hook-form` + `zod` for form handling and validation.
- Vitest for unit tests (already a dev-time best practice; use the existing Vite test runner if configured, otherwise add `vitest`).

### 2.3 Directory Structure

```
app/src/
  api/
    client.ts            # typed fetch-style mock client
    db.ts                # in-memory seeded database
    problems.ts          # RFC 9457 problem helpers
    schemas.ts           # Zod schemas derived from OpenAPI
  types/
    api.ts               # TypeScript interfaces for all API entities
  stores/
    root-store.ts        # existing; extended with new domain slices
    slices/
      crm-slice.ts
      campaigns-slice.ts
      catalog-slice.ts
      samples-slice.ts
      orders-slice.ts
      rules-slice.ts
      webhooks-slice.ts
      analytics-slice.ts
      ui-slice.ts        # existing; extended toast/drawer stack
  components/
    ui/                  # reusable form primitives, table, pagination, drawer
    forms/               # domain form components
  pages/
    NavigatorPage.tsx    # existing
    CatalogPage.tsx      # existing, extended with CRUD
    CampaignsPage.tsx    # existing, extended with designer
    RoastersPage.tsx     # existing, extended with CRUD + interventions
    AnalyticsPage.tsx    # existing, extended with derived data
    SampleKitsPage.tsx   # new
    OrdersPage.tsx       # new
    AutomationRulesPage.tsx # new
    WebhooksPage.tsx     # new
  hooks/
    use-toast.ts
    use-confirm.ts
```

### 2.4 Mock API Client

`src/api/client.ts` exposes functions grouped by context:

```ts
export const api = {
  roasters: { list, get, create, patch, delete, ltv, churnRisk },
  campaigns: { list, get, create, patch, halt, performance },
  rules: { list, get, create, patch, delete },
  catalog: { list, get, create, patch, reserve },
  sampleKits: { list, get, create, feedback },
  orders: { list, get, create, process, ship, deliver, cancel, return },
  webhooks: { list, get, create, patch, delete, deliveries },
  analytics: { cohorts, ltv, churn, funnel, viral, forecast },
};
```

Each function returns a `Promise<ApiResult<T>>` where:

```ts
type ApiResult<T> = { data: T; problem?: never } | { data?: never; problem: Problem };
```

The client enforces:

- Cursor pagination (`limit`, `cursor`, `page` envelope).
- `Idempotency-Key` generation and replay for mutating endpoints.
- RFC 9457 problem codes (`GS-GEN-1000`, `GS-CRM-1001`, `GS-CAT-1001`, etc.).
- Service-account and OAuth scopes are mocked; all requests succeed authorization.

### 2.5 In-Memory Database

`src/api/db.ts` seeds typed records for all contexts. It uses the documented schemas exactly:

- `Roaster` with `segment`, `status`, `churnRiskScore`, `ltvCents`, `cacCents`, `paybackMonths`, `contacts`.
- `Campaign` with `slug`, `status`, `version`, `ruleCodes`, `targetAudience`.
- `AutomationRule` with `ruleCode` (`COF-001`…`COF-005`), `triggerEvent`, `conditionsJson`, `actions`.
- `CoffeeLot` with `pricePerLbCents`, `costPerLbCents`, `availableQuantityLbs`, `esgScore`, `logisticsScore`, `certifications`, `sensoryProfile`, `flavorNotes`.
- `SampleKit` with `status`, `lots` snapshots, `trackingNumber`, `carrier`.
- `Order` with `lineItems`, `finalTotalCents`, status lifecycle.
- `WebhookSubscription` with `url`, `events`, `status`, `signingSecret` (shown once).

Reservations and orders decrement lot availability; cancellations and returns restore it.

---

## 3. Routing & Navigation

Extend the sidebar menu groups in `AppLayout.tsx`:

```
SOURCE
  Navigator
  Catalog
  Reservations

ENGAGE
  Campaigns
  Automation Rules

RELATIONSHIPS
  Roasters
  Sample Kits
  Orders

INTELLIGENCE
  Analytics
  Webhooks
```

Routes remain under `/:locale/<section>` and use the existing locale detection and i18n setup.

---

## 4. Subsystem Pages

### 4.1 CRM — Roasters

- **Roasters list:** sortable/filterable table with `status`, `segment`, `churnRiskScore`, `ltvCents`, `cacCents`, `paybackMonths`, `lastActivityAt`.
- **Add/Edit roaster:** form with primary contact, consent, UTM attribution, referral code.
- **Roaster detail:** KPI cards, churn-risk banner (≥ 0.7), intervention timeline, LTV snapshot, record engagement.
- **Intervention log:** add intervention (type: `email_campaign`, `sales_call`, `discount_offer`, `survey`), outcome, notes.
- **Anonymize:** GDPR-style delete that clears PII but keeps financial facts.

### 4.2 Campaigns

- **Campaign list:** status filter, create campaign, retire campaign.
- **Campaign designer:** edit name/description, target audience segments, activate/pause.
- **Rule stepper:** visual stepper for COF-001…005 with trigger event, condition JSON, actions.
- **A/B performance:** existing Bayesian A/B table and charts, but driven by mock campaign data.
- **Enable/disable:** toggle campaign status and emit `campaigns.activated` / `campaigns.halted` in the mock event log.

### 4.3 Automation Rules

- **Rule registry:** list all rules, filter by trigger event (`sample_kit.delivered`, `feedback.submitted`, `campaigns.link_clicked`, `order.created`, `crm.churn_risk_detected`).
- **Rule editor:** create/edit `ruleCode`, `triggerEvent`, `conditionsJson` (JSON editor), `actions` (SEND_TEMPLATE, EXECUTE_CAMPAIGN_HALT, UPDATE_CRM_LIFECYCLE, CREATE_CRM_TASK, ADD_SUPPRESSION).
- **Rule lifecycle:** patch status `armed` / `paused` / `retired`; soft delete.

### 4.4 Catalog

- **Lots table:** existing table, extended with Add/Edit lot, retire lot, price change with reason.
- **Reserve inventory:** per-lot reservation form with `quantityLbs` and `orderId`, enforcing `availableQuantityLbs >= 0` and returning `GS-CAT-1001` on insufficient inventory.
- **Lot detail:** drawer with ESG, logistics, sensory profile, flavor notes, certification badges.

### 4.5 Sample Kits

- **Kit list:** statuses `requested`, `assembling`, `shipped`, `delivered`, `feedback_pending`, `feedback_received`, `exception`.
- **Request kit:** form with `roasterId`, `lotIds` (snapshot), shipping address.
- **Track kit:** status timeline with carrier and tracking number.
- **Submit feedback:** public-style form with `feedbackToken`, `rating`, `notes`, `lotRatings`.

### 4.6 Orders

- **Order list:** status filter, pagination.
- **Create order:** form with idempotency key, line items, multi-lot support; computes `finalTotalCents`.
- **Order detail:** lifecycle actions (process, ship, deliver, cancel, return).
- **Saga log:** visual timeline of `order.created` → `catalog.inventory_reserved` → `billing.payment_authorized`/`payment_failed` → `order.processed`/`order.cancelled`.

### 4.7 Webhooks

- **Subscriptions:** list/create/update/delete webhook subscriptions.
- **Challenge simulation:** create call includes a `challenge` echo requirement (simulated by the client).
- **Secret reveal:** signing secret shown once after creation.
- **Delivery log:** attempts, status, latency, next attempt.

### 4.8 Analytics

- Keep existing charts and add derived data from the mock DB:
  - Cohort retention table from roaster/order history.
  - LTV:CAC scatter from roaster records.
  - Churn survival curve from risk scores.
  - Inventory forecast from lot depletion.
  - Viral coefficient from referral codes/clicks/attributions.
  - Campaign funnel from campaign execution logs.

---

## 5. Forms & Validation

- Use `react-hook-form` with `zod` resolvers.
- Reusable primitives: `InputField`, `SelectField`, `TextAreaField`, `CheckboxField`, `CurrencyField`, `NumberField`, `JsonField` (for `conditionsJson`), `MultiSelect` (for `lotIds`, `events`).
- Validation mirrors the OpenAPI constraints: `ruleCode` pattern `^COF-00[1-9]$`, `pricePerLbCents > 0`, `cupScore` 0–100, `churnRiskScore` 0–1, etc.
- Inline field errors from `problem.errors[]` are mapped back to form fields.

---

## 6. Error Handling & Idempotency

- Mutating API calls generate a fresh `crypto.randomUUID()` `Idempotency-Key` and replay the stored response on duplicate key + same payload.
- Different payload with same key returns `GS-GEN-1003`.
- Missing key on required endpoints returns `GS-GEN-1004` (simulated in the client).
- Global toast stack shows `problem.title` / `problem.detail` on failure and success messages on mutations.
- Error boundary remains and clears persisted store on fatal errors.

---

## 7. State Management

- Domain slices hold `data`, `loading`, `error`, and `lastCursor`.
- Pages call slice actions on mount; slices call the API client.
- Optimistic update for inventory reservations: decrement available quantity immediately, roll back on `GS-CAT-1001`.
- Existing sourcing/selection/ui slices remain unchanged except for extending `ui-slice` with a toast/drawer stack.

---

## 8. Testing

- `src/api/__tests__/client.test.ts` — idempotency, pagination, CRUD, problem codes, reservation failures.
- `src/stores/__tests__/*-slice.test.ts` — slice actions and state transitions.
- `src/components/__tests__/*-form.test.tsx` — form validation and submission smoke tests (using `@testing-library/react` if added; otherwise Vitest + React Testing Library).
- `npm run build` and `npm run lint` must pass.

---

## 9. Success Criteria

- All documented public REST endpoints are reachable from the UI via the mock API.
- A new campaign can be created, rules added, and the campaign activated from the Campaigns page.
- Full CRM capabilities: add roaster, edit lifecycle, log interventions, view LTV/churn risk, anonymize.
- The app builds, lints, and runs with `npm run dev` without errors.
- `oxlint` and TypeScript strict checks pass.

---

## 10. Out of Scope

- Real backend integration, Kafka/Temporal/Stripe/Postgres, authentication, RBAC enforcement, real email/SMS delivery, CloudEvents wire format, and CI/CD pipelines.
- Those are represented as data, labels, and mock responses only.
