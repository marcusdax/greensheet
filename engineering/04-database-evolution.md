# 04 — Database Evolution: Migrations, TimescaleDB, Retention

> **Extends:** Base Doc §III (Database Architecture & Schema Evolution) and the marketing schema (`campaigns`, `campaign_tokens`, `marketing_templates`, `automation_rules`, `rule_actions`, `view_compiled_campaign_rules`).
> **Implements:** the marketing schema's own "Actionable Next Steps" — `campaign_execution_logs` audit ledger and role-based `GRANT`s — plus TimescaleDB telemetry, the referral engine (Base Doc §I.2), churn-intervention depth (§II.2.2), and i18n persistence.
> **Migration rules (unchanged from Base Doc §3.3):** expand-don't-alter, feature-flag gated backfills, blue/green compatible, every migration reversible. Numbering: `YYYYMMDDHHMM_<scope>__<name>.sql`, applied by `node-pg-migrate` in CI (see `06-testing-chaos-ci.md`).

---

## 1. Migration Ledger Overview

| Migration | Scope | Risk | Rollback |
|---|---|---|---|
| `202502010900_platform__extensions_schemas.sql` | extensions, schemas, updated_at trigger | none | drop schemas (empty) |
| `202502010930_telemetry__engagement_events.sql` | TimescaleDB hypertables + continuous aggregates | medium (extension enable) | drop caggs → drop tables |
| `202502021100_referral__engine.sql` | referral tables + viral views | none | drop tables |
| `202502031400_churn__interventions.sql` | risk history, playbooks, interventions v2 | low (extends `churn_interventions`) | drop new cols/tables |
| `202502041000_i18n__localization.sql` | locales, keys, translations | none | drop tables |
| `202502050915_campaigns__execution_logs.sql` | dispatch ledger + suppression | none | drop tables |
| `202502060800_platform__outbox_inbox.sql` | event outbox/inbox (`03-event-driven-pipeline.md`) | low | drop tables |
| `202502101600_platform__indexes_retention.sql` | composite indexes, retention jobs | low | drop indexes / remove jobs |
| `202502111000_platform__roles_grants.sql` | least-privilege roles | medium (app reconnect) | re-grant legacy role |

---

## 2. `202502010900_platform__extensions_schemas.sql`

```sql
-- up
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid, digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;         -- trigram search on roaster_name / origins
CREATE EXTENSION IF NOT EXISTS btree_gin;       -- compound GIN (JSONB + scalar)

CREATE SCHEMA IF NOT EXISTS telemetry;   -- timeseries (hypertables)
CREATE SCHEMA IF NOT EXISTS referral;    -- referral engine
CREATE SCHEMA IF NOT EXISTS churn;       -- retention & interventions
CREATE SCHEMA IF NOT EXISTS i18n;        -- localization
CREATE SCHEMA IF NOT EXISTS audit;       -- append-only ledgers
CREATE SCHEMA IF NOT EXISTS events;      -- outbox/inbox

-- Shared updated_at trigger (Base Doc tables rely on NOW() in app code; move to DB).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- down
-- DROP SCHEMA telemetry, referral, churn, i18n, audit, events CASCADE;
-- DROP FUNCTION public.set_updated_at();
```

---

## 3. `202502010930_telemetry__engagement_events.sql` — TimescaleDB

Extends the single `platform_metrics` hypertable (Base Doc §III.3.2) into a purpose-built **engagement telemetry** store for campaign/web/portal events feeding the churn model features (`engagements6mo`, `daysSinceLastActivity`, Base Doc §II.2.2).

