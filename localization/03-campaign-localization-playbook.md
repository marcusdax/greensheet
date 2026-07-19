# 03 — Campaign Localization Playbook (COF-001–005)

How the five-step nurture sequence adapts per market. Canonical templates live in `02-locale-files/*.json` under `campaigns.emails.cof00{1-5}.*` and `campaigns.sms.*`; merge tags (`{sca_cup_score}`, `{process_method}`, …) are byte-identical in every locale — **never translate, rename, or re-space a merge tag.**

Sequence recap (from the expansion plan: COF-001–005 is the conversion-optimized nurture track):

| Step | Timing | Goal |
|---|---|---|
| COF-001 New harvest introduction | Day 0 | First interaction with a newly landed lot |
| COF-002 Sample kit invitation | Day 3 | Get the roaster cupping (sample kit ships in 48 h) |
| COF-003 Roaster case study | Day 7 | Trust via a peer story + cupping data |
| COF-004 Availability update | Day 12 | Legitimate urgency (remaining lbs + arrival date) |
| COF-005 Re-engagement & feedback | Day 21 | Reactivate silent prospects, capture sourcing plans |

---

## 1. Register & formality per market

| | en-US | zh-CN | es-MX | pt-BR |
|---|---|---|---|---|
| Pronoun/register | casual-professional "you" | 您 (respectful), no slang | **usted** throughout (Mexican B2B norm) | **você** (Brazilian business standard; never "tu") |
| Tone | direct, friendly, data-forward | courteous, precise, relationship-first | warm but formal; full sentences | warm, personal, lightly informal warmth is OK |
| Greeting | "Hi {contact_first_name}," | "{contact_first_name}，您好：" | "Hola, {contact_first_name}:" (usted verbs) | "Olá, {contact_first_name}:" |
| Sign-off | "— {sender_name}, Greensheet" | "—— {sender_name}，Greensheet" | "— {sender_name}, Greensheet" | "— {sender_name}, Greensheet" |
| Emojis/exclamation | sparing | avoid in subject lines (deliverability + register) | sparing | sparing; warmth via wording not emoji |
| Numbers | 12,500 lbs | 12,500 磅 | 12,500 lb | 12.500 lb |

## 2. Coffee-trade terminology per locale

| EN | zh-CN | es-MX | pt-BR |
|---|---|---|---|
| green coffee / green beans | 生豆（咖啡生豆） | café verde | café verde |
| cupping | 杯测 | cata | degustação / prova |
| SCA cup score | SCA 杯测分数 | puntaje de taza SCA | pontuação de xícara SCA |
| washed | 水洗 | lavado | lavado |
| natural | 日晒 | natural | natural |
| honey | 蜜处理 | honey（行业通用） | honey（巴西亦称 cereja descascado，见 §4 备注） |
| anaerobic | 厌氧发酵 | anaeróbico | anaeróbico |
| varietal | 品种 | varietal | variedade（巴西业界用 variedade） |
| lot | 批次 | lote | lote |
| roaster (company) | 烘焙商 / 烘焙工坊 | tostador | torrador / torrefação |
| sample kit | 样品套装 | kit de muestras | kit de amostras |
| harvest (season) | 产季 / 采收季 | cosecha | **safra**（巴西专用词，不用 "colheita" 作营销语境） |
| single origin | 单一产地 | origen único | origem única |
| flavor notes | 风味描述 | notas de sabor | notas sensoriais |
| arrival (container) | 到港 | arribo | chegada |
| spot / available | 现货 | disponible | disponível / em estoque |
| Q grader | Q Grader（不译） | Q grader | Q grader |

Do-not-translate: **Greensheet**, **SCA**, **ESG**, **Q Grader**, **COF-001…005**, merge-tag names, URLs, brand certifications (**Rainforest Alliance**, Fair Trade 标志名可保留英文).

## 3. Campaign-by-campaign adaptation notes

### COF-001 — New harvest introduction
- **zh-CN:** Lead with the fact of arrival (新到港) and the SCA score; Chinese specialty buyers respond to 分数 + 产地 provenance. Avoid superlatives (see §6 — China Advertising Law bans 最佳/第一/顶级-type absolute claims). "{price_per_lb}/磅" pricing is fine; many CN buyers also think in kg — the lot page (not the email) carries the kg toggle.
- **es-MX:** "Recién llegado" framing works; keep usted verbs ("Puede catarlo antes de decidir"). Score first, price second.
- **pt-BR:** "Recém-chegado" + "Você pode provar antes de decidir". Brazilians respond well to the 48-hour sample promise — keep it in the body, not the subject (subject stays data-led).

### COF-002 — Sample kit invitation
- The offer ("free for qualified roasters") localizes as 符合条件的烘焙商可免费获取 / gratis para tostadores calificados / gratuito para torradores qualificados — do not over-promise; "qualified" criteria are set by sales, not marketing copy.
- **SMS (all locales):** ≤160 chars target, brand prefix first. Opt-out keyword is market-specific and pre-approved with the SMS vendor: US `STOP`, CN `退订回T`, MX `ALTO`, BR `SAIR` (already in `campaigns.sms.cof002.body`).

### COF-003 — Roaster case study
- Peer proof must be **market-plausible**: {peer_roaster_name} should be a roaster the segment recognizes — for zh-CN sends use a CN/Asia-Pacific reference roaster where consented; for es-MX a Mexican or LatAm roaster; for pt-BR a Brazilian roaster. If no consented local reference exists, fall back to the anonymized variant ("a specialty roaster in {market_region}") rather than a US name.
- Keep the sell-through metric ({order_volume_lbs} lbs in {sell_through_weeks} weeks) — concrete numbers outperform adjectives in all four markets.

