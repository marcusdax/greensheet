# Verifier Index — Greensheet Platform Expansion

## v1 (created 2026-07-19)
Measures: structural completeness and depth of the four workstreams under /mnt/agents/output/greensheet-expansion/.
Criteria (verifier/v1/criteria.md):
1. All required files per workstream exist.
2. Each markdown file >= 100 lines (substantive depth); locale JSONs valid.
3. Locale key parity across en-US/zh-CN/es-MX/pt-BR and placeholder consistency for {sca_cup_score}/{process_method}.
4. Markdown files have at least one heading; code blocks parse as fenced.
5. Naming consistent with base doc (COF-00X, sample_kit.delivered).
Runs recorded in verifier/runs/.

## v2 (created 2026-07-19)
Differs from v1: locale parity check is CLDR-plural-aware (strips _zero/_one/_two/_few/_many/_other suffixes before comparing key sets). v1's 3 "failures" were legitimate plural-category differences (zh-CN _other-only; es/pt add _many). Run2 result: 0 failures, exit 0.
