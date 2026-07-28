# 01 — Greensheet i18n Architecture

Target locales: **en-US** (source of truth), **zh-CN**, **es-MX**, **pt-BR**.
Stack assumption (per expansion plan): React SPA (Vite/TypeScript) + FastAPI/Node backend + a Notification Service that renders email/SMS.

---

## 1. Framework selection

**Chosen: `react-i18next` (i18next) with lazy-loaded namespaces.**

| Candidate | Verdict | Why |
|---|---|---|
| **react-i18next** | ✅ Use | SPA (Vite, not Next.js); mature plural system (JSON v4 via `Intl.PluralRules`); HTTP backend + lazy namespaces; huge ecosystem for TM-tool interop. |
| next-intl | ❌ Not now | Best-in-class for Next.js App Router only. Revisit if the frontend migrates to Next. |
| FormatJS / react-intl | ❌ | Strong ICU support, but heavier bundling model and weaker per-namespace lazy loading out of the box. (ICU decision in `04-translation-pipeline.md`.) |
| Lingui | ❌ | Macro extraction is nice, but adds build-step coupling the team doesn't need today. |

Packages:

```bash
npm i i18next react-i18next i18next-http-backend i18next-browser-languagedetector
```

## 2. Wiring — `src/i18n/index.ts`

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LOCALES = ['en-US', 'zh-CN', 'es-MX', 'pt-BR'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en-US';

void i18n
  .use(HttpBackend)            // lazy-load namespace JSON over HTTP (CDN-cacheable)
  .use(LanguageDetector)       // URL path > localStorage > navigator
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: false,      // zh-CN must NOT fall back to zh-TW etc.
    load: 'currentOnly',                  // 'es-MX', not plain 'es'
    ns: ['common', 'dashboard', 'catalog', 'campaigns', 'errors'],
    defaultNS: 'common',
    preload: ['common', 'errors'],        // needed by shell + every error boundary
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,             // /zh-CN/catalog/...
      caches: ['localStorage'],
      lookupLocalStorage: 'greensheet:locale',
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnEmptyString: false,              // empty translations fall back to en-US
    saveMissing: false,                    // keys are CI-gated, never inferred at runtime
  });

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = 'ltr';    // all current locales are LTR (see §8)
});

export default i18n;
```

Mount once in `main.tsx` (`import './i18n'`) and gate first paint on `useTranslation().ready` (or `<Suspense>`) to avoid a flash of fallback text.

### Namespace lazy loading

- `common` + `errors`: preloaded with the app shell (nav, buttons, error boundary).
- `catalog`, `dashboard`, `campaigns`: loaded on route entry — each route component calls `useTranslation('catalog')` etc., and i18next fetches only missing namespaces. This keeps the initial bundle to one HTTP request per preloaded namespace and defers the rest.
- Locale files in this repo (`02-locale-files/en-US.json` …) are the **build-time source**; the deploy step splits each file's top-level namespaces into `/locales/<lng>/<ns>.json` (top-level key = namespace). CI guarantees the split is lossless.

## 3. Locale routing strategy

**Subpath routing: `/{locale}/...`** — e.g. `/zh-CN/catalog`, `/pt-BR/campaigns`.

- Subpaths (not subdomains or `?lang=`): one domain's SEO authority, shareable localized URLs, trivial CDN rules, cookie-free.
- `react-router` wraps all routes in a `<LocaleLayout>` at `path="/:locale"` that (a) validates the param against `SUPPORTED_LOCALES`, (b) calls `i18n.changeLanguage(locale)`, (c) renders `<Outlet/>`. Invalid/missing locale → `302` to the detected best locale.
- Root `/` redirects via detection order (§4). Never 404 on `/`.
- Keep COF campaign links locale-aware: email CTAs deep-link to `/{locale}/catalog/lots/{lotId}` using the recipient's stored locale (falls back to en-US).

## 4. Detection, switcher, persistence

Detection precedence (first hit wins):

1. **URL path** — explicit user/shared-link choice always wins.
2. **`localStorage["greensheet:locale"]`** — returning visitor.
3. **`navigator.language`** — browser hint, matched exactly (`zh-CN` ✅) then by prefix only where safe (`es-MX` ← `es-*` LatAm; otherwise es → es-MX default; `pt-BR` ← `pt`; `zh-*` → zh-CN only for `zh-Hans`/`zh-CN`/`zh-SG`, **not** `zh-TW`/`zh-HK` → those fall back to en-US until Traditional Chinese ships).
4. **Default en-US.**

Persistence, on every switch:

- write `localStorage["greensheet:locale"]`;
- `PATCH /api/users/me { preferred_locale }` so **transactional + campaign email/SMS** render in the same language (the Notification Service reads this field, not the browser);
- update `<html lang>` and localized `<title>`/meta (§9).

Switcher: dropdown in the top nav labeled by `common.languageSwitcher.label`, listing each locale **in its own language** (`简体中文`, `Español (México)`, `Português (Brasil)`, `English (US)`) with a `🌐` icon; switching navigates to the same route under the new locale segment (preserves deep-link context).

## 5. Key architecture

Single JSON per locale, top-level namespaces, nested keys:

```
common.*      appName, nav, buttons, states, labels, a11y, units, meta, languageSwitcher
dashboard.*   metrics, charts, benchmark, time ranges, empty states
catalog.*     Origin Navigator, goal profiles, filters, lot card, attributes,
              processMethods, certifications, origins, plurals