```sql
-- up
-- 3.1 Raw event hypertable ---------------------------------------------------
CREATE TABLE telemetry.engagement_events (
    time            TIMESTAMPTZ   NOT NULL,
    event_id        UUID          NOT NULL DEFAULT gen_random_uuid(),
    account_id      UUID          NOT NULL,           -- FK enforced by app (hot path)
    event_type      TEXT          NOT NULL,           -- 'email.opened','portal.login','lot.viewed', ...
    source          TEXT          NOT NULL,           -- 'campaign'|'portal'|'api'|'webhook'
    campaign_id     UUID,
    dispatch_id     UUID,
    session_id      UUID,
    value           NUMERIC,                          -- optional numeric payload (e.g. dwell_ms)
    dimensions      JSONB         NOT NULL DEFAULT '{}'::jsonb,
    ingest_idem_key TEXT                                -- dedupe key from edge collectors
);

SELECT create_hypertable('telemetry.engagement_events', 'time',
        chunk_time_interval => INTERVAL '7 days',
        if_not_exists => TRUE);

-- Native dedupe guard for edge retries
CREATE UNIQUE INDEX ux_engagement_events_idem
    ON telemetry.engagement_events (ingest_idem_key, time)
    WHERE ingest_idem_key IS NOT NULL;

CREATE INDEX ix_engagement_events_account_time
    ON telemetry.engagement_events (account_id, time DESC);
CREATE INDEX ix_engagement_events_type_time
    ON telemetry.engagement_events (event_type, time DESC);
CREATE INDEX ix_engagement_events_dims_gin
    ON telemetry.engagement_events USING GIN (dimensions jsonb_path_ops);

-- Compression: raw chunks older than 14 days compress ~10x
ALTER TABLE telemetry.engagement_events SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'account_id',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('telemetry.engagement_events', INTERVAL '14 days');

-- Retention: raw events kept 13 months (see §8 policy matrix)
SELECT add_retention_policy('telemetry.engagement_events', INTERVAL '13 months');

-- 3.2 Continuous aggregates ---------------------------------------------------
-- Hourly rollups for dashboards (real-time = includes current chunk)
CREATE MATERIALIZED VIEW telemetry.engagement_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time)            AS bucket,
       account_id,
       event_type,
       count(*)                               AS event_count,
       count(DISTINCT session_id)             AS sessions
FROM telemetry.engagement_events
GROUP BY bucket, account_id, event_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry.engagement_hourly',
    start_offset => INTERVAL '7 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- Rolling 6-month engagement count per account — the churn model's engagements6mo
CREATE MATERIALIZED VIEW telemetry.engagement_6mo_daily
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 day', time) AS bucket,
       account_id,
       count(*)                   AS engagements_1d
FROM telemetry.engagement_events
WHERE event_type IN ('email.opened','email.clicked','portal.login','lot.viewed',
                     'order.placed','feedback.submitted','sample_kit.delivered')
GROUP BY bucket, account_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry.engagement_6mo_daily',
    start_offset => INTERVAL '180 days',
    end_offset   => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- Fast churn-feature query used by ChurnPredictor (Base Doc §II.2.2):
--   SELECT account_id, SUM(engagements_1d) AS engagements6mo
--     FROM telemetry.engagement_6mo_daily
--    WHERE bucket >= now() - INTERVAL '180 days'
--    GROUP BY account_id;

-- 3.3 Keep Base Doc platform_metrics, add compression + retention ------------
ALTER TABLE public.platform_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'metric_name'
);
SELECT add_compression_policy('platform_metrics', INTERVAL '30 days');
SELECT add_retention_policy('platform_metrics', INTERVAL '24 months');

-- down
-- SELECT remove_retention_policy('telemetry.engagement_events');
-- DROP MATERIALIZED VIEW telemetry.engagement_6mo_daily;
-- DROP MATERIALIZED VIEW telemetry.engagement_hourly;
-- DROP TABLE telemetry.engagement_events;
```

---

## 4. `202502021100_referral__engine.sql` — Referral Program

Implements Base Doc §I.2 "Referral Program Engine … viral coefficient tracking with UTM-aware referral attribution" and policy P-12 in `01-domain-model-event-storming.md`.

