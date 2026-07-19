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
