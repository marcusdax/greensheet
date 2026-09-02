# Auctum Ledger — Email Campaign Visual System (COF-001 → COF-005)

**Version 1.0 · B2B Specialty Coffee Nurture Campaign · Aligned with `coffee-marketing-schema.sql` (campaigns, campaign_tokens, marketing_templates, automation_rules, rule_actions)**

Email is where the brand *is* the product: an Auctum Ledger (formerly Greensheet) email should read like a beautifully typeset offer sheet that happens to arrive by SMTP. Every email is table-based, inline-CSS, 600 px, single-column, and legible with images blocked.

---

## 1. Sequence map (from the seeded schema)

| Rule | Channel | Trigger (`automation_rules.trigger_event`) | Role | Key tokens |
|---|---|---|---|---|
| **COF-001** | Email — Touch 1 | `campaign.enrolled` (importer/roaster enters nurture) | "Your sheet has arrived" — platform intro + first lot offer | `{roaster_name}`, `{origin}` |
| **COF-002** | Email — Touch 2 | `sample_kit.delivered` (+4 days) | Sample kit follow-up: cupping guidance + lot detail | `{roaster_name}`, `{origin}`, `{process_method}`, `{elevation}` |
| **COF-003** | Email — Touch 3 | `feedback.submitted` (or +10 days fallback) | Cup-score report + comparable lots + sourcing CTA | `{sca_cup_score}`, `{origin}`, `{process_method}`, `{lot_price}` |
| **COF-004** | SMS — consultative | `portal.link_clicked` / no-open branch | 160-char consultative nudge, human voice, no images | `{roaster_name}`, `{origin}`, `{rep_first_name}` |
| **COF-005** | System — suppression & CRM | `order.created` / `unsubscribe` / 3× no-engagement | `EXECUTE_CAMPAIGN_HALT`, `UPDATE_CRM_LIFECYCLE`, log to `campaign_execution_logs` | — (internal) |

A/B: `marketing_templates.subject_variant_a` vs `subject_variant_b` per template; winning variant renders the brass `★ Winner` badge in the Campaign Intelligence dashboard (§7.3 of component doc). **Visual system is invariant across A/B — only subject line and H1 copy may vary.**

---

## 2. Layout grid & anatomy

```
┌─────────────────────────── 600px ───────────────────────────┐
│ PREHEADER (hidden, 90–110 chars, serif-italic voice)        │
├─────────────────────────────────────────────────────────────┤
│ HEADER BAND — ink-900 #221E1B, 72px                        │
│   Auctum seal PNG (40px) + "Auctum Ledger" wordmark (paper)│
├─────────────────────────────────────────────────────────────┤
│ BODY — paper-100 #F5F2EB outer; inner card              │
│   #FAF9F4, 32px padding, radius 0 (emails don't round)      │
│   • overline (11px, +0.12em, muted)                         │
│   • H1 Playfair Display/Georgia 30px/1.25 ink                       │
│   • body Inter/Helvetica 16px/1.6 ink                     │
│   • optional: lot sheet table / score seal / quote          │
│   • bulletproof CTA button                                  │
├─────────────────────────────────────────────────────────────┤
│ ENDORSEMENT STRIP — hairline + "Auctum Ledger · by Auctum"      │
├─────────────────────────────────────────────────────────────┤
│ FOOTER — ink-900 #221E1B band, paper-50 text          │
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
| Font stacks | Display: `'Playfair Display', Georgia, 'Times New Roman', serif` (Playfair Display via `@import` with silent Georgia fallback) · Body: `Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif` · Mono/figures: `'JetBrains Mono', 'Courier New', Courier, monospace` |
| Images | header lockup PNG @2× (1200×240 exported, displayed 600×120 incl. band); alt text mandatory; email must fully read with images off (MSO `<!--[if mso]>` text fallback block) |
| Radii | 0 in email clients (Outlook strips radius on tables); chips/seals use images or VML roundrect when radius matters |
| Buttons | bulletproof: VML `roundrect` for MSO + `<a>` for all others, 44 px min height |

**Emails never round outer corners, never use shadows, never use gradients.** The sheet is paper; paper is flat.

---

## 3. Header & footer lockups

### 3.1 Header (ink band)

- Band: `bgcolor="#221E1B"`, height 72 px, full 600 px width.
- Lockup (image-on): Auctum seal 40 px + 12 px gap + "Auctum Ledger" in Playfair Display 24 px paper `#FAF9F4`, single PNG @2× for crispness, `alt="Auctum Ledger — Specialty Green Coffee Sourcing"`.
- Lockup (images-off / MSO fallback): text rendition — "AUCTUM LEDGER" Georgia bold 20 px paper, letterspacing 2 px, on the same ink band; never show a broken-image icon.
- The Verification Seal (§2.3 of identity doc) may appear rotated −5° at the right edge of the band at 64 px, `opacity 0.85`, in COF-002/003 only (tactile "kit" moments) — as a PNG with transparent bg.