```sql
-- up
-- 4.1 Codes ------------------------------------------------------------------
CREATE TABLE referral.codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,                 -- e.g. 'ANDES-4F2K' (human-typable)
    owner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    reward_type     TEXT NOT NULL DEFAULT 'credit'
                    CHECK (reward_type IN ('credit','discount_pct','free_sample_kit')),
    reward_value_cents INT NOT NULL CHECK (reward_value_cents >= 0),
    referee_reward_cents INT NOT NULL DEFAULT 0,          -- double-sided incentive
    max_redemptions INT,                                  -- NULL = unlimited
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_referral_codes_owner ON referral.codes (owner_account_id) WHERE is_active;

-- 4.2 Click tracking (UTM-aware) ----------------------------------------------
CREATE TABLE referral.clicks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    code_id         UUID NOT NULL REFERENCES referral.codes(id) ON DELETE CASCADE,
    clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_hash         BYTEA,                                -- HMAC(ip) — privacy, see 07 doc §5
    user_agent      TEXT,
    utm_source      TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT,
    landing_path    TEXT,
    -- TimescaleDB rule: unique constraints on a hypertable must include the
    -- partitioning column (clicked_at)
    PRIMARY KEY (id, clicked_at)
);
SELECT create_hypertable('referral.clicks', 'clicked_at', if_not_exists => TRUE,
        migrate_data => TRUE);
CREATE INDEX ix_referral_clicks_code_time ON referral.clicks (code_id, clicked_at DESC);

-- 4.3 Attribution (code → new roaster) ---------------------------------------
CREATE TABLE referral.attributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id         UUID NOT NULL REFERENCES referral.codes(id) ON DELETE RESTRICT,
    referrer_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    referee_account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    attributed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    attribution_model TEXT NOT NULL DEFAULT 'last_click_30d'
                    CHECK (attribution_model IN ('last_click_30d','first_click','signup_code')),
    first_order_id  UUID REFERENCES orders(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','qualified','rewarded','fraud_flagged','expired')),
    UNIQUE (referee_account_id)                           -- one referrer per roaster
);
CREATE INDEX ix_referral_attr_referrer ON referral.attributions (referrer_account_id, status);

-- 4.4 Rewards -----------------------------------------------------------------
CREATE TABLE referral.rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribution_id  UUID NOT NULL REFERENCES referral.attributions(id) ON DELETE CASCADE,
    beneficiary_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    side            TEXT NOT NULL CHECK (side IN ('referrer','referee')),
    amount_cents    INT NOT NULL CHECK (amount_cents > 0),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    granted_at      TIMESTAMPTZ,
    granted_by_rule TEXT,                                 -- e.g. 'first_order_delivered'
    ledger_ref      TEXT,                                 -- billing credit memo id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attribution_id, side)                         -- prevents double-grant
);

-- 4.5 Viral coefficient view (K = invites/user × conversion) ------------------
CREATE VIEW referral.viral_coefficient_daily AS
WITH invites AS (
    SELECT date_trunc('day', c.created_at) AS day,
           count(*) AS codes_created
    FROM referral.codes c GROUP BY 1
),
conversions AS (
    SELECT date_trunc('day', a.attributed_at) AS day,
           count(*) FILTER (WHERE a.status IN ('qualified','rewarded')) AS qualified
    FROM referral.attributions a GROUP BY 1
),
active_roasters AS (
    SELECT date_trunc('day', day)::date AS day,
           count(*) AS actives
    FROM generate_series(now() - INTERVAL '180 days', now(), '1 day') day
    LEFT JOIN accounts a ON a.created_at <= day AND a.status <> 'churned'
    GROUP BY 1
)
SELECT i.day,
       COALESCE(i.codes_created, 0)::numeric / NULLIF(ar.actives, 0) AS invites_per_user,
       COALESCE(cv.qualified, 0)::numeric / NULLIF(i.codes_created, 0) AS conversion_rate,
       (COALESCE(i.codes_created, 0)::numeric / NULLIF(ar.actives, 0))
         * (COALESCE(cv.qualified, 0)::numeric / NULLIF(i.codes_created, 0)) AS k_factor
FROM invites i
FULL JOIN conversions cv USING (day)
JOIN active_roasters ar ON ar.day = COALESCE(i.day, cv.day);

-- down: DROP VIEW referral.viral_coefficient_daily;
--       DROP TABLE referral.rewards, referral.attributions, referral.clicks, referral.codes;
```

**Fraud guardrails (enforced in service layer + checked by nightly job):** self-referral (`referrer = referee`), same `ip_hash` on code creation & signup, velocity > 10 attributions/day/code → `fraud_flagged` and rewards withheld pending review.

---

## 5. `202502031400_churn__interventions.sql` — Retention Engine

Deepens the Base Doc `churn_interventions` table (§III.3.2) into a full intervention subsystem; risk scoring history supports the Cox PH model (§II.2.2) and KPI "Churn rate < 5% monthly" (§XI).

