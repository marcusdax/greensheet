# Greensheet — Email Campaign Visual System (COF-001 → COF-005)

**Version 1.0 · B2B Specialty Coffee Nurture Campaign · Aligned with `coffee-marketing-schema.sql` (campaigns, campaign_tokens, marketing_templates, automation_rules, rule_actions)**

Email is where the brand *is* the product: a Greensheet email should read like a beautifully typeset offer sheet that happens to arrive by SMTP. Every email is table-based, inline-CSS, 600 px, single-column, and legible with images blocked.

---

## 1. Sequence map (from the seeded schema)

| Rule | Channel | Trigger (`automation_rules.trigger_event`) | Role | Key tokens |
|---|---|---|---|---|
| **COF-001** | Email — Touch 1 | `campaign.enrolled` (importer/roaster enters nurture) | "Your sheet has arrived" — platform intro + first lot offer | `{roaster_name}`, `{origin}` |
| **COF-002** | Email — Touch 2 | `sample_kit.delivered` (+4 days) | Sample kit follow-up: cupping guidance + lot detail | `{roaster_name}`, `{origin}`, `{process_method}`, `{elevation}` |
| **COF-003** | Email — Touch 3 | `feedback.submitted` (or +10 days fallback) | Cup-score report + comparable lots + sourcing CTA | `{sca_cup_score}`, `{origin}`, `{process_method}`, `{lot_price}` |
| **COF-004** | SMS — consultative | `portal.link_clicked` / no-open branch | 160-char consultative nudge, human voice, no images | `{roaster_name}`, `{origin}`, `{rep_first_name}` |
| **COF-005** | System — suppression & CRM | `order.created` / `unsubscribe` / 3× no-engagement | `EXECUTE_CAMPAIGN_HALT`, `UPDATE_CRM_LIFECYCLE`, log to `campaign_execution_logs` | — (internal) |

A/B: `marketing_templates.subject_variant_a` vs `subject_variant_b` per template; winning variant renders the gold `★ Winner` badge in the Campaign Intelligence dashboard (§7.3 of component doc). **Visual system is invariant across A/B — only subject line and H1 copy may vary.**

---

## 2. Layout grid & anatomy

```
┌─────────────────────────── 600px ───────────────────────────┐
│ PREHEADER (hidden, 90–110 chars, serif-italic voice)        │
├─────────────────────────────────────────────────────────────┤
│ HEADER BAND — navy-700 #16323E, 72px                        │
│   Lot Compass PNG (40px) + "Greensheet" wordmark (parchment)│
├─────────────────────────────────────────────────────────────┤
│ BODY — parchment-100 #F6F1E7 outer; inner card              │
│   #FDFBF5, 32px padding, radius 0 (emails don't round)      │
│   • overline (11px, +0.12em, muted)                         │
│   • H1 Fraunces/Georgia 30px/1.25 navy                      │
│   • body Archivo/Helvetica 16px/1.6 ink                     │
│   • optional: lot sheet table / score seal / quote          │
│   • bulletproof CTA button                                  │
├─────────────────────────────────────────────────────────────┤
│ ENDORSEMENT STRIP — hairline + "Greensheet · by ODASI"      │
├─────────────────────────────────────────────────────────────┤
│ FOOTER — roast-700 #4A3527 band, parchment-50 text          │
│   address · unsubscribe · preference center · COF rule id   │
└─────────────────────────────────────────────────────────────┘
```

| Grid rule | Value |
|---|---|
| Container | 600 px table, `width:100%; max-width:600px` fluid-hybrid |
| Outer gutter | 0 on mobile (card goes edge-to-edge), 16 px padding ≥ 480 px |
| Body padding | 32 px desktop / 20 px ≤ 480 px (media query) |
| Vertical rhythm | 24 px between blocks; 16 px within blocks; 8 px inside chips/badges |
| Type scale (email-safe) | overline 11 px · caption 13 px · body 16 px · lead 19 px · H2 24 px · H1 30 px |
| Font stacks | Display: `'Fraunces', Georgia, 'Times New Roman', serif` (Fraunces via `@import` with silent Georgia fallback) · Body: `Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif` · Mono/figures: `'IBM Plex Mono', 'Courier New', Courier, monospace` |
| Images | header lockup PNG @2× (1200×240 exported, displayed 600×120 incl. band); alt text mandatory; email must fully read with images off (MSO `<!--[if mso]>` text fallback block) |
| Radii | 0 in email clients (Outlook strips radius on tables); chips/seals use images or VML roundrect when radius matters |
| Buttons | bulletproof: VML `roundrect` for MSO + `<a>` for all others, 44 px min height |

