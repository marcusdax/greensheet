# Greensheet Frontend Expansion: Lot Assets, Touch Templates, and Settings

**Date:** 2026-07-29  
**Scope:** Frontend demo application (`app/`)  
**Base branch:** `master` (post `feature/greensheet-frontend-expansion` merge)  

## 1. Goal

Add three new capabilities to the existing Greensheet demo frontend:

1. **Lot media gallery** on the Catalog page so a user can upload PDF / JPEG / PNG / WebP files when creating or editing a lot; these assets display as a thumbnail preview on the catalog row and a gallery in the lot detail drawer.
2. **Templates page** for editing email and SMS touch templates that are consumed by automation-rule `SEND_TEMPLATE` actions. Each template supports A/B variants, merge-token insertion, and a live preview rendered from a fixed sample dataset.
3. **Settings / Account page** for app preferences, user profile, and workspace settings.

The implementation must fit the existing architecture: TypeScript types, Zod schemas, Zustand slices, mock in-memory DB, mock API client, React components, i18n, and Vitest tests.

## 2. Decision Record

| Decision | Rationale |
|----------|-----------|
| Display-only lot assets, no generated lot sheet | User confirmed they only want a gallery preview, not a generated PDF or printable lot sheet. This keeps the feature storage-bound and avoids PDF-generation libraries. |
| Dedicated **Templates** sidebar page, nested between Campaigns and Automation Rules | The user wants a focused editor for touch templates. A separate page gives clear ownership; it still links to Automation Rules via a dropdown in the `RuleForm`. |
| Full template editor with A/B variants and merge-token preview | Chosen to match the existing COF-001…005 campaign copy and to make template editing demonstrable for nurture sequences. |
| Settings page footer item in sidebar | Conventional placement; does not pollute the main domain groups. |
| Fixed sample dataset for template preview | User explicitly requested a fixed sample dataset rather than a live selected roaster/lot. Easier to seed and keep deterministic. |
| Base64 `dataUrl` storage in the mock DB | Mirrors how the existing demo stores in-memory state without a real backend. Keeps file uploads self-contained in the browser. |

## 3. Domain Model

### 3.1 `LotAsset`

```ts
export interface LotAsset {
  id: string;
  lotId: string;
  filename: string;
  mimeType: string;          // image/jpeg | image/png | image/webp | application/pdf
  sizeBytes: number;
  dataUrl: string;           // base64 data URL
  uploadedAt: string;
  uploadedBy: string;        // user id or name
  displayOrder: number;
}

export interface LotAssetInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  displayOrder: number;
}
```

- `CoffeeLot` gains `assets: LotAsset[]`.
- `CoffeeLotCreate` gains `assets?: LotAssetInput[]`.
- `CoffeeLotPatch` gains `assets?: LotAssetInput[]` (used for gallery edits on an existing lot).

### 3.2 `TouchTemplate`

```ts
export type TemplateChannel = 'email' | 'sms';
export type TemplateStatus = 'draft' | 'active' | 'archived';

export interface TouchTemplateVariant {
  subject: string;    // email only; ignored for SMS
  body: string;
}

export interface TouchTemplate {
  id: string;
  name: string;
  channel: TemplateChannel;
  status: TemplateStatus;
  variantA: TouchTemplateVariant;
  variantB: TouchTemplateVariant;
  allowedTokens: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TouchTemplateCreate {
  name: string;
  channel: TemplateChannel;
  variantA: TouchTemplateVariant;
  variantB: TouchTemplateVariant;
  allowedTokens?: string[];
}

export interface TouchTemplatePatch {
  name?: string;
  channel?: TemplateChannel;
  status?: TemplateStatus;
  variantA?: Partial<TouchTemplateVariant>;
  variantB?: Partial<TouchTemplateVariant>;
  allowedTokens?: string[];
}
```

- Templates are linked to `RuleAction` via `templateId` for the `SEND_TEMPLATE` action type.
- The `RuleForm` will render a dropdown of active templates when the action type is `SEND_TEMPLATE`.

### 3.3 `WorkspaceSettings`