```sql
-- up
-- 5.1 Risk score history (model observability + threshold-crossing events) ----
CREATE TABLE churn.risk_scores (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version   TEXT NOT NULL,                        -- 'coxph-2025.05'
    risk_score      DOUBLE PRECISION NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    features        JSONB NOT NULL,                       -- feature vector snapshot
    top_drivers     JSONB,                                -- [{feature, contribution}]
    threshold       DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    crossed_threshold BOOLEAN GENERATED ALWAYS AS (risk_score >= threshold) STORED
);
SELECT create_hypertable('churn.risk_scores', 'scored_at', if_not_exists => TRUE,
        migrate_data => TRUE);
CREATE INDEX ix_risk_scores_account ON churn.risk_scores (account_id, scored_at DESC);
-- Fast "who is currently high risk" (powers GET /v1/roasters?minChurnRisk=)
CREATE INDEX ix_risk_scores_current_high
    ON churn.risk_scores (account_id, scored_at DESC)
    WHERE risk_score >= 0.7;

-- 5.2 Playbooks (reusable intervention programs) ------------------------------
CREATE TABLE churn.playbooks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                        -- 'winback-discount-10'
    description     TEXT,
    trigger_min_risk DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    trigger_segment TEXT[],                               -- NULL = all segments
    steps           JSONB NOT NULL,                       -- ordered [{action, delay_days, params}]
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.3 Interventions v2 — extend (don't alter) the Base Doc table -------------
ALTER TABLE public.churn_interventions
    ADD COLUMN IF NOT EXISTS playbook_id   UUID REFERENCES churn.playbooks(id) ON DELETE SET NULL,
    -- No FK to churn.risk_scores: hypertable unique constraints must include the
    -- partition column (scored_at); link is enforced by the scorer job instead.
    ADD COLUMN IF NOT EXISTS risk_score_id BIGINT,
    ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','in_progress','completed','abandoned')),
    ADD COLUMN IF NOT EXISTS resolved_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS discount_cents INT CHECK (discount_cents >= 0),
    ADD COLUMN IF NOT EXISTS campaign_id   UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX ix_interventions_open ON public.churn_interventions (status, detected_at)
    WHERE status IN ('open','in_progress');
CREATE INDEX ix_interventions_account ON public.churn_interventions (account_id, detected_at DESC);

-- 5.4 Step execution ledger ---------------------------------------------------
CREATE TABLE churn.intervention_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_id UUID NOT NULL REFERENCES public.churn_interventions(id) ON DELETE CASCADE,
    step_index      INT NOT NULL,
    action          TEXT NOT NULL,                        -- 'email','call','discount','survey'
    scheduled_for   TIMESTAMPTZ NOT NULL,
    executed_at     TIMESTAMPTZ,
    result          JSONB,                                -- {email_opened:true, replied:false,...}
    UNIQUE (intervention_id, step_index)
);

-- 5.4b Write-back to Base Doc account columns --------------------------------
-- The nightly scorer keeps the Base Doc §III columns in sync so existing
-- AnalyticsService queries (§5.2) keep working during the transition:
--   accounts.churn_risk_score ← latest churn.risk_scores.risk_score
--   accounts.ltv_cents        ← Analytics LTV projector (single writer, §01-7.5)
--   accounts.cac_cents        ← referral + campaign cost attribution job
--   accounts.payback_months   ← LTV projector output
CREATE OR REPLACE FUNCTION churn.sync_account_risk_scores()
RETURNS void LANGUAGE sql AS $$
  UPDATE accounts a
     SET churn_risk_score = subq.risk_score,
         last_activity_at = now()
    FROM (SELECT DISTINCT ON (account_id) account_id, risk_score
            FROM churn.risk_scores
           ORDER BY account_id, scored_at DESC) subq
   WHERE a.id = subq.account_id
     AND a.churn_risk_score IS DISTINCT FROM subq.risk_score;
$$;

-- 5.5 Effectiveness view (A/B of intervention types; feeds §XI churn KPI) -----
CREATE VIEW churn.intervention_effectiveness AS
SELECT i.intervention_type,
       count(*)                                            AS total,
       count(*) FILTER (WHERE i.outcome = 'retained')      AS retained,
       count(*) FILTER (WHERE i.outcome = 'churned')       AS churned,
       round(100.0 * count(*) FILTER (WHERE i.outcome = 'retained')
                   / NULLIF(count(*) FILTER (WHERE i.outcome IN ('retained','churned')), 0), 1)
                                                           AS save_rate_pct,
       avg(EXTRACT(EPOCH FROM (i.resolved_at - i.detected_at))/86400)::numeric(6,1)
                                                           AS avg_days_to_resolve
FROM public.churn_interventions i
GROUP BY i.intervention_type;

-- down: DROP VIEW churn.intervention_effectiveness;
--       DROP TABLE churn.intervention_steps;
--       ALTER TABLE public.churn_interventions DROP COLUMN IF EXISTS playbook_id, ...;
--       DROP TABLE churn.playbooks, churn.risk_scores;
```

---

## 6. `202502041000_i18n__localization.sql` — Localization Storage

Persisted i18n keys so that campaign templates (`marketing_templates`) and the portal UI can be localized without redeploys; template tokens (`campaign_tokens`) stay language-independent.