**Emails never round outer corners, never use shadows, never use gradients.** The sheet is paper; paper is flat.

---

## 3. Header & footer lockups

### 3.1 Header (navy band)

- Band: `bgcolor="#16323E"`, height 72 px, full 600 px width.
- Lockup (image-on): Lot Compass 40 px + 12 px gap + "Greensheet" in Fraunces 24 px parchment `#FDFBF5`, single PNG @2× for crispness, `alt="Greensheet — Specialty Green Coffee Sourcing"`.
- Lockup (images-off / MSO fallback): text rendition — "GREENSHEET" Georgia bold 20 px parchment, letterspacing 2 px, on the same navy band; never show a broken-image icon.
- The Lot Stamp (§2.3 of identity doc) may appear rotated −5° at the right edge of the band at 64 px, `opacity 0.85`, in COF-002/003 only (tactile "kit" moments) — as a PNG with transparent bg.

### 3.2 Endorsement strip

1 px hairline `#D8CFBB`, then 12 px caption: `Greensheet · by ODASI` — Archivo/Arial 600, `letter-spacing:1.5px`, `color:#5C5546`. Optional ODASI tagline line in Georgia italic 13 px: *"Navigate your reality. Own your journey."* (COF-001 and COF-003 only).

### 3.3 Footer (roast band)

- `bgcolor="#4A3527"`, padding 24/32, text `color:#FDFBF5` 13 px/1.6 (11.09:1 AAA ✓).
- Line 1: sender identity `{company_name}` · physical address (CAN-SPAM).
- Line 2: `Unsubscribe` · `Email preferences` · `View in browser` — underlined `#D4B96A` links (5.98:1 on roast AA ✓), never light-gray-on-white microtext.
- Line 3 (compliance, `color:#B9AE97`, 11 px): rule id + suppression note, e.g. "You're receiving COF-002 because a sample kit was delivered to {roaster_name}. One reply ends the sequence."

---

## 4. Merge-tag (token) styling

Tokens from `campaign_tokens` dictionary. Three renditions of the same tag:

| Context | Rendition |
|---|---|
| **Template editor (in-app)** | mono chip: `bg-teal-100 text-teal-700 radius-sm padding 2/6`, e.g. `{sca_cup_score}` — click to see tooltip + fallback value |
| **Rendered email (HTML part)** | value set in `'IBM Plex Mono','Courier New',monospace` **bold** for figures (scores, prices, elevations, dates); names/origins in body serif/sans as prose. Figures always carry their unit: `1,850 masl`, `86.5 pts`, `$5.20/lb` |
| **Plaintext part / SMS (COF-004)** | raw value, no markup; scores written `86.5pt` |

| Token | Format rule | Fallback when NULL |
|---|---|---|
| `{roaster_name}` | Title Case as stored | `"there"` → "Hi there," |
| `{origin}` | as stored | `"this lot"` |
| `{process_method}` | lowercase (washed / natural / honey / anaerobic) | omit clause |
| `{elevation}` | `1,850 masl` (thousands separator) | omit clause |
| `{sca_cup_score}` | one decimal + ` pts`, rendered as Cup Score seal (§5) | omit seal block entirely |
| `{lot_price}` | `$5.20/lb`, 2 decimals | omit price row |
| `{rep_first_name}` | sender profile | `"Greensheet"` |

**Null-token law:** a template must still parse as a graceful sentence with every token at fallback. Templates failing null-render preview cannot be activated (enforced in the editor, mirrored in `automation_rules.conditions_json` QA).

---

## 5. Signature email components

### 5.1 Cup Score seal (HTML, no image)

A 64×64 px table cell, `bgcolor` by SCA tier (`#C9A34A` 90+, `#2A6E73` 85+, `#3E6B50` 80+, `#5C5546` <80), centered mono bold 20 px numeral + 9 px "SCA CUP" overline beneath, white text except ink `#221D16` on gold. For MSO, wrapped in VML `oval` so it renders circular in Outlook; elsewhere `border-radius:50%` on the cell.