### 3.2 Endorsement strip

1 px hairline `#D9D3C9`, then 12 px caption: `Auctum Ledger · by Auctum` — Inter/Arial 600, `letter-spacing:1.5px`, `color:#5C5546`. Optional Auctum tagline line in Georgia italic 13 px: *"Value is co-created, not extracted."* (COF-001 and COF-003 only).

### 3.3 Footer (ink band)

- `bgcolor="#221E1B"`, padding 24/32, text `color:#FAF9F4` 13 px/1.6 (15.69:1 AAA ✓).
- Line 1: sender identity `{company_name}` · physical address (CAN-SPAM).
- Line 2: `Unsubscribe` · `Email preferences` · `View in browser` — underlined `#C9A86A` links (7.32:1 on ink AAA ✓), never light-gray-on-white microtext.
- Line 3 (compliance, `color:#B9AE97`, 11 px): rule id + suppression note, e.g. "You're receiving COF-002 because a sample kit was delivered to {roaster_name}. One reply ends the sequence."

---

## 4. Merge-tag (token) styling

Tokens from `campaign_tokens` dictionary. Three renditions of the same tag:

| Context | Rendition |
|---|---|
| **Template editor (in-app)** | mono chip: `bg-oxblood-100 text-oxblood-800 radius-sm padding 2/6`, e.g. `{sca_cup_score}` — click to see tooltip + fallback value |
| **Rendered email (HTML part)** | value set in `'JetBrains Mono','Courier New',monospace` **bold** for figures (scores, prices, elevations, dates); names/origins in body serif/sans as prose. Figures always carry their unit: `1,850 masl`, `86.5 pts`, `$5.20/lb` |
| **Plaintext part / SMS (COF-004)** | raw value, no markup; scores written `86.5pt` |

| Token | Format rule | Fallback when NULL |
|---|---|---|
| `{roaster_name}` | Title Case as stored | `"there"` → "Hi there," |
| `{origin}` | as stored | `"this lot"` |
| `{process_method}` | lowercase (washed / natural / honey / anaerobic) | omit clause |
| `{elevation}` | `1,850 masl` (thousands separator) | omit clause |
| `{sca_cup_score}` | one decimal + ` pts`, rendered as Cup Score seal (§5) | omit seal block entirely |
| `{lot_price}` | `$5.20/lb`, 2 decimals | omit price row |
| `{rep_first_name}` | sender profile | `"Auctum Ledger"` |

**Null-token law:** a template must still parse as a graceful sentence with every token at fallback. Templates failing null-render preview cannot be activated (enforced in the editor, mirrored in `automation_rules.conditions_json` QA).

---

## 5. Signature email components

### 5.1 Cup Score seal (HTML, no image)

A 64×64 px table cell, `bgcolor` by CQI tier (`#C9A86A` 90+, `#74362F` 85+, `#4F6958` 80+, `#5C5546` <80), centered mono bold 20 px numeral + 9 px "CQI CUP" overline beneath, white text except ink `#221E1B` on brass-300. For MSO, wrapped in VML `oval` so it renders circular in Outlook; elsewhere `border-radius:50%` on the cell.

### 5.2 Lot sheet table

The email-native lot card: 2 px header rule `#221E1B`, rows 36 px, zebra `#FAF9F4`/`#EDE7DA`, right-aligned mono figures, columns Lot · Process · Cup · $/lb · lbs. Max 4 rows + "View all 23 lots →" oxblood link. This table is the visual rhyme with the in-app catalog (§5 of component doc).

### 5.3 CTA button

Primary: `bgcolor="#74362F"` (oxblood), text `#FAF9F4` 16 px/600 (8.62:1 AAA ✓), padding 14/28, VML `roundrect arcsize="12%"` for Outlook. One primary CTA per email. Secondary actions are underlined oxblood text links (`#74362F`, 8.13:1 on paper AAA ✓).

---

## 6. Dark-mode email fallbacks