```sql
-- up
CREATE TABLE i18n.locales (
    code            TEXT PRIMARY KEY,                     -- BCP-47: 'en-US','es-CO','pt-BR'
    display_name    TEXT NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    fallback_code   TEXT REFERENCES i18n.locales(code)
);
-- Exactly one default locale
CREATE UNIQUE INDEX ux_locales_default ON i18n.locales ((is_default)) WHERE is_default;

CREATE TABLE i18n.namespaces (
    id              SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE                  -- 'portal','emails.cof','sms.cof'
);

CREATE TABLE i18n.keys (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    namespace_id    SMALLINT NOT NULL REFERENCES i18n.namespaces(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,                        -- 'cof001.touch1.subject'
    description     TEXT,                                 -- translator context
    max_length      INT,                                  -- SMS 160-char enforcement
    placeholders    JSONB,                                -- ["roaster_name","sca_cup_score"]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (namespace_id, key)
);

CREATE TABLE i18n.translations (
    key_id          BIGINT NOT NULL REFERENCES i18n.keys(id) ON DELETE CASCADE,
    locale_code     TEXT NOT NULL REFERENCES i18n.locales(code) ON DELETE CASCADE,
    value           TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT 'draft'
                    CHECK (state IN ('draft','in_review','published','stale')),
    translator_id   UUID REFERENCES users(id),
    machine_translated BOOLEAN NOT NULL DEFAULT FALSE,
    version         INT NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at    TIMESTAMPTZ,
    PRIMARY KEY (key_id, locale_code)
);
CREATE INDEX ix_translations_published
    ON i18n.translations (locale_code, state) WHERE state = 'published';

-- Full translation-history (SOC2 CC7.2 change tracking; see 07 doc §8)
CREATE TABLE i18n.translation_history (
    key_id          BIGINT NOT NULL,
    locale_code     TEXT NOT NULL,
    version         INT NOT NULL,
    value           TEXT NOT NULL,
    changed_by      UUID REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (key_id, locale_code, version)
);

-- Runtime resolution view: requested locale → fallback chain → default
CREATE VIEW i18n.resolved_translations AS
SELECT n.name AS namespace, k.key, l.code AS locale,
       COALESCE(t_req.value, t_fb.value, t_def.value) AS value,
       COALESCE(t_req.state, t_fb.state, t_def.state) AS state
FROM i18n.keys k
JOIN i18n.namespaces n ON n.id = k.namespace_id
CROSS JOIN i18n.locales l
LEFT JOIN i18n.translations t_req
       ON t_req.key_id = k.id AND t_req.locale_code = l.code AND t_req.state = 'published'
LEFT JOIN i18n.locales lf ON lf.code = l.fallback_code
LEFT JOIN i18n.translations t_fb
       ON t_fb.key_id = k.id AND t_fb.locale_code = lf.code AND t_fb.state = 'published'
LEFT JOIN i18n.locales ld ON ld.is_default
LEFT JOIN i18n.translations t_def
       ON t_def.key_id = k.id AND t_def.locale_code = ld.code AND t_def.state = 'published';

-- Seed: tie marketing templates into i18n (COF-001 subject, en + es)
INSERT INTO i18n.locales (code, display_name, is_enabled, is_default) VALUES
  ('en-US', 'English (US)', TRUE, TRUE),
  ('es-CO', 'Español (Colombia)', TRUE, FALSE),
  ('pt-BR', 'Português (Brasil)', FALSE, FALSE);

-- down: DROP VIEW i18n.resolved_translations; DROP TABLE i18n.translation_history,
--       i18n.translations, i18n.keys, i18n.namespaces, i18n.locales;
```

**Serving strategy:** the portal fetches a compiled bundle `GET /v1/i18n/{locale}/{namespace}.json` (built from `resolved_translations`, cached in Redis L2 per Base Doc §IX cache tiers, invalidated by a `published_at` bump); email/SMS rendering resolves at dispatch time inside the Campaigns service so tokens like `{sca_cup_score}` interpolate into localized copy.

---

## 7. `202502050915_campaigns__execution_logs.sql` — Audit Ledger & Suppression

Implements the marketing schema's recommended next step verbatim: *"a permanent, auditable ledger of every sent email/SMS, clicked token, and triggered suppression event."*