```ts
export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'system';
  locale: 'en-US' | 'es-MX' | 'pt-BR' | 'zh-CN';
  currency: 'USD' | 'EUR' | 'BRL' | 'CNY';
  dateFormat: 'ISO' | 'US' | 'EU';
  companyName: string;
  defaultCampaignBudgetCents: number | null;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  avatarDataUrl: string | null;
}
```

- Theme and locale already live in `useUi` + `localStorage`; the Settings page will mirror them and keep them in sync.
- Workspace and profile settings are stored in the mock DB and owned by a new `settings-slice`.

## 4. Lot Media Gallery

### 4.1 Upload component

- New component: `components/forms/AssetUpload.tsx`.
- Accepts drag-and-drop and file picker.
- Validates: MIME type must be `image/jpeg`, `image/png`, `image/webp`, or `application/pdf`; max file size 5 MB; max 8 files per lot.
- Converts each accepted file to a base64 `dataUrl` via `FileReader.readAsDataURL`.
- Renders a preview strip of thumbnails; PDFs render a generic document icon.
- Supports remove and reorder.

### 4.2 LotForm integration

- Add an `assets` field to the `lotFormSchema` as an array of `LotAssetInput`.
- The form submits the full asset inputs to `createLot` / `updateLot`.
- On edit, the existing assets are pre-populated and can be reordered or removed.

### 4.3 Catalog display

- Add a small media preview cell to the catalog table row: the first image thumbnail with a `+N` badge if more assets exist.
- In `LotDetailDrawer.tsx`, render a scrollable gallery grid.
- Clicking an image opens a lightbox modal; PDFs open in a new tab.

### 4.4 Mock API / DB

- New DB collection: `assets`.
- New endpoints:
  - `POST /v1/catalog/lots/:lotId/assets` — add one asset.
  - `DELETE /v1/catalog/lots/:lotId/assets/:assetId` — remove an asset.
  - `PATCH /v1/catalog/lots/:lotId/assets/reorder` — update display order.
- The catalog slice exposes `addLotAsset`, `removeLotAsset`, and `reorderLotAssets`.

## 5. Templates Page

### 5.1 Navigation

- Add `/templates` route under the `/:locale` layout.
- Add `templates` to the ENGAGE sidebar group between `campaigns` and `automation-rules`.
- Add i18n keys `nav.templates` to all locale files.

### 5.2 Page layout

- Left panel: searchable, filterable list of templates (filter by channel and status).
- Right panel: template editor.
  - Header: name input, channel select, status toggle (Draft / Active / Archived).
  - Variant tabs: Variant A / Variant B.
  - Per-variant fields: subject (email only), body textarea.
  - Merge-token helper toolbar: tokens such as `{first_name}`, `{roaster_name}`, `{origin}`, `{region}`, `{process_method}`, `{sca_cup_score}`, `{elevation_masl}`, `{varietal}`, `{flavor_notes}`, `{lot_size_bags}`, `{price_per_lb}`, `{kit_tracking_url}`, `{feedback_url}`, `{shortlist_url}`, `{referral_url}`, `{importer_name}`, `{rep_first_name}`, `{savings_estimate}`.
  - Live preview: renders the selected variant body and subject using a fixed sample dataset. The sample dataset is seeded in `db.ts` and includes one sample roaster and one sample lot so that merge tokens resolve to realistic values.

### 5.3 Template ↔ Rule wiring

- In `RuleForm`, replace the raw `templateId` string with a searchable dropdown populated from `templates-slice`.
- Only templates with `status === 'active'` are selectable for new rules.
- When a template is selected, display its channel and the first 60 characters of the body as a hint.

### 5.4 Mock API / DB

- New DB collection: `templates`.
- New endpoints:
  - `GET /v1/templates` (with query filters `channel`, `status`, `q`).
  - `POST /v1/templates`.
  - `GET /v1/templates/:id`.
  - `PATCH /v1/templates/:id`.
  - `DELETE /v1/templates/:id`.
- Seed at least five templates (COF-001…005) so the page is not empty on first load.
- New Zustand slice: `templates-slice.ts`.

## 6. Settings / Account Page

### 6.1 Navigation