campaigns.*   sequence UI, COF-001–005 steps, A/B test table, engagement,
              emails (subject/preheader/body/cta), sms, emailFooter
errors.*      title/generic/unknown + errors.codes.<ERROR_CODE> + errors.cta.*
```

Rules (enforced in review + CI):

1. **No key concatenation in code** — never `` t(`catalog.origins.${origin}`) `` with raw DB values. Map enums through explicit dictionaries (`catalog.origins.ethiopia`) with a typed fallback; unknown enums render the raw value, not a broken key.
2. **Two placeholder syntaxes, on purpose:**
   - UI strings → i18next `{{var}}` (e.g. `campaigns.sequence.step = "Step {{number}}"`).
   - Email/SMS templates → single-brace `{merge_tag}` (e.g. `{sca_cup_score}`), rendered server-side by the Notification Service. These are **byte-identical across locales** and validated in CI (`scripts/validate_locale_files.py`).
3. **Plurals** use i18next JSON v4 suffixes resolved by `Intl.PluralRules`: `t('catalog.lot.lbsAvailable', { count })` → `_one`/`_other` (en), `_other` only (zh), `_one`/`_many`/`_other` (es, pt — `many` covers compact-million counts). Source files in this deliverable already follow this.
4. **Brand tokens stay untranslated:** `Greensheet`, `SCA`, `ESG`, `Q Grader`, API names, and merge-tag names. (CI brand-token check.)
5. **Dates/numbers/currency are never hard-coded in strings** — use the Intl helpers (§6).
6. **No raw `error.message` to UI** — map codes (§7).
7. Keys are snake/camel-case-stable; renaming a shipped key requires a migration note in the PR (TM leverage depends on stable keys).

## 6. Intl formatting helpers — `src/i18n/format.ts`

```ts
export const fmtNumber   = (locale: string) => new Intl.NumberFormat(locale);
export const fmtCurrency = (locale: string, currency = 'USD') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency });
export const fmtPricePerLb = (locale: string, cents: number, currency = 'USD') =>
  `${fmtCurrency(locale, currency).format(cents / 100)}/lb`;
export const fmtDate = (locale: string) =>
  new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
export const fmtList = (locale: string) =>
  new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