### 5.2 Lot sheet table

The email-native lot card: 2 px header rule `#16323E`, rows 36 px, zebra `#FDFBF5`/`#EFE8DA`, right-aligned mono figures, columns Lot · Process · Cup · $/lb · lbs. Max 4 rows + "View all 23 lots →" teal link. This table is the visual rhyme with the in-app catalog (§5 of component doc).

### 5.3 CTA button

Primary: `bgcolor="#16323E"`, text `#FDFBF5` 16 px/600, padding 14/28, VML `roundrect arcsize="12%"` for Outlook. One primary CTA per email. Secondary actions are underlined teal text links (`#1F4F54`, 8.09:1 on parchment AAA ✓).

---

## 6. Dark-mode email fallbacks

Reality: Gmail app (iOS/Android) ignores `prefers-color-scheme` and auto-inverts; Apple Mail and Outlook.com honor it partially. Strategy — **design once, survive both:**

1. **Fixed-color zones:** navy header band and roast footer band are declared with `bgcolor` + `background-color` and contain only light text — they read identically in both modes (this is intentional; they are the brand frame).
2. **Adaptive zone:** the parchment body card declares light values plus a `@media (prefers-color-scheme: dark)` override to dark tokens, with `[data-ogsc]`/`.gmail` guards noted below:

| Element | Light (declared) | Dark override (`prefers-color-scheme: dark`) |
|---|---|---|
| Outer canvas | `#F6F1E7` | `#101B23` |
| Body card | `#FDFBF5` | `#1B2933` |
| H1 / body text | `#16323E` / `#221D16` | `#EFE9DB` |
| Muted text | `#5C5546` | `#A9A08C` |
| Hairlines | `#D8CFBB` | `#3A4B57` |
| Lot table zebra | `#EFE8DA` | `#22333F` |
| CTA button | navy `#16323E` / parchment text | teal-300 `#7FB6BA` / `#101B23` text (7.73:1 AAA ✓) |
| Score seals | tier colors unchanged (all verified ≥ 4.5:1 with their text) | unchanged |
| Links | `#1F4F54` | `#7FB6BA` |

3. **Outlook.com:** duplicate every dark override with `[data-ogsc]` attribute selectors.
4. **Gmail auto-invert defense:** no pure-black text (our ink `#221D16` inverts acceptably); transparent PNGs are placed only on declared-color bands; the compass lockup PNG ships with its own navy chip background so inversion can't orphan it; meta tags `<meta name="color-scheme" content="light dark">` + `supported-color-schemes` declared.
5. **Test matrix before every send:** Apple Mail dark, Gmail web dark, Gmail Android (auto-invert), Outlook 2016/365 Win (MSO), Outlook.com dark, plain-text part review.

---

## 7. Template example 1 — COF-002 "Sample kit follow-up" (complete HTML)