```sql
-- up
-- 7.1 Per-dispatch ledger -----------------------------------------------------
CREATE TABLE audit.campaign_execution_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id       UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    rule_id           UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
    rule_code         TEXT,                               -- denormalized 'COF-001' (survives rule delete)
    rule_version      INT,
    roaster_id        UUID NOT NULL,                      -- no FK: ledger outlives anonymization
    template_id       UUID REFERENCES marketing_templates(id) ON DELETE SET NULL,
    channel           TEXT CHECK (channel IN ('email','sms')),
    variant_name      TEXT,                               -- 'subject_variant_a'|'subject_variant_b'
    trigger_event_id  UUID,                               -- CloudEvents id lineage (03 doc §7)
    action_type       TEXT,                               -- SEND_TEMPLATE | EXECUTE_CAMPAIGN_HALT | ...
    status            TEXT NOT NULL DEFAULT 'triggered'
                      CHECK (status IN ('triggered','dispatched','delivered','bounced',
                                        'opened','clicked','suppressed','failed','halted')),
    idempotency_key   TEXT NOT NULL,                      -- dedupe: one dispatch per (rule,roaster,touchpoint)
    provider_ref      TEXT,                               -- SendGrid/Twilio message id
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    detail            JSONB NOT NULL DEFAULT '{}'::jsonb
);
SELECT create_hypertable('audit.campaign_execution_logs', 'occurred_at',
        chunk_time_interval => INTERVAL '1 month', if_not_exists => TRUE);

-- Dispatch idempotency: replayed rule triggers never double-send (03 doc §4.1)
CREATE UNIQUE INDEX ux_exec_logs_dispatch
    ON audit.campaign_execution_logs (campaign_id, rule_code, roaster_id, idempotency_key, occurred_at);
CREATE INDEX ix_exec_logs_roaster ON audit.campaign_execution_logs (roaster_id, occurred_at DESC);
CREATE INDEX ix_exec_logs_campaign_status
    ON audit.campaign_execution_logs (campaign_id, status, occurred_at DESC);

ALTER TABLE audit.campaign_execution_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'campaign_id',
    timescaledb.compress_orderby = 'occurred_at DESC'
);
SELECT add_compression_policy('audit.campaign_execution_logs', INTERVAL '90 days');
-- Retention: 7 years (marketing compliance; see §8 matrix)
SELECT add_retention_policy('audit.campaign_execution_logs', INTERVAL '7 years');

-- 7.2 Suppression list ---------------------------------------------------------
CREATE TABLE audit.suppressions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roaster_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    channel         TEXT NOT NULL DEFAULT 'all' CHECK (channel IN ('email','sms','all')),
    reason          TEXT NOT NULL CHECK (reason IN
                    ('unsubscribe','bounce_hard','complaint','manual','gdpr_erasure')),
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE CASCADE,   -- NULL = global
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      TEXT NOT NULL DEFAULT 'system',
    UNIQUE (roaster_id, channel, campaign_id)
);
-- Rule engine lookup: one covering index (03 doc §7 step 3)
CREATE INDEX ix_suppressions_lookup
    ON audit.suppressions (roaster_id, campaign_id) WHERE reason <> 'manual';

-- 7.3 Token-click ledger (merge-tag engagement) --------------------------------
CREATE TABLE audit.token_clicks (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    execution_log_id UUID NOT NULL,                       -- app-enforced FK: parent PK is
                                                        -- composite (id, occurred_at) on hypertable
    token_key       TEXT NOT NULL,                        -- matches campaign_tokens.token_key
    clicked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    redirect_url    TEXT NOT NULL,
    PRIMARY KEY (id, clicked_at)
);
CREATE INDEX ix_token_clicks_exec ON audit.token_clicks (execution_log_id, clicked_at DESC);
SELECT create_hypertable('audit.token_clicks', 'clicked_at', if_not_exists => TRUE,
        migrate_data => TRUE);

-- down: DROP TABLE audit.token_clicks, audit.suppressions, audit.campaign_execution_logs;
```

---

## 8. `202502060800_platform__outbox_inbox.sql`

Creates the tables consumed by `03-event-driven-pipeline.md` §5 (shown there in full; registered here for the migration ledger):

```sql
-- up (see 03-event-driven-pipeline.md §5.1 / §5.4 for commentary)
CREATE TABLE events.outbox (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    aggregate_type   TEXT        NOT NULL,
    aggregate_id     UUID        NOT NULL,
    event_type       TEXT        NOT NULL,
    topic            TEXT        NOT NULL,
    payload          JSONB       NOT NULL,
    headers          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at     TIMESTAMPTZ,
    publish_attempts INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Create the first 8 weekly partitions explicitly (pg_partman optional later)
-- NOTE: generate_series over timestamptz (PG15-compatible; date+int form needs PG16)
DO $$
DECLARE w DATE;
BEGIN
  FOR w IN SELECT generate_series(date_trunc('week', now()),
                                  date_trunc('week', now()) + INTERVAL '7 weeks',
                                  INTERVAL '1 week')::date LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS events.outbox_%s PARTITION OF events.outbox
         FOR VALUES FROM (%L) TO (%L)',
      to_char(w, 'IYYY_IW'), w, w + 7);
  END LOOP;
END $$;

CREATE INDEX ix_outbox_unpublished ON events.outbox (occurred_at) WHERE published_at IS NULL;

CREATE TABLE events.inbox (
    consumer_group TEXT NOT NULL,
    event_id       UUID NOT NULL,
    processed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer_group, event_id)
);
-- Inbox janitor: rows older than 30d are safe to purge (event TTL on topics is >= 7d,
-- replay horizon is 30d) — scheduled in §9 via pg_cron.

-- down: DROP TABLE events.outbox, events.inbox;
```

---

## 9. `202502101600_platform__indexes_retention.sql` — Index & Partition Strategy

### 9.1 Composite/partial indexes (extends Base Doc §9.1 — do not duplicate its indexes)

