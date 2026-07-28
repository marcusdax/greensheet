# 05 — i18n Audit & CI

Two layers of automated protection:

1. **`scripts/i18n_audit.py`** (from the localization-toolkit skill) — audits **key usage**: scans the React source for `t('…')` calls and reports keys missing from each locale file, unused keys, and naive parity.
2. **`scripts/validate_locale_files.py`** (authored for Greensheet) — validates **locale file health**: JSON validity, plural-aware key parity, per-locale plural categories, placeholder/merge-tag consistency, and protected brand tokens. This is the PR gate.

---

## 1. Running the usage audit

```bash
# from the repo root (locale files split or combined; pass one --locale per file)
python scripts/i18n_audit.py \
  --src ./src \
  --locale 02-locale-files/en-US.json \
  --locale 02-locale-files/zh-CN.json \
  --locale 02-locale-files/es-MX.json \
  --locale 02-locale-files/pt-BR.json

# machine-readable output for dashboards:
python scripts/i18n_audit.py --src ./src \
  --locale 02-locale-files/en-US.json --locale 02-locale-files/zh-CN.json --json
```

Reading the output:

- **`Missing`** must be **0** for every locale before merge — these are `t()` calls with no translation. Plural calls (`t('catalog.lot.lbsAvailable', { count })`) resolve against `_one`/`_other` variants automatically.
- **`Unused`** is informational: locale keys not (yet) referenced in code — e.g. keys shipped ahead of a feature. Prune only deliberately.
- **`Parity missing` from this script is plural-unaware.** It compares raw key sets, so it will always report a few "differences" between locales because plural categories legitimately differ (zh-CN ships `_other` only; es/pt ship `_one`/`_many`/`_other`; en ships `_one`/`_other`). **Do not treat those as failures** — the authoritative parity check is `validate_locale_files.py`, which is plural-aware.
- Dynamic keys (`t(someVar)`) are invisible to static scanning — they are banned by convention (see 01, §5 rule 1); any exception requires an explicit dictionary map + a review note.

## 2. Running the locale validator (the PR gate)

```bash
python scripts/validate_locale_files.py \
  --source 02-locale-files/en-US.json \
  02-locale-files/en-US.json 02-locale-files/zh-CN.json \
  02-locale-files/es-MX.json 02-locale-files/pt-BR.json
```

Exit 0 = green (`OK — 4 locales, 1036 keys total, parity/plurals/placeholders/brand all green.`); exit 1 prints one line per violation, prefixed by check type: `[json]`, `[parity]`, `[plural]`, `[placeholder]`, `[brand]`.

## 3. GitHub Actions workflow — `.github/workflows/i18n.yml`

```yaml
name: i18n

on:
  pull_request:
    paths:
      - '02-locale-files/**'
      - 'src/**'
      - 'scripts/i18n_audit.py'
      - 'scripts/validate_locale_files.py'
      - '.github/workflows/i18n.yml'
  push:
    branches: [main]

jobs:
  locale-health:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: JSON validity (python -m json.tool)
        run: |
          for f in 02-locale-files/*.json; do
            python -m json.tool "$f" > /dev/null || { echo "::error file=$f::Invalid JSON"; exit 1; }
          done

      - name: Key parity + plurals + placeholders + brand tokens
        run: |
          python scripts/validate_locale_files.py \
            --source 02-locale-files/en-US.json \
            02-locale-files/en-US.json \
            02-locale-files/zh-CN.json \
            02-locale-files/es-MX.json \
            02-locale-files/pt-BR.json

      - name: Key usage audit (missing keys block the PR)
        run: |
          python scripts/i18n_audit.py --src ./src \
            --locale 02-locale-files/en-US.json \
            --locale 02-locale-files/zh-CN.json \
            --locale 02-locale-files/es-MX.json \
            --locale 02-locale-files/pt-BR.json \
            --json > audit.json
          python - <<'PY'
          import json, sys
          report = json.load(open('audit.json'))
          missing = {loc: keys for loc, keys in report['missing_by_locale'].items() if keys}
          if missing:
              for loc, keys in missing.items():
                  for k in keys:
                      print(f"::error::{loc} missing key used in src: {k}")
              sys.exit(1)
          print('No missing keys in any locale.')
          PY
```

Notes:

- The workflow triggers only when locale files, source, or the scripts themselves change — cheap and fast (<30 s).
- `Missing` from the usage audit **blocks**; `Unused` and the naive `parity_missing` do not (see §1).
- Add a scheduled (weekly) run on `main` to catch drift from batch TMS exports: same jobs, plus an issue-auto-open step on failure.

## 4. The validator — `scripts/validate_locale_files.py`

Shipped in this deliverable and embedded here so the check is reviewable inline; keep the two in sync (the Actions job runs the file copy).