Trigger: `sample_kit.delivered` + 4 days · Subject A: `Your {origin} samples are cupped — here's what to look for` · Subject B: `{roaster_name}, your {process_method} lot is ready to score`

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your sample kit has landed — Greensheet</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Archivo:wght@400;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap');

  html, body { margin:0; padding:0; }
  img { border:0; line-height:100%; text-decoration:none; }
  a { text-decoration:underline; }

  @media only screen and (max-width:479px) {
    .container { width:100% !important; }
    .card-pad  { padding:24px 20px !important; }
    .h1        { font-size:26px !important; line-height:32px !important; }
  }

  /* ===== Dark mode overrides (Apple Mail, Outlook.com via [data-ogsc]) ===== */
  @media (prefers-color-scheme: dark) {
    .gs-canvas   { background-color:#101B23 !important; }
    .gs-card     { background-color:#1B2933 !important; }
    .gs-h1       { color:#EFE9DB !important; }
    .gs-body     { color:#EFE9DB !important; }
    .gs-muted    { color:#A9A08C !important; }
    .gs-hairline { background-color:#3A4B57 !important; }
    .gs-zebra    { background-color:#22333F !important; }
    .gs-cta-bg   { background-color:#7FB6BA !important; }
    .gs-cta-txt  { color:#101B23 !important; }
    .gs-link     { color:#7FB6BA !important; }
  }
  [data-ogsc] .gs-canvas   { background-color:#101B23 !important; }
  [data-ogsc] .gs-card     { background-color:#1B2933 !important; }
  [data-ogsc] .gs-h1       { color:#EFE9DB !important; }
  [data-ogsc] .gs-body     { color:#EFE9DB !important; }
  [data-ogsc] .gs-muted    { color:#A9A08C !important; }
  [data-ogsc] .gs-zebra    { background-color:#22333F !important; }
  [data-ogsc] .gs-cta-bg   { background-color:#7FB6BA !important; }
  [data-ogsc] .gs-cta-txt  { color:#101B23 !important; }
  [data-ogsc] .gs-link     { color:#7FB6BA !important; }
</style>
</head>

<body class="gs-canvas" style="margin:0; padding:0; word-spacing:normal; background-color:#F6F1E7;">

<!-- Preheader: hidden -->
<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  Your {origin} {process_method} kit is on the cupping table — tasting notes, score sheet, and next steps inside.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="gs-canvas" style="background-color:#F6F1E7;">
<tr><td align="center" style="padding:0;">

  <!-- ================= HEADER BAND ================= -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px;">
    <tr>
      <td bgcolor="#16323E" style="background-color:#16323E; padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="40" valign="middle">
              <img src="https://assets.greensheet.co/email/compass-parchment-80.png" width="40" height="40" alt="Greensheet compass mark" style="display:block; width:40px; height:40px;">
            </td>
            <td valign="middle" style="padding-left:12px; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-size:24px; line-height:28px; color:#FDFBF5;">
              Greensheet
              <div style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#A9A08C; padding-top:2px;">SPECIALTY GREEN COFFEE</div>
            </td>
            <td align="right" valign="middle" width="72">
              <img src="https://assets.greensheet.co/email/lot-stamp-144.png" width="64" height="64" alt="" style="display:block; width:64px; height:64px; opacity:0.85;">
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= BODY CARD ================= -->
    <tr>
      <td class="gs-card card-pad" bgcolor="#FDFBF5" style="background-color:#FDFBF5; padding:32px;">

        <div class="gs-muted" style="font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">
          Sample kit · Delivered 4 days ago
        </div>

        <h1 class="h1 gs-h1" style="margin:12px 0 0; font-family:'Fraunces',Georgia,'Times New Roman',serif; font-weight:560; font-size:30px; line-height:38px; color:#16323E;">
          The kettle's had its four days, {roaster_name}.
        </h1>

        <p class="gs-body" style="margin:16px 0 0; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#221D16;">
          Your sample kit for <strong>{origin}</strong> — a {process_method} lot grown at
          <span style="font-family:'IBM Plex Mono','Courier New',Courier,monospace; font-weight:700;">{elevation}</span> —
          should be rested and ready. When you cup it, lead with the dry fragrance: this lot's
          jasmine and cane-sugar notes show earliest there.
        </p>

        <!-- Cupping guidance block -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;">
          <tr>
            <td class="gs-zebra" bgcolor="#EFE8DA" style="background-color:#EFE8DA; padding:16px 20px; border-left:3px solid #2A6E73;">
              <div class="gs-muted" style="font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Suggested cupping protocol</div>
              <p class="gs-body" style="margin:8px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#221D16;">
                93&nbsp;°C water · 1:16.67 ratio · 4-minute steep, break, and skim.
                Score fragrance, flavor, and acidity hot; body and balance as it cools.
                Log scores in the portal — your sheet updates the moment you submit.
              </p>
            </td>
          </tr>
        </table>

        <!-- Bulletproof CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
          <tr>
            <td align="center" class="gs-cta-bg" bgcolor="#16323E" style="background-color:#16323E;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://app.greensheet.co/kits/{kit_id}/score" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" fillcolor="#16323E" stroke="f">
                <center style="color:#FDFBF5;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Log Your Cup Scores</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="https://app.greensheet.co/kits/{kit_id}/score" class="gs-cta-txt"
                 style="display:inline-block; padding:14px 28px; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#FDFBF5; text-decoration:none;">
                Log Your Cup Scores
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px;">
          <a href="https://app.greensheet.co/lots/{lot_id}" class="gs-link" style="color:#1F4F54;">View the full lot sheet for {origin} →</a>
        </p>

        <!-- Hairline + sign-off -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
          <tr><td class="gs-hairline" bgcolor="#D8CFBB" height="1" style="background-color:#D8CFBB; font-size:1px; line-height:1px;">&nbsp;</td></tr>
        </table>
        <p class="gs-muted" style="margin:16px 0 0; font-family:Georgia,serif; font-style:italic; font-size:14px; line-height:22px; color:#5C5546;">
          Questions on protocol? Reply to this email — a Q grader reads every one.<br>
          — {rep_first_name}, Greensheet
        </p>
      </td>
    </tr>

    <!-- ================= ENDORSEMENT STRIP ================= -->
    <tr>
      <td class="gs-card" bgcolor="#FDFBF5" style="background-color:#FDFBF5; padding:0 32px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td class="gs-hairline" bgcolor="#D8CFBB" height="1" style="background-color:#D8CFBB; font-size:1px; line-height:1px;">&nbsp;</td></tr>
          <tr>
            <td class="gs-muted" style="padding-top:12px; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:12px; font-weight:600; letter-spacing:1.5px; color:#5C5546;">
              GREENSHEET · BY ODASI
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= FOOTER BAND ================= -->
    <tr>
      <td bgcolor="#4A3527" style="background-color:#4A3527; padding:24px 32px;">
        <p style="margin:0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#FDFBF5;">
          {company_name} · {street_address} · {city}, {state} {zip}
        </p>
        <p style="margin:8px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px;">
          <a href="{unsubscribe_url}" style="color:#D4B96A;">Unsubscribe</a> &nbsp;·&nbsp;
          <a href="{preferences_url}" style="color:#D4B96A;">Email preferences</a> &nbsp;·&nbsp;
          <a href="{view_in_browser_url}" style="color:#D4B96A;">View in browser</a>
        </p>
        <p style="margin:12px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; line-height:18px; color:#B9AE97;">
          You're receiving COF-002 because a sample kit was delivered to {roaster_name}.
          One reply or one click ends the sequence — no hard feelings, no dark patterns.
        </p>
      </td>
    </tr>
  </table>

</td></tr>
</table>
</body>
</html>
```

---

## 8. Template example 2 — COF-003 "Cup-score report + comparable lots" (complete HTML)

Trigger: `feedback.submitted` · Subject A: `Your {origin} scored {sca_cup_score} — three lots cupping in the same range` · Subject B: `{sca_cup_score} points. Here's what else is on the sheet.`

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Your cup-score report — Greensheet</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Archivo:wght@400;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap');

  html, body { margin:0; padding:0; }
  img { border:0; line-height:100%; }
  a { text-decoration:underline; }

  @media only screen and (max-width:479px) {
    .container { width:100% !important; }
    .card-pad  { padding:24px 20px !important; }
    .h1        { font-size:26px !important; line-height:32px !important; }
    .lot-table td, .lot-table th { padding:8px 6px !important; font-size:13px !important; }
    .hide-sm   { display:none !important; }
  }

  @media (prefers-color-scheme: dark) {
    .gs-canvas   { background-color:#101B23 !important; }
    .gs-card     { background-color:#1B2933 !important; }
    .gs-h1       { color:#EFE9DB !important; }
    .gs-body     { color:#EFE9DB !important; }
    .gs-muted    { color:#A9A08C !important; }
    .gs-hairline { background-color:#3A4B57 !important; }
    .gs-zebra    { background-color:#22333F !important; }
    .gs-cta-bg   { background-color:#7FB6BA !important; }
    .gs-cta-txt  { color:#101B23 !important; }
    .gs-link     { color:#7FB6BA !important; }
    .gs-rule     { border-color:#3A4B57 !important; }
  }
  [data-ogsc] .gs-canvas   { background-color:#101B23 !important; }
  [data-ogsc] .gs-card     { background-color:#1B2933 !important; }
  [data-ogsc] .gs-h1       { color:#EFE9DB !important; }
  [data-ogsc] .gs-body     { color:#EFE9DB !important; }
  [data-ogsc] .gs-muted    { color:#A9A08C !important; }
  [data-ogsc] .gs-zebra    { background-color:#22333F !important; }
  [data-ogsc] .gs-cta-bg   { background-color:#7FB6BA !important; }
  [data-ogsc] .gs-cta-txt  { color:#101B23 !important; }
  [data-ogsc] .gs-link     { color:#7FB6BA !important; }
</style>
</head>

<body class="gs-canvas" style="margin:0; padding:0; word-spacing:normal; background-color:#F6F1E7;">

<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  {origin} came back at {sca_cup_score} pts — see the full sheet and three comparable lots.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="gs-canvas" style="background-color:#F6F1E7;">
<tr><td align="center" style="padding:0;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px;">

    <!-- ================= HEADER BAND ================= -->
    <tr>
      <td bgcolor="#16323E" style="background-color:#16323E; padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="40" valign="middle">
              <img src="https://assets.greensheet.co/email/compass-parchment-80.png" width="40" height="40" alt="Greensheet compass mark" style="display:block; width:40px; height:40px;">
            </td>
            <td valign="middle" style="padding-left:12px; font-family:'Fraunces',Georgia,serif; font-size:24px; line-height:28px; color:#FDFBF5;">
              Greensheet
              <div style="font-family:Archivo,Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#A9A08C; padding-top:2px;">CUP-SCORE REPORT</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= BODY CARD ================= -->
    <tr>
      <td class="gs-card card-pad" bgcolor="#FDFBF5" style="background-color:#FDFBF5; padding:32px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td valign="middle">
              <div class="gs-muted" style="font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">
                Score verified · {origin} · {process_method}
              </div>
              <h1 class="h1 gs-h1" style="margin:12px 0 0; font-family:'Fraunces',Georgia,serif; font-weight:560; font-size:30px; line-height:38px; color:#16323E;">
                {sca_cup_score} — officially Outstanding, {roaster_name}.
              </h1>
            </td>
            <!-- Cup Score seal: gold tier (90+) — swap bgcolor per tier map in §5.1 -->
            <td width="72" align="right" valign="top">
              <!--[if mso]>
              <v:oval xmlns:v="urn:schemas-microsoft-com:vml" style="width:64px;height:64px;" fillcolor="#C9A34A" strokecolor="#16323E" strokeweight="1.5pt">
                <center style="color:#221D16;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;">90.5</center>
              </v:oval>
              <![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle" width="64" height="64" bgcolor="#C9A34A"
                      style="width:64px; height:64px; background-color:#C9A34A; border:2px solid #16323E; border-radius:50%;">
                    <span style="font-family:'IBM Plex Mono','Courier New',Courier,monospace; font-size:18px; font-weight:700; color:#221D16;">{sca_cup_score}</span>
                  </td>
                </tr>
                <tr><td align="center" style="padding-top:4px; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:9px; letter-spacing:1.5px; color:#5C5546;">SCA&nbsp;CUP</td></tr>
              </table>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <p class="gs-body" style="margin:16px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#221D16;">
          Your submitted scores are in, and the composite holds at
          <span style="font-family:'IBM Plex Mono','Courier New',Courier,monospace; font-weight:700;">{sca_cup_score} pts</span>.
          Lots in this band move quickly — positions at this quality typically close within two weeks
          of the sheet date. Three comparable lots currently on the board:
        </p>

        <!-- ===== Lot sheet table (§5.2) ===== -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="lot-table" style="margin:24px 0 0; border-collapse:collapse;">
          <tr>
            <th align="left"  class="gs-muted" style="padding:10px 8px; border-bottom:2px solid #16323E; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Lot</th>
            <th align="left"  class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:2px solid #16323E; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Process</th>
            <th align="right" class="gs-muted" style="padding:10px 8px; border-bottom:2px solid #16323E; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Cup</th>
            <th align="right" class="gs-muted" style="padding:10px 8px; border-bottom:2px solid #16323E; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">$/lb</th>
            <th align="right" class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:2px solid #16323E; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">lbs</th>
          </tr>
          <!-- row: zebra surface -->
          <tr>
            <td class="gs-body" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#221D16;">Huila, Colombia — Pink Bourbon</td>
            <td class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">washed</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#1F4F54;">88.5</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#221D16;">6.10</span></td>
            <td align="right" class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#5C5546;">2,640</span></td>
          </tr>
          <!-- row: zebra recessed -->
          <tr class="gs-zebra" bgcolor="#EFE8DA" style="background-color:#EFE8DA;">
            <td class="gs-body" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#221D16;">Yirgacheffe, Ethiopia — Heirloom</td>
            <td class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">natural</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#1F4F54;">87.0</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#221D16;">5.75</span></td>
            <td align="right" class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#5C5546;">1,320</span></td>
          </tr>
          <tr>
            <td class="gs-body" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#221D16;">Tarrazú, Costa Rica — Caturra</td>
            <td class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">honey</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#1F4F54;">86.5</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#221D16;">5.20</span></td>
            <td align="right" class="gs-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D8CFBB;"><span style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:14px; color:#5C5546;">3,960</span></td>
          </tr>
        </table>

        <p style="margin:12px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px;">
          <a href="https://app.greensheet.co/catalog?cup_min=86" class="gs-link" style="color:#1F4F54;">View all 23 lots in this range →</a>
        </p>

        <!-- Bulletproof CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
          <tr>
            <td align="center" class="gs-cta-bg" bgcolor="#16323E" style="background-color:#16323E;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://app.greensheet.co/lots/{lot_id}/source" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="12%" fillcolor="#16323E" stroke="f">
                <center style="color:#FDFBF5;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Reserve Your Position on {origin}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="https://app.greensheet.co/lots/{lot_id}/source" class="gs-cta-txt"
                 style="display:inline-block; padding:14px 28px; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#FDFBF5; text-decoration:none;">
                Reserve Your Position on {origin}
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
          <tr><td class="gs-hairline" bgcolor="#D8CFBB" height="1" style="background-color:#D8CFBB; font-size:1px; line-height:1px;">&nbsp;</td></tr>
        </table>
        <p class="gs-muted" style="margin:16px 0 0; font-family:Georgia,serif; font-style:italic; font-size:13px; line-height:21px; color:#5C5546;">
          Navigate your reality. Own your journey. — ODASI Technologies
        </p>
      </td>
    </tr>

    <!-- ================= FOOTER BAND ================= -->
    <tr>
      <td bgcolor="#4A3527" style="background-color:#4A3527; padding:24px 32px;">
        <p style="margin:0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#FDFBF5;">
          {company_name} · {street_address} · {city}, {state} {zip}
        </p>
        <p style="margin:8px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px;">
          <a href="{unsubscribe_url}" style="color:#D4B96A;">Unsubscribe</a> &nbsp;·&nbsp;
          <a href="{preferences_url}" style="color:#D4B96A;">Email preferences</a> &nbsp;·&nbsp;
          <a href="{view_in_browser_url}" style="color:#D4B96A;">View in browser</a>
        </p>
        <p style="margin:12px 0 0; font-family:Archivo,Helvetica,Arial,sans-serif; font-size:11px; line-height:18px; color:#B9AE97;">
          You're receiving COF-003 because {roaster_name} submitted cupping feedback.
          Positions and scores shown are live at send time; inventory changes without notice — that's the market, not a gimmick.
        </p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>
```

---

## 9. COF-004 SMS visual/copy system (for completeness)

SMS has no layout — typography and tokens carry the brand: 160 chars max, one merge tag minimum, figures in plain numerals, no emojis, no link shorteners (full `greensheet.co` domain for trust).

> `Hi {roaster_name} — {rep_first_name} at Greensheet. The {origin} you cupped is holding at 86.5pt and 3,960 lbs remain on the sheet. Want me to hold a position while you decide? greensheet.co/lots/{lot_id}`

## 10. Pre-flight checklist (per template, enforced in editor)

- [ ] Preheader 90–110 chars, no markup, differs from subject
- [ ] Subject A/B both ≤ 60 chars, token fallbacks produce valid sentences
- [ ] Full render with **images blocked** (text fallback lockup visible)
- [ ] Full render with **all tokens NULL** (null-token law, §4)
- [ ] Dark-mode pass: Apple Mail dark + Gmail auto-invert screenshot
- [ ] All link/button text contrast ≥ 4.5:1 in both modes (values pre-verified in §6)
- [ ] MSO render: VML button + seal render, no broken tables in Outlook 2016+
- [ ] Footer carries rule id (COF-00x), physical address, working `{unsubscribe_url}`
- [ ] Plain-text part reviewed — merge tags resolve, figures carry units
- [ ] `campaign_execution_logs` write verified on test send (compliance ledger)