- Add `/settings` route under the `/:locale` layout.
- Add `settings` as a footer item in the sidebar (below the main groups).
- Add i18n key `nav.settings` to all locale files.

### 6.2 Sections

1. **Preferences**
   - Theme toggle (`light` / `dark` / `system`).
   - Language selector.
   - Currency preference (USD, EUR, BRL, CNY).
   - Date format (ISO / US / EU).
2. **Account**
   - Full name input.
   - Email input (validated).
   - Role display (read-only).
   - Avatar upload using `AssetUpload` restricted to a single image file.
3. **Workspace**
   - Company name input.
   - Default campaign budget cap (dollars input, stored as cents).
   - CAC ceiling guardrail toggle (informational in the demo).

### 6.3 State ownership

- Theme and locale remain in `useUi` and `localStorage`; the Settings page reads and writes through the same `useUi` actions to keep the topbar in sync.
- Profile and workspace settings move to a new `settings-slice`.
- The mock DB stores one `UserProfile` row and one `WorkspaceSettings` row.

### 6.4 Mock API / DB

- New DB rows: `settings` and `userProfile`.
- New endpoints:
  - `GET /v1/settings`, `PATCH /v1/settings`.
  - `GET /v1/profile`, `PATCH /v1/profile`.
- Seed sensible defaults.

## 7. Data Flow Summary

```
UI Form
  -> Zustand slice action
  -> api.client method
  -> api.db in-memory collection
  -> Zustand slice updates state
  -> UI re-renders
```

All new data flows follow the existing pattern already used by Roasters, Campaigns, Rules, and Catalog.

## 8. Error Handling & Validation

- **Lot uploads:** wrong MIME type or files > 5 MB are rejected inline; max 8 files per lot.
- **Templates:** body must be non-empty; email templates require a subject; template name must be unique within the mock DB.
- **Settings:** email validated via Zod; budget cap must be non-negative.
- All CRUD errors surface as toasts using the existing `useUi.pushToast` pattern.

## 9. Testing

- **Slice tests:** `templates-slice.test.ts`, `settings-slice.test.ts`, and add asset CRUD tests to `catalog-slice.test.ts`.
- **Component tests:**
  - `TemplatesPage.test.tsx` — create, edit, toggle status, preview renders merge tokens.
  - `SettingsPage.test.tsx` — update preferences, profile, and workspace; verify localStorage sync for theme/locale.
  - `AssetUpload.test.tsx` — accept valid image, reject oversized PDF, enforce max count.
- **Integration test:** `RuleForm.test.tsx` extended to verify that selecting a `SEND_TEMPLATE` action shows the template dropdown and the selected template's channel.
- **Regression:** existing 152 tests remain green; lint and build remain clean.

## 10. Out of Scope

- Real backend file storage or signed URLs.
- PDF generation or printable coffee lot sheets.
- Live roaster/lot selection for template preview (fixed sample dataset only).
- Role-based access control enforcement beyond read-only role display.
- Backend email/SMS delivery providers (SendGrid, Twilio).

## 11. Files Likely to Change

- `app/src/types/api.ts`
- `app/src/api/schemas.ts`
- `app/src/api/db.ts`
- `app/src/api/client.ts`
- `app/src/api/problems.ts` (possibly new problem codes)
- `app/src/stores/root-store.ts`
- `app/src/stores/slices/catalog-slice.ts`
- `app/src/stores/slices/templates-slice.ts` (new)
- `app/src/stores/slices/settings-slice.ts` (new)
- `app/src/components/forms/AssetUpload.tsx` (new)
- `app/src/components/forms/LotForm.tsx`
- `app/src/components/forms/RuleForm.tsx`
- `app/src/components/LotDetailDrawer.tsx`
- `app/src/pages/CatalogPage.tsx`
- `app/src/pages/TemplatesPage.tsx` (new)
- `app/src/pages/SettingsPage.tsx` (new)
- `app/src/App.tsx`
- `app/src/components/AppLayout.tsx`
- `app/src/i18n/index.ts` and locale files
- `app/src/api/__tests__/client.test.ts`
- `app/src/stores/__tests__/catalog-slice.test.ts`
- New test files for templates, settings, and AssetUpload.
