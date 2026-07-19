# 04 — Translation Pipeline & Operations

How Greensheet translations are produced, reviewed, and shipped. Principles: en-US is the source of truth; keys are stable; placeholders and plurals are machine-validated; humans own tone, machines own consistency.

---

## 1. Source-of-truth flow

```
product/eng writes en-US keys  →  PR adds keys to 02-locale-files/en-US.json
        │                              (CI blocks: invalid JSON, untranslated
        ▼                               target keys older than one release)
AI draft (zh-CN, es-MX, pt-BR) with glossary + TM context
        ▼
Human review (coffee-industry native reviewer per locale)
        ▼
QA checks (§4) + CI validation (§6)  →  merge  →  TM/TBX + glossary updated
```

- New keys may merge with en-US only; target locales catch up within **one release**. Untranslated keys fall back to en-US at runtime (`fallbackLng`) and are flagged by CI as warnings (not blockers) with a due date.
- Key renames are breaking changes: update all four locales + TM in the same PR.

## 2. TM & glossary management

- **Translation Memory (TM):** store per-locale TMX (or the TMS's native memory: Lokalise/Crowdin/Phrase). Reuse threshold 85% fuzzy; anything below goes to human review. TM is updated **after** human review, never from raw AI output.
- **Glossary/termbase:** CSV below is the starter; convert to TBX for TMS import. `do_not_translate=yes` entries are enforced by the CI brand-token check (`scripts/validate_locale_files.py`) for Greensheet/SCA/ESG/Q Grader.
- Glossary changes require sign-off from the locale's lead reviewer; log changes in the PR description.

### Starter glossary — `glossary.csv`

```csv
term_en,zh_cn,es_mx,pt_br,do_not_translate,notes
Greensheet,Greensheet,Greensheet,Greensheet,yes,Product/brand name
SCA,SCA,SCA,SCA,yes,Specialty Coffee Association acronym
SCA cup score,SCA 杯测分数,puntaje de taza SCA,pontuação de xícara SCA,no,
cupping,杯测,cata,degustação,no,pt-BR also accepts "prova"
green coffee,生豆,café verde,café verde,no,zh full form 咖啡生豆
washed,水洗,lavado,lavado,no,process method
natural,日晒,natural,natural,no,process method
honey,蜜处理,honey,honey,no,pt-BR per-lot variant: cereja descascado
anaerobic,厌氧发酵,anaeróbico,anaeróbico,no,process method
varietal,品种,varietal,variedade,no,pt-BR trade uses variedade
origin,产地,origen,origem,no,
lot,批次,lote,lote,no,
roaster,烘焙商,tostador,torrador,no,zh alt: 烘焙工坊; pt-BR alt: torrefação
sample kit,样品套装,kit de muestras,kit de amostras,no,
harvest,产季,cosecha,safra,no,pt-BR marketing term is safra
single origin,单一产地,origen único,origem única,no,
flavor notes,风味描述,notas de sabor,notas sensoriais,no,
cup score,杯测分数,puntaje de taza,pontuação de xícara,no,
Q Grader,Q Grader,Q grader,Q grader,yes,Certification title
ESG,ESG,ESG,ESG,yes,
LTV,LTV,LTV,LTV,yes,Customer lifetime value acronym
CAC,CAC,CAC,CAC,yes,Customer acquisition cost acronym
API,API,API,API,yes,
COF-001,COF-001,COF-001,COF-001,yes,Campaign IDs COF-001 through COF-005
dashboard,数据总览,panel,painel,no,
campaign,营销活动,campaña,campanha,no,
unsubscribe,退订邮件,cancelar suscripción,cancelar inscrição,no,
sample,样品,muestra,amostra,no,
origin navigator,产地导航,navegador de orígenes,navegador de origens,no,Feature name
importer,进口商,importador,importador,no,
exporter,出口商,exportador,exportador,no,
spot coffee,现货咖啡,café disponible,café em estoque,no,
merge tag,合并标签,etiqueta de combinación,tag de mesclagem,no,Dev/ops docs only
A/B test,A/B 测试,prueba A/B,teste A/B,no,
churn,流失,abandono,cancelamento,no,pt-BR UI prefers cancelamento
```

## 3. AI + human review workflow

1. **Draft (AI):** translate with a TM- and glossary-aware prompt: glossary terms pinned, merge tags `{...}` and i18next vars `{{...}}` passed through untouched, locale register constraints (§1 of 03 doc), max-length notes for SMS (160 chars) and subject lines (≈60 chars).
2. **Triage (AI self-check):** model verifies placeholder parity and glossary compliance per string; failures regenerate once, then route to human.
3. **Human review (required for: campaigns.*, errors.*, common.meta.*):** native reviewer with specialty-coffee trade experience edits for register and terminology; approval recorded in the TMS.
4. **Human spot-check (catalog/dashboard/common UI labels):** ≥20% sample per release; full review quarterly.
5. **Sign-off:** locale lead approves in TMS; export to `02-locale-files/*.json`; CI runs the full validator (§6) before merge.

RACI: PM = accountable for glossary; locale leads = responsible for sign-off; eng = responsible for CI plumbing; marketing = consulted on campaigns.*.

## 4. QA checks (pre-merge)

- JSON parses (`python -m json.tool`).
- Key parity vs en-US (plural-aware) — zero missing/zero extra.
- Placeholder parity per key: `{merge_tags}` and `{{i18next_vars}}` sets identical to source.
- Plural categories match CLDR per locale (`zh: other`; `en: one/other`; `es/pt: one/many/other`).
- Brand tokens intact; no Latin-script placeholders left untranslated inside zh-CN prose except protected tokens.
- Length checks: subjects ≤ 60 chars (zh ≤ 30 CJK), preheaders ≤ 90, SMS ≤ 160 GSM-7-equivalent (note: zh SMS is UCS-2 → 70 chars/segment — keep to one segment).
- Link lint: every `{*_url}` tag appears in a sentence that survives URL-stripping (a11y for plain-text part).
- Rendering smoke test: COF-001–005 rendered with fixture data in all four locales, screenshot-reviewed once per quarter.

## 5. ICU MessageFormat decisions

- **UI (react-i18next): stay on i18next JSON v4 plurals** (`key_one`/`key_other`…) — no ICU plugin. Rationale: our plurals are simple cardinal counts; i18next's `Intl.PluralRules`-backed suffixes cover zh/es/pt correctly; JSON v4 keeps files TMS-friendly; adding `i18next-icu` would change placeholder syntax (`{count, plural, …}`) and break the byte-identical merge-tag rule for emails.
- **When we would switch a string to ICU:** a message needing *multiple* pluralized variables or gender agreement (e.g., "{count} lots from {origins} origins" if both must pluralize, or future locales with gendered nouns like pt/es job titles). Decision: handle today by keeping one plural variable per key (see `catalog.resultsSummary` — plural on `lotCount`, `originCount` interpolated as a number); revisit if a shipped string truly needs two plurals → introduce `i18next-icu` for that namespace only, documented here.
- **Email/SMS (server-side):** plain merge-tag substitution, **not** ICU — templates must stay editable by non-engineers and identical in shape across locales. Any conditional copy (e.g., "1 lb left" vs "{n} lbs left") is done by selecting among template variants in the Notification Service, not by embedding logic in templates.
- **Select/gender:** none needed in current copy; if es/pt copy later needs gendered address (e.g., "Bem-vindo/Bem-vinda"), prefer neutral phrasing ("Boas-vindas" / "Le damos la bienvenida") over ICU `select`.

## 6. Placeholder/plural validation CI step

`scripts/validate_locale_files.py` (shipped in this deliverable, embedded in `05-i18n-audit-ci.md`) enforces: JSON validity, plural-aware key parity, per-locale plural categories, placeholder-set parity, and protected brand tokens. Run locally:

```bash
python scripts/validate_locale_files.py \
  --source 02-locale-files/en-US.json \
  02-locale-files/en-US.json 02-locale-files/zh-CN.json \
  02-locale-files/es-MX.json 02-locale-files/pt-BR.json
```

Exit 0 = green; exit 1 prints one line per violation. Wired into GitHub Actions in `05-i18n-audit-ci.md` (blocks PRs that touch `02-locale-files/**`). The same script runs pre-release in the TMS export job so broken exports fail before they reach the repo.