```sql
-- up
-- Navigator hot query: filter by budget + min cup + origin (Base Doc §IV.4.2)
CREATE INDEX CONCURRENTLY ix_lots_active_nav
    ON coffee_lots (price_per_lb_cents, cup_score DESC, origin)
    WHERE available_quantity_lbs > 0;

-- Trigram search for roaster autocomplete + lot origin search
CREATE INDEX CONCURRENTLY ix_accounts_name_trgm  ON accounts   USING GIN (roaster_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY ix_lots_origin_trgm    ON coffee_lots USING GIN (origin gin_trgm_ops);
CREATE INDEX CONCURRENTLY ix_lots_flavor_gin     ON coffee_lots USING GIN (flavor_notes jsonb_path_ops);

-- Churn feature: days_since_last_order maintained by trigger below
CREATE INDEX CONCURRENTLY ix_accounts_dormancy
    ON accounts (days_since_last_order DESC) WHERE status = 'active';

-- Campaign attribution lookups (campaign_engagements from Base Doc §III)
CREATE INDEX CONCURRENTLY ix_campaign_eng_conv
    ON campaign_engagements (campaign_id, converted_at DESC) WHERE converted_at IS NOT NULL;

-- automation_rules trigger lookups — complements idx_rules_trigger from the marketing schema
CREATE INDEX CONCURRENTLY ix_rules_trigger_active
    ON automation_rules (trigger_event) WHERE status = 'armed';

-- Order saga lookups by invoice + PO
CREATE INDEX CONCURRENTLY ix_orders_invoice ON orders (invoice_number) WHERE invoice_number IS NOT NULL;

-- Margin-floor watch: lots priced at/below cost (Catalog invariant §01-4.1 →
-- catalog.margin_floor_breached). Uses the Base Doc cost_per_lb_cents column.
CREATE INDEX CONCURRENTLY ix_lots_below_cost
    ON coffee_lots (id) WHERE price_per_lb_cents <= cost_per_lb_cents;
```

### 9.2 Declarative partitioning for `orders` (contract phase, Phase 2)

`orders` stays a single table in Phase 1 (per Base Doc). When `orders` passes ~50M rows (forecast: month 18 at +25% MoM acquisition, §XI), migrate to monthly range partitions using the shadow-table pattern:

```sql
-- Phase-2 blueprint (NOT applied in this migration — gated behind feature flag
-- 'orders_partitioning'; included for capacity planning completeness):
--   1. CREATE TABLE orders_p (LIKE orders INCLUDING ALL) PARTITION BY RANGE (order_date);
--   2. Backfill via logical replication / pgcopydb with parallel COPY.
--   3. Atomic swap in one txn: ALTER TABLE orders RENAME TO orders_legacy;
--      ALTER TABLE orders_p RENAME TO orders;  -- behind blue/green deploy (§3.3)
--   4. ANALYZE; drop legacy after 30-day soak.
```

### 9.3 Data Retention Policy (binding matrix)

| Data class | Table(s) | Live retention | Archive | Legal basis |
|---|---|---|---|---|
| Campaign dispatch ledger | `audit.campaign_execution_logs` | **7 y** (Timescale retention) | S3 Glacier copy nightly | CAN-SPAM / TCPA audit |
| Suppressions | `audit.suppressions` | indefinite (until roaster deleted) | — | consent enforcement |
| Engagement telemetry raw | `telemetry.engagement_events` | **13 mo** → compress @14d | aggregated caggs persist | legitimate interest |
| Churn risk snapshots | `churn.risk_scores` | 24 mo | S3 (parquet, monthly) | model audit |
| Referral clicks | `referral.clicks` | 12 mo | — | fraud investigation |
| Orders / invoices | `orders`, `order_line_items` | 7 y (unpartitioned → monthly parts) | Glacier | tax/GAAP |
| Outbox | `events.outbox` | 7 d post-publish (drop partitions) | — | transient |
| Inbox | `events.inbox` | 30 d (pg_cron purge) | — | transient |
| PII (contacts) | `contacts` | until erasure request | crypto-shredded | GDPR Art. 17 (07 doc §5) |

```sql
-- up (jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Purge published outbox rows hourly (partition drop is cheaper than DELETE)
SELECT cron.schedule('outbox-purge', '15 * * * *', $$
  DELETE FROM events.outbox WHERE published_at < now() - INTERVAL '7 days';
$$);

SELECT cron.schedule('inbox-purge', '45 3 * * *', $$
  DELETE FROM events.inbox WHERE processed_at < now() - INTERVAL '30 days';
$$);

-- Nightly dormancy refresh for churn features (replaces app-side computation)
SELECT cron.schedule('account-dormancy', '20 2 * * *', $$
  UPDATE accounts a
     SET days_since_last_order = subq.d
    FROM (SELECT account_id, EXTRACT(DAY FROM now() - MAX(order_date))::int AS d
            FROM orders GROUP BY account_id) subq
   WHERE a.id = subq.account_id;
$$);

-- Nightly risk-score write-back (after the scorer run at 01:30)
SELECT cron.schedule('risk-score-sync', '40 2 * * *', $$
  SELECT churn.sync_account_risk_scores();
$$);

-- down: SELECT cron.unschedule('outbox-purge'); ... (all four jobs)
```