Reality: Gmail app (iOS/Android) ignores `prefers-color-scheme` and auto-inverts; Apple Mail and Outlook.com honor it partially. Strategy — **design once, survive both:**

1. **Fixed-color zones:** the ink header and footer bands are declared with `bgcolor` + `background-color` and contain only light text — they read identically in both modes (this is intentional; they are the brand frame).
2. **Adaptive zone:** the paper body card declares light values plus a `@media (prefers-color-scheme: dark)` override to dark tokens, with `[data-ogsc]`/`.gmail` guards noted below:

| Element | Light (declared) | Dark override (`prefers-color-scheme: dark`) |
|---|---|---|
| Outer canvas | `#F5F2EB` | `#16120E` |
| Body card | `#FAF9F4` | `#211B14` |
| H1 / body text | `#221E1B` / `#221E1B` | `#F2EDE3` |
| Muted text | `#5C5546` | `#B3A996` |
| Hairlines | `#D9D3C9` | `#3A3226` |
| Lot table zebra | `#EDE7DA` | `#2A2318` |
| CTA button | oxblood `#74362F` / paper text | oxblood-300 `#C9978F` / `#16120E` text (7.37:1 AAA ✓) |
| Score seals | tier colors unchanged (all verified ≥ 4.5:1 with their text) | unchanged |
| Links | `#5E2B25` | `#C9978F` |