### COF-004 — Availability update
- Urgency must stay **legitimate** (real remaining lbs, real arrival date) — required by CAN-SPAM truthfulness, MX consumer law, and good taste everywhere. Never fake scarcity; the merge tags must be fed live inventory values.
- **zh-CN:** "售完即止" framing is acceptable; still no absolute claims.
- **pt-BR:** "O próximo contêiner chega em {arrival_date}" — Brazilian buyers plan around container arrivals; keep that sentence prominent.
- **es-MX:** "los lotes reservados se envían primero" — reservation priority is the conversion lever; keep it explicit.

### COF-005 — Re-engagement & feedback
- Soft, question-led subject in every locale; this is a reply-bait email (replies boost sender reputation).
- **zh-CN:** offering "15 分钟与采购顾问聊聊" (a sourcing advisor call) converts better than a generic "contact us"; WeChat follow-up is the offline norm — sales adds the WeChat QR manually for high-value accounts (not in the automated template).
- **es-MX / pt-BR:** WhatsApp is the expected next step; CTA lands on a booking page with WhatsApp option.

## 4. Localized merge-tag content (render-time rules)

Merge tags inject **data**, and the data itself must be localized by the Notification Service before render:

| Tag | Localization rule |
|---|---|
| `{origin}` | via `catalog.origins.*` dictionary (Ethiopia → 埃塞俄比亚 / Etiopía / Etiópia); unknown origin → raw DB value |
| `{process_method}` | via `catalog.processMethods.*` (washed → 水洗 / Lavado / Lavado). pt-BR: when the lot is Brazilian pulped-natural, the value may render as "honey (cereja descascado)" — set per-lot in admin, not in templates |
| `{flavor_notes}` | map each note through the flavor glossary (04 doc) and join with `Intl.ListFormat` equivalent server-side (、 for zh, commas elsewhere) |
| `{sca_cup_score}` | one decimal max; never round 87.9 → 88 (misrepresentation) |
| `{price_per_lb}` | format per locale (§6 of 01 doc): `$4.85` en/es, `US$ 4,85` pt-BR, `4.85 美元` optional suffix zh; currency stays USD (trade norm) — never silently convert |
| `{available_lbs}`, `{order_volume_lbs}` | grouped digits per locale (12,500 / 12.500) |
| `{arrival_date}` | localized date (2025年4月2日 / 2 abr 2025 / 2 de abr. de 2025 / Apr 2, 2025) |
| `{harvest_window}` | localized season label (产季窗口 values like "2025 主产季" / "cosecha principal 2025" / "safra principal 2025") |
| `{peer_roaster_name}` | see COF-003 consent rule |
| `{contact_first_name}`, `{roaster_name}`, `{sender_name}` | verbatim from CRM; no transliteration |
| `{sample_kit_url}`, `{lot_url}`, `{unsubscribe_url}`, `{preferences_url}`, `{booking_url}` | always include the locale subpath (e.g. `/zh-CN/...`) |

## 5. Sending-time & cadence notes

| Market | Window (recipient local) | Notes |
|---|---|---|
| en-US | Tue–Thu, 9–11 a.m. | Roasters cup early morning; emails land post-cupping table |
| zh-CN | Tue–Thu, 9:30–11:30 a.m. (CST/Beijing) | Avoid Golden Week (Oct 1–7) & CNY week; deliverability via a CN-reachable ESP or dedicated domain warmup; QQ/163 inboxes throttle unknown senders |
| es-MX | Tue–Thu, 9–11 a.m. (CDMX) | Avoid Dec 12 (Guadalupe) week & Semana Santa for B2B sends |
| pt-BR | Tue–Thu, 9–11 a.m. (BRT) | Avoid Carnival week; BR roasters are active on WhatsApp — pair COF-005 with a WhatsApp follow-up task |

Cadence guardrails: max 1 marketing email/72 h per address across all campaigns; SMS only after email consent + explicit SMS opt-in; COF-004 suppresses automatically when `{available_lbs}` < 500 (urgency dies at near-zero stock).

## 6. Regulatory quick reference

| Market | Regime | Must-dos for COF-001–005 |
|---|---|---|
| US (en-US) | **CAN-SPAM** | Truthful subject lines; valid physical postal address in every email (`campaigns.emailFooter.postalAddress` — present in all locales); working unsubscribe honored ≤10 business days (we honor instantly); no harvested lists |
| China (zh-CN) | **PIPL** + Advertising Law + MIIT SMS rules | Consent (or documented legitimate B2B basis) for electronic marketing; PIPL data-localization review if PII leaves CN; SMS via approved 106 channel with 【signature】 prefix and 退订回T opt-out; **no absolute claims** (最佳、第一、100% 等) in ad copy; keep unsubscribe one-click |
| Mexico (es-MX) | **LFPDPPP** (data protection) + NOM-151 | Consent per aviso de privacidad (link in footer); honor ARCO rights; opt-out via ALTO keyword for SMS; commercial identification truthfulness per PROFECO |
| Brazil (pt-BR) | **LGPD** | Consent or legitimate-interest assessment recorded; easy opt-out (SAIR for SMS, one-click unsubscribe for email); DPO contact reachable; ANPD breach duties |
| EU edge cases (any locale) | **GDPR** + ePrivacy | If a list contains EU-based roasters: prior consent for B2B email in strict member states, DPA with the ESP, unsubscribe honored immediately, data-subject rights workflow — route through the same preference center |

Operational rules (all markets): every template carries `emailFooter.sentBecause` + working `{unsubscribe_url}` + `{preferences_url}`; suppression list is global across campaigns; locale of the footer/legal links follows the recipient locale, and legal pages themselves are professionally translated (not MT).
