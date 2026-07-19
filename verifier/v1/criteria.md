# Verifier v1 Criteria

Required files:
- engineering/01-domain-model-event-storming.md, 02-openapi-contract.md, 03-event-driven-pipeline.md, 04-database-evolution.md, 05-state-management-zustand.md, 06-testing-chaos-ci.md, 07-security-compliance.md
- design-system/01-brand-identity.md, 02-design-tokens.md, 03-component-library.md, 04-email-campaign-visual-system.md, 05-ui-implementation-prompt.md
- marketing/01-growth-architecture.md, 02-cof-campaign-expansion.md, 03-referral-engine-playbook.md, 04-churn-intervention-playbook.md, 05-video-content-ecosystem.md, 06-production-bible.md
- localization/01-i18n-architecture.md, 03-campaign-localization-playbook.md, 04-translation-pipeline.md, 05-i18n-audit-ci.md, 02-locale-files/{en-US,zh-CN,es-MX,pt-BR}.json

Checks (script: verifier/v1/verify.py):
- existence of all files
- markdown >= 100 lines each
- JSON validity of locale files
- locale key parity + placeholder byte-consistency for merge tags
- presence of headings in each md