3. **Outlook.com:** duplicate every dark override with `[data-ogsc]` attribute selectors.
4. **Gmail auto-invert defense:** no pure-black text (our ink `#221E1B` inverts acceptably); transparent PNGs are placed only on declared-color bands; the seal lockup PNG ships with its own ink chip background so inversion can't orphan it; meta tags `<meta name="color-scheme" content="light dark">` + `supported-color-schemes` declared.
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
<title>Your sample kit has landed — Auctum Ledger</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@560;700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

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
    .al-canvas   { background-color:#16120E !important; }
    .al-card     { background-color:#211B14 !important; }
    .al-h1       { color:#F2EDE3 !important; }
    .al-body     { color:#F2EDE3 !important; }
    .al-muted    { color:#B3A996 !important; }
    .al-hairline { background-color:#3A3226 !important; }
    .al-zebra    { background-color:#2A2318 !important; }
    .al-cta-bg   { background-color:#C9978F !important; }
    .al-cta-txt  { color:#16120E !important; }
    .al-link     { color:#C9978F !important; }
  }
  [data-ogsc] .al-canvas   { background-color:#16120E !important; }
  [data-ogsc] .al-card     { background-color:#211B14 !important; }
  [data-ogsc] .al-h1       { color:#F2EDE3 !important; }
  [data-ogsc] .al-body     { color:#F2EDE3 !important; }
  [data-ogsc] .al-muted    { color:#B3A996 !important; }
  [data-ogsc] .al-zebra    { background-color:#2A2318 !important; }
  [data-ogsc] .al-cta-bg   { background-color:#C9978F !important; }
  [data-ogsc] .al-cta-txt  { color:#16120E !important; }
  [data-ogsc] .al-link     { color:#C9978F !important; }
</style>
</head>

<body class="al-canvas" style="margin:0; padding:0; word-spacing:normal; background-color:#F5F2EB;">

<!-- Preheader: hidden -->
<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  Your {origin} {process_method} kit is on the cupping table — tasting notes, score sheet, and next steps inside.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="al-canvas" style="background-color:#F5F2EB;">
<tr><td align="center" style="padding:0;">

  <!-- ================= HEADER BAND ================= -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px;">
    <tr>
      <td bgcolor="#221E1B" style="background-color:#221E1B; padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="40" valign="middle">
              <img src="https://assets.auctumledger.co/email/seal-paper-80.png" width="40" height="40" alt="Auctum seal" style="display:block; width:40px; height:40px;">
            </td>
            <td valign="middle" style="padding-left:12px; font-family:'Playfair Display',Georgia,'Times New Roman',serif; font-size:24px; line-height:28px; color:#FAF9F4;">
              Auctum Ledger
              <div style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#B3A996; padding-top:2px;">SPECIALTY GREEN COFFEE</div>
            </td>
            <td align="right" valign="middle" width="72">
              <img src="https://assets.auctumledger.co/email/verification-seal-144.png" width="64" height="64" alt="" style="display:block; width:64px; height:64px; opacity:0.85;">
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= BODY CARD ================= -->
    <tr>
      <td class="al-card card-pad" bgcolor="#FAF9F4" style="background-color:#FAF9F4; padding:32px;">

        <div class="al-muted" style="font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">
          Sample kit · Delivered 4 days ago
        </div>

        <h1 class="h1 al-h1" style="margin:12px 0 0; font-family:'Playfair Display',Georgia,'Times New Roman',serif; font-weight:560; font-size:30px; line-height:38px; color:#221E1B;">
          The kettle's had its four days, {roaster_name}.
        </h1>

        <p class="al-body" style="margin:16px 0 0; font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#221E1B;">
          Your sample kit for <strong>{origin}</strong> — a {process_method} lot grown at
          <span style="font-family:'JetBrains Mono','Courier New',Courier,monospace; font-weight:700;">{elevation}</span> —
          should be rested and ready. When you cup it, lead with the dry fragrance: this lot's
          jasmine and cane-sugar notes show earliest there.
        </p>

        <!-- Cupping guidance block -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;">
          <tr>
            <td class="al-zebra" bgcolor="#EDE7DA" style="background-color:#EDE7DA; padding:16px 20px; border-left:3px solid #74362F;">
              <div class="al-muted" style="font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Suggested cupping protocol</div>
              <p class="al-body" style="margin:8px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px; color:#221E1B;">
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
            <td align="center" class="al-cta-bg" bgcolor="#74362F" style="background-color:#74362F;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://app.auctumledger.co/kits/{kit_id}/score" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="12%" fillcolor="#74362F" stroke="f">
                <center style="color:#FAF9F4;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Log Your Cup Scores</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="https://app.auctumledger.co/kits/{kit_id}/score" class="al-cta-txt"
                 style="display:inline-block; padding:14px 28px; font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#FAF9F4; text-decoration:none;">
                Log Your Cup Scores
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px;">
          <a href="https://app.auctumledger.co/lots/{lot_id}" class="al-link" style="color:#74362F;">View the full lot sheet for {origin} →</a>
        </p>

        <!-- Hairline + sign-off -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
          <tr><td class="al-hairline" bgcolor="#D9D3C9" height="1" style="background-color:#D9D3C9; font-size:1px; line-height:1px;">&nbsp;</td></tr>
        </table>
        <p class="al-muted" style="margin:16px 0 0; font-family:Georgia,serif; font-style:italic; font-size:14px; line-height:22px; color:#5C5546;">
          Questions on protocol? Reply to this email — a Q grader reads every one.<br>
          — {rep_first_name}, Auctum Ledger
        </p>
      </td>
    </tr>

    <!-- ================= ENDORSEMENT STRIP ================= -->
    <tr>
      <td class="al-card" bgcolor="#FAF9F4" style="background-color:#FAF9F4; padding:0 32px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td class="al-hairline" bgcolor="#D9D3C9" height="1" style="background-color:#D9D3C9; font-size:1px; line-height:1px;">&nbsp;</td></tr>
          <tr>
            <td class="al-muted" style="padding-top:12px; font-family:Inter,Helvetica,Arial,sans-serif; font-size:12px; font-weight:600; letter-spacing:1.5px; color:#5C5546;">
              AUCTUM LEDGER · BY AUCTUM
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= FOOTER BAND ================= -->
    <tr>
      <td bgcolor="#221E1B" style="background-color:#221E1B; padding:24px 32px;">
        <p style="margin:0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#FAF9F4;">
          {company_name} · {street_address} · {city}, {state} {zip}
        </p>
        <p style="margin:8px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px;">
          <a href="{unsubscribe_url}" style="color:#C9A86A;">Unsubscribe</a> &nbsp;·&nbsp;
          <a href="{preferences_url}" style="color:#C9A86A;">Email preferences</a> &nbsp;·&nbsp;
          <a href="{view_in_browser_url}" style="color:#C9A86A;">View in browser</a>
        </p>
        <p style="margin:12px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; line-height:18px; color:#B9AE97;">
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
<title>Your cup-score report — Auctum Ledger</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@560;700&family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

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
    .al-canvas   { background-color:#16120E !important; }
    .al-card     { background-color:#211B14 !important; }
    .al-h1       { color:#F2EDE3 !important; }
    .al-body     { color:#F2EDE3 !important; }
    .al-muted    { color:#B3A996 !important; }
    .al-hairline { background-color:#3A3226 !important; }
    .al-zebra    { background-color:#2A2318 !important; }
    .al-cta-bg   { background-color:#C9978F !important; }
    .al-cta-txt  { color:#16120E !important; }
    .al-link     { color:#C9978F !important; }
    .al-rule     { border-color:#3A3226 !important; }
  }
  [data-ogsc] .al-canvas   { background-color:#16120E !important; }
  [data-ogsc] .al-card     { background-color:#211B14 !important; }
  [data-ogsc] .al-h1       { color:#F2EDE3 !important; }
  [data-ogsc] .al-body     { color:#F2EDE3 !important; }
  [data-ogsc] .al-muted    { color:#B3A996 !important; }
  [data-ogsc] .al-zebra    { background-color:#2A2318 !important; }
  [data-ogsc] .al-cta-bg   { background-color:#C9978F !important; }
  [data-ogsc] .al-cta-txt  { color:#16120E !important; }
  [data-ogsc] .al-link     { color:#C9978F !important; }
</style>
</head>

<body class="al-canvas" style="margin:0; padding:0; word-spacing:normal; background-color:#F5F2EB;">

<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
  {origin} came back at {sca_cup_score} pts — see the full sheet and three comparable lots.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="al-canvas" style="background-color:#F5F2EB;">
<tr><td align="center" style="padding:0;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px;">

    <!-- ================= HEADER BAND ================= -->
    <tr>
      <td bgcolor="#221E1B" style="background-color:#221E1B; padding:16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="40" valign="middle">
              <img src="https://assets.auctumledger.co/email/seal-paper-80.png" width="40" height="40" alt="Auctum seal" style="display:block; width:40px; height:40px;">
            </td>
            <td valign="middle" style="padding-left:12px; font-family:'Playfair Display',Georgia,serif; font-size:24px; line-height:28px; color:#FAF9F4;">
              Auctum Ledger
              <div style="font-family:Inter,Helvetica,Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#B3A996; padding-top:2px;">CUP-SCORE REPORT</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ================= BODY CARD ================= -->
    <tr>
      <td class="al-card card-pad" bgcolor="#FAF9F4" style="background-color:#FAF9F4; padding:32px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td valign="middle">
              <div class="al-muted" style="font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">
                Score verified · {origin} · {process_method}
              </div>
              <h1 class="h1 al-h1" style="margin:12px 0 0; font-family:'Playfair Display',Georgia,serif; font-weight:560; font-size:30px; line-height:38px; color:#221E1B;">
                {sca_cup_score} — officially Outstanding, {roaster_name}.
              </h1>
            </td>
            <!-- Cup Score seal: brass tier (90+) — swap bgcolor per tier map in §5.1 -->
            <td width="72" align="right" valign="top">
              <!--[if mso]>
              <v:oval xmlns:v="urn:schemas-microsoft-com:vml" style="width:64px;height:64px;" fillcolor="#C9A86A" strokecolor="#221E1B" strokeweight="1.5pt">
                <center style="color:#221E1B;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;">90.5</center>
              </v:oval>
              <![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" valign="middle" width="64" height="64" bgcolor="#C9A86A"
                      style="width:64px; height:64px; background-color:#C9A86A; border:2px solid #221E1B; border-radius:50%;">
                    <span style="font-family:'JetBrains Mono','Courier New',Courier,monospace; font-size:18px; font-weight:700; color:#221E1B;">{sca_cup_score}</span>
                  </td>
                </tr>
                <tr><td align="center" style="padding-top:4px; font-family:Inter,Helvetica,Arial,sans-serif; font-size:9px; letter-spacing:1.5px; color:#5C5546;">CQI&nbsp;CUP</td></tr>
              </table>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <p class="al-body" style="margin:16px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:16px; line-height:26px; color:#221E1B;">
          Your submitted scores are in, and the composite holds at
          <span style="font-family:'JetBrains Mono','Courier New',Courier,monospace; font-weight:700;">{sca_cup_score} pts</span>.
          Lots in this band move quickly — positions at this quality typically close within two weeks
          of the sheet date. Three comparable lots currently on the board:
        </p>

        <!-- ===== Lot sheet table (§5.2) ===== -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="lot-table" style="margin:24px 0 0; border-collapse:collapse;">
          <tr>
            <th align="left"  class="al-muted" style="padding:10px 8px; border-bottom:2px solid #221E1B; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Lot</th>
            <th align="left"  class="al-muted hide-sm" style="padding:10px 8px; border-bottom:2px solid #221E1B; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Process</th>
            <th align="right" class="al-muted" style="padding:10px 8px; border-bottom:2px solid #221E1B; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">Cup</th>
            <th align="right" class="al-muted" style="padding:10px 8px; border-bottom:2px solid #221E1B; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">$/lb</th>
            <th align="right" class="al-muted hide-sm" style="padding:10px 8px; border-bottom:2px solid #221E1B; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#5C5546;">lbs</th>
          </tr>
          <!-- row: zebra surface -->
          <tr>
            <td class="al-body" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#221E1B;">Huila, Colombia — Pink Bourbon</td>
            <td class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">washed</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#5E2B25;">88.5</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#221E1B;">6.10</span></td>
            <td align="right" class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#5C5546;">2,640</span></td>
          </tr>
          <!-- row: zebra recessed -->
          <tr class="al-zebra" bgcolor="#EDE7DA" style="background-color:#EDE7DA;">
            <td class="al-body" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#221E1B;">Yirgacheffe, Ethiopia — Heirloom</td>
            <td class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">natural</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#5E2B25;">87.0</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#221E1B;">5.75</span></td>
            <td align="right" class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#5C5546;">1,320</span></td>
          </tr>
          <tr>
            <td class="al-body" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#221E1B;">Tarrazú, Costa Rica — Caturra</td>
            <td class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; color:#5C5546;">honey</td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-weight:700; font-size:14px; color:#5E2B25;">86.5</span></td>
            <td align="right" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#221E1B;">5.20</span></td>
            <td align="right" class="al-muted hide-sm" style="padding:10px 8px; border-bottom:1px solid #D9D3C9;"><span style="font-family:'JetBrains Mono','Courier New',monospace; font-size:14px; color:#5C5546;">3,960</span></td>
          </tr>
        </table>

        <p style="margin:12px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:14px; line-height:22px;">
          <a href="https://app.auctumledger.co/catalog?cup_min=86" class="al-link" style="color:#74362F;">View all 23 lots in this range →</a>
        </p>

        <!-- Bulletproof CTA -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
          <tr>
            <td align="center" class="al-cta-bg" bgcolor="#74362F" style="background-color:#74362F;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="https://app.auctumledger.co/lots/{lot_id}/source" style="height:48px;v-text-anchor:middle;width:300px;" arcsize="12%" fillcolor="#74362F" stroke="f">
                <center style="color:#FAF9F4;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Reserve Your Position on {origin}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="https://app.auctumledger.co/lots/{lot_id}/source" class="al-cta-txt"
                 style="display:inline-block; padding:14px 28px; font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; font-weight:700; color:#FAF9F4; text-decoration:none;">
                Reserve Your Position on {origin}
              </a>
              <!--<![endif]-->
            </td>
          </tr>
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;">
          <tr><td class="al-hairline" bgcolor="#D9D3C9" height="1" style="background-color:#D9D3C9; font-size:1px; line-height:1px;">&nbsp;</td></tr>
        </table>
        <p class="al-muted" style="margin:16px 0 0; font-family:Georgia,serif; font-style:italic; font-size:13px; line-height:21px; color:#5C5546;">
          Auctum. Value is co-created, not extracted.
        </p>
      </td>
    </tr>

    <!-- ================= FOOTER BAND ================= -->
    <tr>
      <td bgcolor="#221E1B" style="background-color:#221E1B; padding:24px 32px;">
        <p style="margin:0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px; color:#FAF9F4;">
          {company_name} · {street_address} · {city}, {state} {zip}
        </p>
        <p style="margin:8px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:13px; line-height:21px;">
          <a href="{unsubscribe_url}" style="color:#C9A86A;">Unsubscribe</a> &nbsp;·&nbsp;
          <a href="{preferences_url}" style="color:#C9A86A;">Email preferences</a> &nbsp;·&nbsp;
          <a href="{view_in_browser_url}" style="color:#C9A86A;">View in browser</a>
        </p>
        <p style="margin:12px 0 0; font-family:Inter,Helvetica,Arial,sans-serif; font-size:11px; line-height:18px; color:#B9AE97;">
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

SMS has no layout — typography and tokens carry the brand: 160 chars max, one merge tag minimum, figures in plain numerals, no emojis, no link shorteners (full `auctumledger.co` domain for trust).

> `Hi {roaster_name} — {rep_first_name} at Auctum Ledger. The {origin} you cupped is holding at 86.5pt and 3,960 lbs remain on the sheet. Want me to hold a position while you decide? auctumledger.co/lots/{lot_id}`

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