```

Expected output for `$4.85/lb`, 12,500 lbs, Mar 15 2025:

| Locale | Price | Quantity | Date |
|---|---|---|---|
| en-US | $4.85/lb | 12,500 lbs | Mar 15, 2025 |
| zh-CN | US$4.85/磅 | 12,500 磅 | 2025年3月15日 |
| es-MX | $4.85/lb | 12,500 lb | 15 mar 2025 |
| pt-BR | US$ 4,85/lb | 12.500 lb | 15 de mar. de 2025 |

Note the comma/period decimal flip in pt-BR — a classic green-coffee pricing bug if prices are string-concatenated. All four locales currently render LTR; `dir` is set centrally (§2).

## 7. Localized error handling (critical path)

```ts
// src/lib/errors.ts — UI shows localized strings only; raw errors go to logs.
export function errorKey(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return code && KNOWN_CODES.has(code) ? `errors.codes.${code}` : 'errors.unknown';
}
// toast:  toast.error(t(errorKey(err)));  logger.error(err);   // never t(err.message)
```

- Coverage: `AUTH_SESSION_EXPIRED`, `AUTH_INVALID_CREDENTIALS`, `AUTH_FORBIDDEN`, `NET_OFFLINE`, `NET_TIMEOUT`, `RATE_LIMITED`, `VAL_REQUIRED_FIELD`, `VAL_INVALID_EMAIL`, `VAL_BUDGET_RANGE` (uses `{{min}}`/`{{max}}`), `LOT_NOT_FOUND`, `LOT_OUT_OF_STOCK`, `ORDER_FAILED`, `PAYMENT_DECLINED`, `IDEMPOTENCY_CONFLICT`, `SERVER_ERROR` — all shipped in `errors.codes.*`.
- Unknown codes → `errors.unknown`. Backend must attach stable `code` fields; frontend never pattern-matches English message text.
- ErrorBoundary fallback UI uses `errors.title` + `errors.generic` + `errors.cta.retry` (namespace `errors` is preloaded for exactly this reason).

## 8. RTL-ready CSS guidance

No current locale is RTL, but build RTL-ready now (Arabic is a plausible future trade locale):

- **Logical properties only** in new CSS: `margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-start-start-radius` — not `margin-left/right`, `text-align: left`. Tailwind: use `ms-*`/`me-*`/`ps-*`/`pe-*` utilities.
- Direction is data-driven: `<html dir>` is set on `languageChanged` (§2); components never hard-code direction. For a future RTL locale, flip `dir` in one place.
- Icons that imply direction (chevrons, arrows, "next/back") get `transform: scaleX(-1)` under `[dir="rtl"]`; icons without directionality (search, coffee) do not.
- Charts: Recharts axes need explicit `reversed` handling under RTL — test then; do not assume.
- Pseudo-element `content` and absolute positioning offsets are audit points in any RTL PR.

## 9. Localized SEO / metadata

- `<title>` + `<meta name="description">` come from `common.meta.title` / `common.meta.description` (already localized in the locale files) and update on `languageChanged` (react-helmet-async or equivalent).
- `hreflang` alternates for every route:
  ```html
  <link rel="alternate" hreflang="en-US" href="https://app.greensheet.com/en-US/catalog" />
  <link rel="alternate" hreflang="zh-CN" href="https://app.greensheet.com/zh-CN/catalog" />
  <link rel="alternate" hreflang="es-MX" href="https://app.greensheet.com/es-MX/catalog" />
  <link rel="alternate" hreflang="pt-BR" href="https://app.greensheet.com/pt-BR/catalog" />
  <link rel="alternate" hreflang="x-default" href="https://app.greensheet.com/en-US/catalog" />
  ```
- `og:locale` = current locale (`es_MX`, `pt_BR`, `zh_CN` underscore form) plus `og:locale:alternate` for the other three.
- Canonical URL includes the locale subpath (never collapse locales to one canonical).
- Per-locale sitemap entries; submit in Search Console / Baidu Webmaster Tools (zh-CN market).
- Email/SMS links always carry the locale segment so social previews and landing pages match the recipient's language.