---

## 10. `202502111000_platform__roles_grants.sql` — Least-Privilege Roles

Implements the marketing schema's "role-based security accesses for isolated microservices". One login role per service (names match ECS task roles in Base Doc §6.1).

```sql
-- up
CREATE ROLE svc_orders    LOGIN PASSWORD :'svc_orders_pw';    -- via Secrets Manager (07 doc §4)
CREATE ROLE svc_catalog   LOGIN PASSWORD :'svc_catalog_pw';
CREATE ROLE svc_campaigns LOGIN PASSWORD :'svc_campaigns_pw';
CREATE ROLE svc_analytics LOGIN PASSWORD :'svc_analytics_pw';
CREATE ROLE svc_notify    LOGIN PASSWORD :'svc_notify_pw';
CREATE ROLE svc_readonly  NOLOGIN;                            -- human analysts (SSO group role)

-- Orders service: owns orders/lines/audit/outbox; reads accounts+lots
GRANT SELECT, INSERT, UPDATE ON orders, order_line_items      TO svc_orders;
GRANT SELECT             ON accounts, coffee_lots             TO svc_orders;
GRANT INSERT             ON audit_logs                        TO svc_orders;
GRANT ALL                ON events.outbox, events.inbox       TO svc_orders;

-- Catalog service: owns lots + inventory tx; reads orders for demand signals
GRANT SELECT, INSERT, UPDATE ON coffee_lots                   TO svc_catalog;
GRANT INSERT                  ON inventory_transactions       TO svc_catalog;
GRANT SELECT                  ON orders                       TO svc_catalog;
GRANT ALL                     ON events.outbox, events.inbox  TO svc_catalog;

-- Campaigns service: full on marketing schema + ledger/suppression; read accounts
GRANT SELECT, INSERT, UPDATE, DELETE
    ON campaigns, campaign_tokens, marketing_templates, automation_rules, rule_actions TO svc_campaigns;
GRANT SELECT ON view_compiled_campaign_rules                 TO svc_campaigns;
GRANT INSERT, UPDATE ON audit.campaign_execution_logs        TO svc_campaigns;
GRANT SELECT, INSERT ON audit.suppressions, audit.token_clicks TO svc_campaigns;
GRANT SELECT ON accounts                                     TO svc_campaigns;
GRANT ALL   ON events.outbox, events.inbox                   TO svc_campaigns;

-- Analytics service: read facts, own telemetry/churn/referral projections
GRANT SELECT ON orders, order_line_items, accounts, coffee_lots,
               campaign_engagements, churn_interventions     TO svc_analytics;
GRANT SELECT, INSERT ON telemetry.engagement_events          TO svc_analytics;
GRANT ALL   ON ALL TABLES IN SCHEMA churn, referral          TO svc_analytics;
GRANT ALL   ON events.inbox                                  TO svc_analytics;

-- Notification service: dispatch-only — read compiled rules, write provider refs
GRANT SELECT ON view_compiled_campaign_rules                 TO svc_notify;
GRANT UPDATE (provider_ref, status) ON audit.campaign_execution_logs TO svc_notify;

-- Human analysts: aggregated reads only, NO PII (contacts excluded by omission)
GRANT svc_readonly TO svc_analytics;                         -- inheritance path
REVOKE SELECT ON contacts FROM svc_readonly;                 -- belt & braces

-- down: REVOKE ...; DROP ROLE svc_orders, svc_catalog, svc_campaigns,
--       svc_analytics, svc_notify, svc_readonly;
```

---

## 11. Backfill & Validation Runbook

1. **Backfill `engagement_6mo_daily`** — after enabling the cagg, run `CALL refresh_continuous_aggregate('telemetry.engagement_6mo_daily', NULL, NULL);` off-peak (03:00–05:00 window per Base Doc RDS config).
2. **Backfill risk history** — nightly scorer writes to `churn.risk_scores`; seed 90 days by replaying `AnalyticsService` features (idempotent: `ON CONFLICT DO NOTHING` on `(account_id, scored_at::date)`).
3. **Validate outbox lag** — `SELECT count(*) FROM events.outbox WHERE published_at IS NULL` must trend to 0; alert threshold 5k for 10m (feeds `07-security-compliance.md` runbook R-03).
4. **Validate retention** — `SELECT * FROM timescaledb_information.jobs WHERE proc_name IN ('policy_retention','policy_compression');` after each deploy.
5. **Smoke tests** — migration CI job applies up→down→up on an ephemeral Postgres 15 + Timescale container (see `06-testing-chaos-ci.md` §5).