```python
#!/usr/bin/env python3
"""Validate Greensheet locale files: JSON validity, key parity, plural
categories, placeholder consistency, and brand-term preservation.

Usage:
  python scripts/validate_locale_files.py \
      --source 02-locale-files/en-US.json \
      02-locale-files/zh-CN.json 02-locale-files/es-MX.json 02-locale-files/pt-BR.json

Exit code 0 = all checks pass; 1 = validation failures found.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

PLURAL_SUFFIXES = ("_zero", "_one", "_two", "_few", "_many", "_other")

# CLDR cardinal plural categories actually used per locale (i18next JSON v4).
# zh-CN only has "other"; es/pt add "many" (compact millions, e.g. 1.000.000).
REQUIRED_CATEGORIES = {
    "en-US": {"one", "other"},
    "zh-CN": {"other"},
    "es-MX": {"one", "many", "other"},
    "pt-BR": {"one", "many", "other"},
}

# Brand / technical tokens that must survive translation untranslated.
PROTECTED_TOKENS = ("Greensheet", "SCA", "ESG", "Q Grader")

# Placeholders: UI uses i18next {{name}}; email/SMS merge tags use {name}.
MERGE_TAG_RE = re.compile(r"(?<!\{)\{([a-z][a-z0-9_]*)\}(?!\})")
I18NEXT_RE = re.compile(r"\{\{([^{}]+?)\}\}")


def flatten(obj, prefix=""):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flatten(v, f"{prefix}.{k}" if prefix else k))
    else:
        out[prefix] = obj
    return out


def base_key(key: str) -> str:
    for suffix in PLURAL_SUFFIXES:
        if key.endswith(suffix):
            return key[: -len(suffix)]
    return key


def plural_suffix(key: str):
    for suffix in PLURAL_SUFFIXES:
        if key.endswith(suffix):
            return suffix[1:]  # strip leading underscore
    return None


def placeholders(value: str):
    """Return (merge_tags, i18next_vars) as normalized sets."""
    merges = set(MERGE_TAG_RE.findall(value))
    # i18next vars may carry format specifiers: {{price, currency}} -> 'price'
    i18n = {v.split(",")[0].strip() for v in I18NEXT_RE.findall(value)}
    return merges, i18n


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate locale JSON files.")
    ap.add_argument("--source", required=True, help="Source locale JSON (en-US)")
    ap.add_argument("locales", nargs="+", help="All locale JSON files (incl. source)")
    args = ap.parse_args()

    problems = []
    flat = {}
    locale_names = []

    # 1) JSON validity + flatten
    for raw in [args.source, *args.locales]:
        path = Path(raw)
        name = path.stem
        if name in locale_names:
            continue
        locale_names.append(name)
        try:
            flat[name] = flatten(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            problems.append(f"[json] {path}: {exc}")
    if problems:
        for p in problems:
            print(p)
        return 1

    source_name = Path(args.source).stem
    source = flat[source_name]
    source_bases = {base_key(k) for k in source}

    # 2) Base-key parity (plural-aware) in both directions
    for name in locale_names:
        if name == source_name:
            continue
        target_bases = {base_key(k) for k in flat[name]}
        for key in sorted(source_bases - target_bases):
            problems.append(f"[parity] {name} missing key: {key}")
        for key in sorted(target_bases - source_bases):
            problems.append(f"[parity] {name} has extra key: {key}")

    # 3) Plural categories per locale
    for name in locale_names:
        required = REQUIRED_CATEGORIES.get(name)
        if required is None:
            continue
        keys = flat[name]
        for base in sorted({k for k in (base_key(x) for x in keys) if plural_suffix_of_any(k, keys)}):
            present = {plural_suffix(k) for k in keys if base_key(k) == base and plural_suffix(k)}
            if not present:
                continue
            missing = required - present
            extra = present - set(REQUIRED_CATEGORIES[name])
            for cat in sorted(missing):
                problems.append(f"[plural] {name}: {base} missing category _{cat}")
            for cat in sorted(extra):
                problems.append(f"[plural] {name}: {base} has unsupported category _{cat}")

    # 4) Placeholder consistency vs source
    for name in locale_names:
        if name == source_name:
            continue
        for key, s_val in source.items():
            t_val = flat[name].get(key)
            if t_val is None:
                continue  # reported by parity check
            s_merge, s_i18n = placeholders(str(s_val))
            t_merge, t_i18n = placeholders(str(t_val))
            if s_merge != t_merge:
                problems.append(
                    f"[placeholder] {name} {key}: merge tags {sorted(t_merge)} != source {sorted(s_merge)}"
                )
            if s_i18n != t_i18n:
                problems.append(
                    f"[placeholder] {name} {key}: i18next vars {sorted(t_i18n)} != source {sorted(s_i18n)}"
                )

    # 5) Protected brand tokens stay untranslated
    for name in locale_names:
        if name == source_name:
            continue
        for key, s_val in source.items():
            t_val = flat[name].get(key)
            if t_val is None:
                continue
            for token in PROTECTED_TOKENS:
                if token in str(s_val) and token not in str(t_val):
                    problems.append(f"[brand] {name} {key}: protected token '{token}' was translated or dropped")

    if problems:
        print(f"FAIL — {len(problems)} problem(s):")
        for p in problems:
            print(" ", p)
        return 1
    total = sum(len(v) for v in flat.values())
    print(f"OK — {len(locale_names)} locales, {total} keys total, parity/plurals/placeholders/brand all green.")
    return 0


def plural_suffix_of_any(base: str, keys) -> bool:
    return any(plural_suffix(k) for k in keys if base_key(k) == base)


if __name__ == "__main__":
    sys.exit(main())
```

## 5. Failure response playbook

| CI failure | Fix |
|---|---|
| `[json]` | Run `python -m json.tool <file>` locally; usually a trailing comma from a hand edit |
| `[parity] missing` | Add the key (translate via pipeline, §04) — never stub with English silently |
| `[parity] extra` | Remove the orphaned key or add it to en-US first |
| `[plural]` | Match the locale's CLDR category set; do not copy en `_one` into zh-CN |
| `[placeholder]` | Restore the exact merge tag/`{{var}}`; translators must not "fix" tag names |
| `[brand]` | Restore `Greensheet`/`SCA`/`ESG`/`Q Grader` verbatim; add the term to the glossary |
| usage-audit `Missing` | The code references a key not in the locale files — add it to en-US + all locales in the same PR |
