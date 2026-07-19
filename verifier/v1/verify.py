#!/usr/bin/env python3
"""Verifier v1 for Greensheet expansion deliverables."""
import json, os, re, sys

ROOT = "/mnt/agents/output/greensheet-expansion"
REQUIRED_MD = {
 "engineering": ["01-domain-model-event-storming.md","02-openapi-contract.md","03-event-driven-pipeline.md","04-database-evolution.md","05-state-management-zustand.md","06-testing-chaos-ci.md","07-security-compliance.md"],
 "design-system": ["01-brand-identity.md","02-design-tokens.md","03-component-library.md","04-email-campaign-visual-system.md","05-ui-implementation-prompt.md"],
 "marketing": ["01-growth-architecture.md","02-cof-campaign-expansion.md","03-referral-engine-playbook.md","04-churn-intervention-playbook.md","05-video-content-ecosystem.md","06-production-bible.md"],
 "localization": ["01-i18n-architecture.md","03-campaign-localization-playbook.md","04-translation-pipeline.md","05-i18n-audit-ci.md"],
}
LOCALES = ["en-US","zh-CN","es-MX","pt-BR"]
MERGE_TAGS = ["{sca_cup_score}","{process_method}"]
fails = []

for d, files in REQUIRED_MD.items():
    for f in files:
        p = os.path.join(ROOT, d, f)
        if not os.path.exists(p):
            fails.append(f"MISSING: {d}/{f}"); continue
        txt = open(p, encoding="utf-8").read()
        lines = txt.count("\n") + 1
        if lines < 100: fails.append(f"SHALLOW ({lines} lines): {d}/{f}")
        if not re.search(r"^#{1,3} ", txt, re.M): fails.append(f"NO HEADING: {d}/{f}")

# locale JSONs
keysets = {}
for loc in LOCALES:
    p = os.path.join(ROOT, "localization/02-locale-files", f"{loc}.json")
    if not os.path.exists(p):
        fails.append(f"MISSING locale: {loc}.json"); continue
    try:
        data = json.load(open(p, encoding="utf-8"))
    except Exception as e:
        fails.append(f"INVALID JSON {loc}.json: {e}"); continue
    def flat(d, pre=""):
        out = {}
        for k, v in d.items():
            key = f"{pre}.{k}" if pre else k
            if isinstance(v, dict): out.update(flat(v, key))
            else: out[key] = v
        return out
    keysets[loc] = flat(data)
    raw = open(p, encoding="utf-8").read()
    for tag in MERGE_TAGS:
        if tag not in raw: fails.append(f"PLACEHOLDER {tag} absent in {loc}.json")

if len(keysets) == len(LOCALES):
    base = set(keysets["en-US"])
    for loc in LOCALES[1:]:
        missing = base - set(keysets[loc])
        extra = set(keysets[loc]) - base
        if missing: fails.append(f"{loc}: missing {len(missing)} keys e.g. {sorted(missing)[:5]}")
        if extra: fails.append(f"{loc}: {len(extra)} extra keys e.g. {sorted(extra)[:5]}")
        # placeholder consistency per key
        for k in base & set(keysets[loc]):
            for tag in re.findall(r"\{[a-z_]+\}", str(keysets["en-US"][k])):
                if tag not in str(keysets[loc][k]):
                    fails.append(f"{loc}: key '{k}' lost placeholder {tag}")

print(f"CHECKS COMPLETE — {len(fails)} failure(s)")
for f in fails: print("FAIL:", f)
sys.exit(1 if fails else 0)
