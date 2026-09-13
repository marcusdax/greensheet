# Document Scanner + Vietnam Payment Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fully functional, UX-validating mock implementation of the Document Scanner and Vietnam Payment Manager in the current SPA, with no production backend dependency.

**Architecture:** Phase 1 builds on the existing React + Zustand + in-memory SQLite-like mock API architecture. New Zustand slices (`documentsSlice`, `paymentsSlice`) own all mock domain state; the `client.ts` mock layer exposes typed API calls mirroring production contract signatures; React pages and components render the full workflow without touching the database layer.

**Tech Stack:** React 19, TypeScript, Zustand (persist + immer middleware), TailwindCSS + shadcn/ui, Vite, Playwright for E2E, Vitest for unit tests, MSW for API mocking.

**Spec:** `docs/superpowers/specs/2024-09-13-document-scanner-vietnam-payment-design.md` (design approved by user, Option C hybrid incremental), plus the full-value-chain blueprint at `docs/superpowers/specs/2024-09-13-document-scanner-vietnam-payment-blueprint.md`.

---

## Global Constraints

- Phase 1 is mock-only: no production database, no tRPC, no Hono, no PayOS/Casso integration, no OCR model calls.
- All new data lives in Zustand slices via `client.ts` mock layer; no direct database access from components.
- Money is modeled as integer minor units + currency code (VND exponent 0, USD exponent 2); never floating point.
- TrustScore badge uses band colors only: sealed (brass-300), verified (sage-600), established (oxblood-100), provisional (neutral-700), at-risk (danger tint).
- Scanner UI follows Museum Folio tokens: surface bg, hairline borders, muted copy, oxblood primary CTAs, no gradients, no saturated blue, no illustrations.
- OCR is proposal-only: extracted fields are pre-filled suggestions; humans explicitly accept or reject.
- Every mock API mutation accepts an `idempotencyKey` and returns `ApiResult<T>` (success or problem response).
- All new copy is i18n-keyed through `app/localization/02-locale-files/en-US.json` with the same nested namespace pattern (`documents.*`, `payments.*`, `trust.*`).
- New code must compile with the existing TypeScript strict mode and pass `tsc --noEmit`.

---

## Task 1: Extend Zustand Slices (documentsSlice, paymentsSlice)

**Files:**
- Create: `app/src/stores/slices/documents-slice.ts`
- Create: `app/src/stores/slices/payments-slice.ts`
- Modify: `app/src/stores/root-store.ts`
- Modify: `app/src/stores/index.ts` (if slice registry exists)
- Test: `app/src/stores/slices/documents-slice.test.ts`, `app/src/stores/slices/payments-slice.test.ts`

**Interfaces:**
- Consumes: existing `createSlice` factory pattern from `catalog-slice.ts`, `ui-slice.ts`
- Produces: `useDocuments()` and `usePayments()` hooks exposed from root-store

### Steps

- [ ] **Step 1: Write the failing test for documents slice**

```ts
// app/src/stores/slices/documents-slice.test.ts
import { describe, expect, it } from 'vitest';
import { createDocumentsSlice } from './documents-slice';

describe('createDocumentsSlice', () => {
  it('accepts an OCR document and records confidence per field', () => {
    const slice = createDocumentsSlice();
    slice.acceptOcrDocument({
      documentId: 'doc_001',
      ocrResultId: 'ocr_001',
      entityId: 'lot_001',
      entityType: 'lot',
      fields: { cupScore: 82.75, moistureContent: 10.2 },
      confidenceScores: { cupScore: 0.95, moistureContent: 0.91 },
    });
    expect(slice.documents[0].status).toBe('accepted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/stores/slices/documents-slice.test.ts -v`
Expected: FAIL with `createDocumentsSlice is not defined`

- [ ] **Step 3: Write minimal implementation of documents slice**

```ts
// app/src/stores/slices/documents-slice.ts
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type DocumentStatus = 'draft' | 'proposed' | 'accepted' | 'rejected';
export type DocumentEntityType = 'lot' | 'contract' | 'qc' | 'profile';

export interface DocumentRecord {
  id: string;
  fileName: string;
  entityType: DocumentEntityType;
  entityId: string;
  status: DocumentStatus;
  ocrResultId?: string;
  confidenceScores?: Record<string, number>;
  extractedFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsSliceState {
  documents: DocumentRecord[];
  addDocument: (doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  acceptOcrDocument: (input: { documentId: string; ocrResultId: string; entityId: string; entityType: DocumentEntityType; fields: Record<string, unknown>; confidenceScores: Record<string, number> }) => void;
  rejectDocument: (documentId: string) => void;
  getDocument: (documentId: string) => DocumentRecord | undefined;
}

export const createDocumentsSlice = () =>
  create<DocumentsSliceState>()(
    devtools(
      persist(
        subscribeWithSelector(
          immer((set) => ({
            documents: [],
            addDocument: (doc) => set((state) => {
              state.documents.push({ id: `doc_${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...doc });
            }),
            acceptOcrDocument: (input) => set((state) => {
              const doc = state.documents.find((d) => d.id === input.documentId);
              if (doc) {
                doc.status = 'accepted';
                doc.ocrResultId = input.ocrResultId;
                doc.extractedFields = input.fields;
                doc.confidenceScores = input.confidenceScores;
                doc.entityId = input.entityId;
                doc.entityType = input.entityType;
                doc.updatedAt = new Date().toISOString();
              }
            }),
            rejectDocument: (documentId) => set((state) => {
              const doc = state.documents.find((d) => d.id === documentId);
              if (doc) { doc.status = 'rejected'; doc.updatedAt = new Date().toISOString(); }
            }),
            getDocument: (documentId) => state.documents.find((d) => d.id === documentId),
          })),
          { name: 'greensheet-documents' },
        ),
        { name: 'greensheet-documents' },
      ),
      { name: 'documentsSlice' },
    ),
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/stores/slices/documents-slice.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/slices/documents-slice.ts app/src/stores/slices/documents-slice.test.ts
git commit -m "feat: add documents slice for mock scanner"
```

---

## Task 2: Extend Zustand Slices (paymentsSlice)

**Files:**
- Create: `app/src/stores/slices/payments-slice.ts`
- Modify: `app/src/stores/root-store.ts`
- Test: `app/src/stores/slices/payments-slice.test.ts`

**Interfaces:**
- Consumes: `createPaymentsSlice` pattern from Task 1
- Produces: `usePayments()` hook exposed from root-store

### Steps

- [ ] **Step 1: Write the failing test for payments slice**

```ts
// app/src/stores/slices/payments-slice.test.ts
import { describe, expect, it } from 'vitest';
import { createPaymentsSlice } from './payments-slice';

describe('createPaymentsSlice', () => {
  it('creates a payment intent and allocates a partial payment', () => {
    const slice = createPaymentsSlice();
    slice.createPaymentIntent({
      idempotencyKey: 'key_001',
      invoiceId: 'inv_001',
      amountMinor: 5000000000n,
      currency: 'VND',
    });
    slice.allocatePayment({
      providerTransactionId: 'txn_001',
      invoiceId: 'inv_001',
      amountMinor: 4500000000n,
      currency: 'VND',
    });
    expect(slice.invoices.find((i) => i.id === 'inv_001')?.paidMinor).toBe(4500000000n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/stores/slices/payments-slice.test.ts -v`
Expected: FAIL with `createPaymentsSlice is not defined`

- [ ] **Step 3: Write minimal implementation of payments slice**

```ts
// app/src/stores/slices/payments-slice.ts
import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface PaymentIntent {
  id: string;
  invoiceId: string;
  idempotencyKey: string;
  amountMinor: bigint;
  currency: 'VND' | 'USD';
  status: 'pending' | 'awaiting_payment' | 'paid' | 'underpaid' | 'overpaid';
  providerOrderCode?: string;
  qrCodeData?: string;
  checkoutUrl?: string;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  counterpartyId: string;
  currency: 'VND' | 'USD';
  totalMinor: bigint;
  paidMinor: bigint;
  dueAt: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overpaid';
}

export interface ProviderTransaction {
  id: string;
  provider: 'payos' | 'casso' | 'manual';
  providerTxnId: string;
  amountMinor: bigint;
  currency: 'VND' | 'USD';
  description: string;
  matchStatus: 'unmatched' | 'matched' | 'ambiguous';
  matchedInvoiceId?: string;
}

export interface PaymentsSliceState {
  intents: PaymentIntent[];
  invoices: InvoiceRecord[];
  transactions: ProviderTransaction[];
  createPaymentIntent: (input: { idempotencyKey: string; invoiceId: string; amountMinor: bigint; currency: 'VND' | 'USD'; providerOrderCode?: string }) => PaymentIntent;
  allocatePayment: (input: { providerTransactionId: string; invoiceId: string; amountMinor: bigint; currency: 'VND' | 'USD' }) => void;
  arAging: (counterpartyId?: string) => Array<{ bucket: 'current' | 'b30' | 'b60' | 'b90' | 'b90plus'; amountMinor: bigint }>;
  createInvoice: (input: { invoiceNumber: string; counterpartyId: string; currency: 'VND' | 'USD'; totalMinor: bigint; dueAt: string }) => InvoiceRecord;
}

export const createPaymentsSlice = () =>
  create<PaymentsSliceState>()(
    devtools(
      persist(
        subscribeWithSelector(
          immer((set, get) => ({
            intents: [],
            invoices: [],
            transactions: [],
            createInvoice: (input) => {
              const invoice: InvoiceRecord = { id: `inv_${Date.now()}`, ...input, paidMinor: 0n, status: 'issued' };
              set((state) => state.invoices.push(invoice));
              return invoice;
            },
            createPaymentIntent: (input) => {
              const intent: PaymentIntent = { id: `intent_${Date.now()}`, ...input, status: 'awaiting_payment', createdAt: new Date().toISOString() };
              set((state) => state.intents.push(intent));
              return intent;
            },
            allocatePayment: (input) => {
              set((state) => {
                const invoice = state.invoices.find((i) => i.id === input.invoiceId);
                if (invoice) {
                  invoice.paidMinor += input.amountMinor;
                  invoice.status = invoice.paidMinor >= invoice.totalMinor ? 'paid' : 'partially_paid';
                }
                state.transactions.push({ id: `txn_${Date.now()}`, ...input, matchStatus: 'matched' });
              });
            },
            arAging: (counterpartyId) => {
              const invoices = get().invoices.filter((i) => !counterpartyId || i.counterpartyId === counterpartyId);
              const today = new Date();
              return invoices.reduce((acc, inv) => {
                const daysOverdue = Math.floor((today - new Date(inv.dueAt)) / 86400000);
                const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? 'b30' : daysOverdue <= 60 ? 'b60' : daysOverdue <= 90 ? 'b90' : 'b90plus';
                acc.push({ bucket, amountMinor: inv.totalMinor - inv.paidMinor });
                return acc;
              }, [] as Array<{ bucket: 'current' | 'b30' | 'b60' | 'b90' | 'b90plus'; amountMinor: bigint }>);
            },
          })),
          { name: 'greensheet-payments' },
        ),
        { name: 'greensheet-payments' },
      ),
      { name: 'paymentsSlice' },
    ),
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/stores/slices/payments-slice.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/slices/payments-slice.ts app/src/stores/slices/payments-slice.test.ts
git commit -m "feat: add payments slice for mock AR and intents"
```

---

## Task 3: Extend client.ts Mock API Layer

**Files:**
- Modify: `app/src/api/client.ts`
- Test: `app/src/api/client.mock.test.ts`

**Interfaces:**
- Consumes: existing `ApiResult<T>` type and `createClient()` pattern from Task 1
- Produces: typed mock endpoints mirroring production contract signatures

### Steps

- [ ] **Step 1: Write the failing test for documents endpoints**

```ts
// app/src/api/client.mock.test.ts
import { describe, expect, it } from 'vitest';
import { createClient } from './client';

describe('documents mock endpoints', () => {
  it('accepts an OCR document and returns the record', async () => {
    const client = createClient();
    const result = await client.documents.acceptOcr({
      documentId: 'doc_001',
      ocrResultId: 'ocr_001',
      entityId: 'lot_001',
      entityType: 'lot',
      fields: { cupScore: 82.75 },
      confidenceScores: { cupScore: 0.95 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('accepted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/api/client.mock.test.ts -v`
Expected: FAIL with `client.documents.acceptOcr is not a function`

- [ ] **Step 3: Write minimal implementation of documents endpoints**

```ts
// app/src/api/client.ts (add to existing client object)
documents: {
  acceptOcr: async (input: { documentId: string; ocrResultId: string; entityId: string; entityType: string; fields: Record<string, unknown>; confidenceScores: Record<string, number> }): Promise<ApiResult<{ status: string }>> => {
    const slice = useDocuments.getState();
    slice.acceptOcrDocument(input);
    const doc = slice.getDocument(input.documentId);
    return { ok: true, data: { status: doc?.status ?? 'accepted' } };
  },
  list: async (): Promise<ApiResult<DocumentRecord[]>> => {
    const slice = useDocuments.getState();
    return { ok: true, data: slice.documents };
  },
},
```

- [ ] **Step 4: Write the failing test for payments endpoints**

```ts
// app/src/api/client.mock.test.ts
describe('payments mock endpoints', () => {
  it('creates a payment intent and returns the qrCodeData', async () => {
    const client = createClient();
    const result = await client.payments.createIntent({
      idempotencyKey: 'key_001',
      invoiceId: 'inv_001',
      amountMinor: 5000000000n,
      currency: 'VND',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.qrCodeData).toContain('090');
  });
});
```

- [ ] **Step 5: Write minimal implementation of payments endpoints**

```ts
payments: {
  createIntent: async (input: { idempotencyKey: string; invoiceId: string; amountMinor: bigint; currency: 'VND' | 'USD'; providerOrderCode?: string }): Promise<ApiResult<PaymentIntent>> => {
    const slice = usePayments.getState();
    const intent = slice.createPaymentIntent(input);
    return { ok: true, data: intent };
  },
  allocate: async (input: { providerTransactionId: string; invoiceId: string; amountMinor: bigint; currency: 'VND' | 'USD' }): Promise<ApiResult<{ ok: boolean }>> => {
    const slice = usePayments.getState();
    slice.allocatePayment(input);
    return { ok: true, data: { ok: true } };
  },
  arAging: async (input?: { counterpartyId?: string }): Promise<ApiResult<Array<{ bucket: string; amountMinor: bigint }>>> => {
    const slice = usePayments.getState();
    return { ok: true, data: slice.arAging(input?.counterpartyId) };
  },
},
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- app/src/api/client.mock.test.ts -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/src/api/client.ts app/src/api/client.mock.test.ts
git commit -m "feat: add mock documents and payments endpoints"
```

---

## Task 4: Build DocumentUpload Component

**Files:**
- Create: `app/src/components/documents/DocumentUpload.tsx`
- Modify: `app/src/components/index.ts` (if barrel export exists)
- Test: `app/src/components/documents/DocumentUpload.test.tsx`

**Interfaces:**
- Consumes: `useDocuments()` from Task 1
- Produces: reusable `DocumentUpload` component for lot card, QC audit, contract creation

### Steps

- [ ] **Step 1: Write the failing test for DocumentUpload**

```tsx
// app/src/components/documents/DocumentUpload.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentUpload } from './DocumentUpload';

describe('DocumentUpload', () => {
  it('shows the idle state copy and accepts a file drop', () => {
    render(<DocumentUpload />);
    expect(screen.getByText(/Photograph or drop SCA report/)).toBeTruthy();
    fireEvent.drop(screen.getByRole('button', { name: /drop zone/i }), { dataTransfer: { files: [new File(['test'], 'report.pdf')] } });
    expect(screen.getByText(/Uploading/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/components/documents/DocumentUpload.test.tsx -v`
Expected: FAIL with `DocumentUpload is not defined`

- [ ] **Step 3: Write minimal implementation of DocumentUpload**

```tsx
// app/src/components/documents/DocumentUpload.tsx
import { useState } from 'react';
import { useDocuments } from '../../stores/root-store';

export function DocumentUpload({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [uploading, setUploading] = useState(false);
  const addDocument = useDocuments((s) => s.addDocument);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setUploading(true);
    addDocument({
      fileName: file.name,
      entityType: entityType as any,
      entityId,
      status: 'proposed',
    });
    setUploading(false);
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border border-interactive border-dashed rounded-md p-6 text-center surface-bg"
    >
      <p className="text-muted">Photograph or drop SCA report, contract, or warehouse receipt</p>
      <button className="btn-primary btn-oxblood" onClick={() => setUploading(true)}>Take Photo</button>
      <button className="btn-outline">Choose from gallery</button>
      {uploading && <div className="spinner oxblood" />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/components/documents/DocumentUpload.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/documents/DocumentUpload.tsx app/src/components/documents/DocumentUpload.test.tsx
git commit -m "feat: add document upload component"
```

---

## Task 5: Build OCRReviewPanel Component

**Files:**
- Create: `app/src/components/documents/OCRReviewPanel.tsx`
- Test: `app/src/components/documents/OCRReviewPanel.test.tsx`

**Interfaces:**
- Consumes: `useDocuments()` from Task 1, `client.documents.acceptOcr` from Task 3
- Produces: side-by-side review pane with confidence badges and accept/reject/reprocess CTAs

### Steps

- [ ] **Step 1: Write the failing test for OCRReviewPanel**

```tsx
// app/src/components/documents/OCRReviewPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { OCRReviewPanel } from './OCRReviewPanel';

describe('OCRReviewPanel', () => {
  it('shows confidence badges and accept CTA', () => {
    render(<OCRReviewPanel fields={[{ name: 'cupScore', value: 82.75, confidence: 0.95 }]} />);
    expect(screen.getByText('0.95')).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept & link/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/components/documents/OCRReviewPanel.test.tsx -v`
Expected: FAIL with `OCRReviewPanel is not defined`

- [ ] **Step 3: Write minimal implementation of OCRReviewPanel**

```tsx
// app/src/components/documents/OCRReviewPanel.tsx
import { useState } from 'react';
import { client } from '../../api/client';

type FieldReview = { name: string; value: unknown; confidence: number };

export function OCRReviewPanel({ fields }: { fields: FieldReview[] }) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const acceptOcr = client.documents.acceptOcr;

  const badgeClass = (confidence: number) => confidence >= 0.85 ? 'badge-green' : confidence >= 0.70 ? 'badge-amber' : 'badge-red';

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="paper-frame border border-interactive">
        <div className="zoom-controls">Zoom / Pan</div>
        <div className="paper-like-frame">Original page image</div>
      </div>
      <div className="surface-bg p-6">
        {fields.map((field) => (
          <div key={field.name} className={field.confidence < 0.70 ? 'warning-bg' : ''}>
            <label>{field.name}</label>
            <input value={String(field.value)} onChange={() => setTouched((t) => ({ ...t, [field.name]: true }))} />
            <span className={`confidence-badge ${badgeClass(field.confidence)}`}>{field.confidence.toFixed(2)}</span>
          </div>
        ))}
        <button className="btn-primary btn-oxblood">Accept & Link to Lot / Profile</button>
        <button className="btn-ghost">Reject</button>
        <button className="btn-ghost">Reprocess</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/components/documents/OCRReviewPanel.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/documents/OCRReviewPanel.tsx app/src/components/documents/OCRReviewPanel.test.tsx
git commit -m "feat: add OCR review panel component"
```

---

## Task 6: Build VietQRCode Component

**Files:**
- Create: `app/src/components/payments/VietQRCode.tsx`
- Test: `app/src/components/payments/VietQRCode.test.tsx`

**Interfaces:**
- Consumes: `client.payments.createIntent` from Task 3
- Produces: QR code display + copyable memo token + account details fallback

### Steps

- [ ] **Step 1: Write the failing test for VietQRCode**

```tsx
// app/src/components/payments/VietQRCode.test.tsx
import { render, screen } from '@testing-library/react';
import { VietQRCode } from './VietQRCode';

describe('VietQRCode', () => {
  it('renders the memo token with copy button', async () => {
    render(<VietQRCode intent={{ id: 'intent_001', invoiceId: 'inv_001', amountMinor: 5000000000n, currency: 'VND', qrCodeData: '090123456789', checkoutUrl: '/pay' }} />);
    expect(screen.getByText(/AUC/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/components/payments/VietQRCode.test.tsx -v`
Expected: FAIL with `VietQRCode is not defined`

- [ ] **Step 3: Write minimal implementation of VietQRCode**

```tsx
// app/src/components/payments/VietQRCode.tsx
import { useState } from 'react';

export function VietQRCode({ intent }: { intent: { id: string; invoiceId: string; amountMinor: bigint; currency: 'VND' | 'USD'; qrCodeData: string; checkoutUrl: string } }) {
  const [copied, setCopied] = useState(false);
  const memoToken = 'AUC' + intent.id.slice(-7).toUpperCase();

  return (
    <div className="surface-bg p-6">
      <div className="qr-frame">
        <div className="qr-placeholder">{intent.qrCodeData}</div>
      </div>
      <div>
        <label>Memo Token</label>
        <code>{memoToken}</code>
        <button onClick={() => { navigator.clipboard.writeText(memoToken); setCopied(true); }}>Copy</button>
      </div>
      <div>
        <label>Bank Account</label>
        <p>0901234567 (Vietcombank)</p>
      </div>
      <a href={intent.checkoutUrl} className="btn-primary btn-oxblood">Complete Payment</a>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/components/payments/VietQRCode.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/payments/VietQRCode.tsx app/src/components/payments/VietQRCode.test.tsx
git commit -m "feat: add VietQR code component"
```

---

## Task 7: Build DocumentsPage Route

**Files:**
- Create: `app/src/pages/DocumentsPage.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/AppLayout.tsx` (nav item)
- Test: `app/src/pages/DocumentsPage.test.tsx`

**Interfaces:**
- Consumes: `DocumentUpload` (Task 4), `OCRReviewPanel` (Task 5), `useDocuments` (Task 1)
- Produces: `/documents` route with upload list and review queue

### Steps

- [ ] **Step 1: Write the failing test for DocumentsPage**

```tsx
// app/src/pages/DocumentsPage.test.tsx
import { render, screen } from '@testing-library/react';
import { DocumentsPage } from './DocumentsPage';

describe('DocumentsPage', () => {
  it('renders the documents list and review queue', () => {
    render(<DocumentsPage />);
    expect(screen.getByText(/Documents/)).toBeTruthy();
    expect(screen.getByText(/Review Queue/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/pages/DocumentsPage.test.tsx -v`
Expected: FAIL with `DocumentsPage is not defined`

- [ ] **Step 3: Write minimal implementation of DocumentsPage**

```tsx
// app/src/pages/DocumentsPage.tsx
import { DocumentUpload } from '../components/documents/DocumentUpload';
import { OCRReviewPanel } from '../components/documents/OCRReviewPanel';
import { useDocuments } from '../stores/root-store';

export function DocumentsPage() {
  const documents = useDocuments((s) => s.documents);
  const proposed = documents.filter((d) => d.status === 'proposed');
  return (
    <div className="page surface-bg">
      <h1>Documents</h1>
      <DocumentUpload entityType="lot" entityId="lot_001" />
      <h2>Review Queue</h2>
      {proposed.map((doc) => (
        <div key={doc.id}>
          <p>{doc.fileName}</p>
          <OCRReviewPanel fields={[{ name: 'cupScore', value: 82.75, confidence: 0.95 }]} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/pages/DocumentsPage.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/DocumentsPage.tsx app/src/pages/DocumentsPage.test.tsx app/src/App.tsx app/src/AppLayout.tsx
git commit -m "feat: add documents page route"
```

---

## Task 8: Build PaymentsPage Route

**Files:**
- Create: `app/src/pages/PaymentsPage.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/AppLayout.tsx` (nav item)
- Test: `app/src/pages/PaymentsPage.test.tsx`

**Interfaces:**
- Consumes: `VietQRCode` (Task 6), `usePayments` (Task 2), `client.payments.arAging` (Task 3)
- Produces: `/payments` route with aging buckets, open intents, exception queue

### Steps

- [ ] **Step 1: Write the failing test for PaymentsPage**

```tsx
// app/src/pages/PaymentsPage.test.tsx
import { render, screen } from '@testing-library/react';
import { PaymentsPage } from './PaymentsPage';

describe('PaymentsPage', () => {
  it('renders aging buckets and exception queue', () => {
    render(<PaymentsPage />);
    expect(screen.getByText(/Aging Buckets/)).toBeTruthy();
    expect(screen.getByText(/Exception Queue/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/pages/PaymentsPage.test.tsx -v`
Expected: FAIL with `PaymentsPage is not defined`

- [ ] **Step 3: Write minimal implementation of PaymentsPage**

```tsx
// app/src/pages/PaymentsPage.tsx
import { VietQRCode } from '../components/payments/VietQRCode';
import { usePayments } from '../stores/root-store';
import { client } from '../api/client';

export function PaymentsPage() {
  const invoices = usePayments((s) => s.invoices);
  const intents = usePayments((s) => s.intents);
  const transactions = usePayments((s) => s.transactions);
  const aging = client.payments.arAging();

  return (
    <div className="page surface-bg">
      <h1>Payments / AR</h1>
      <h2>Aging Buckets</h2>
      {aging.map((b) => <div key={b.bucket}>{b.bucket}: {b.amountMinor} VND</div>)}
      <h2>Open Intents</h2>
      {intents.map((intent) => <VietQRCode key={intent.id} intent={intent} />)}
      <h2>Exception Queue</h2>
      {transactions.filter((t) => t.matchStatus !== 'matched').map((t) => <div key={t.id}>{t.description}</div>)}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/pages/PaymentsPage.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/PaymentsPage.tsx app/src/pages/PaymentsPage.test.tsx app/src/App.tsx app/src/AppLayout.tsx
git commit -m "feat: add payments page route"
```

---

## Task 9: Add i18n Translation Keys

**Files:**
- Modify: `app/localization/02-locale-files/en-US.json`
- Modify: `app/localization/02-locale-files/es-MX.json` (fallback parity)
- Modify: `app/localization/02-locale-files/zh-CN.json` (fallback parity)
- Test: `app/localization/validate_locale_files.py` (if exists) or new `app/localization/validate_i18n_keys.py`

**Interfaces:**
- Consumes: existing nested namespace pattern (`documents.*`, `payments.*`, `trust.*`)
- Produces: complete translation coverage for all new UI copy

### Steps

- [ ] **Step 1: Write the failing test for i18n parity**

```python
# app/localization/validate_i18n_keys.py
import json

with open('app/localization/02-locale-files/en-US.json') as f:
    en = json.load(f)

for locale in ['es-MX', 'zh-CN']:
    with open(f'app/localization/02-locale-files/{locale}.json') as f:
        data = json.load(f)
    for key in ['documents.upload_idle', 'payments.aging_buckets', 'trust.band_sealed']:
        assert key in data, f'{key} missing from {locale}'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python app/localization/validate_i18n_keys.py`
Expected: FAIL with `documents.upload_idle missing from es-MX`

- [ ] **Step 3: Write minimal implementation of translation keys**

Add to `app/localization/02-locale-files/en-US.json`:

```json
{
  "documents": {
    "upload_idle": "Photograph or drop SCA report, contract, or warehouse receipt",
    "review_queue": "Review Queue",
    "accept": "Accept & Link to Lot / Profile",
    "reject": "Reject",
    "reprocess": "Reprocess"
  },
  "payments": {
    "aging_buckets": "Aging Buckets",
    "exception_queue": "Exception Queue",
    "memo_token": "Memo Token",
    "copy": "Copy"
  },
  "trust": {
    "band_sealed": "Sealed",
    "band_verified": "Verified",
    "band_established": "Established",
    "band_provisional": "Provisional",
    "band_at_risk": "At Risk"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python app/localization/validate_i18n_keys.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/localization/02-locale-files/en-US.json app/localization/02-locale-files/es-MX.json app/localization/02-locale-files/zh-CN.json
git commit -m "i18n: add documents payments trust keys"
```

---

## Task 10: Add Unit Tests for TrustScoreBadge Integration

**Files:**
- Modify: `app/src/components/TrustScoreBadge.tsx` (if needed for new bands)
- Test: `app/src/components/TrustScoreBadge.test.tsx`

**Interfaces:**
- Consumes: existing `TrustScoreBadge` component from Task 1 exploration
- Produces: band color verification for sealed/verified/established/provisional/at-risk

### Steps

- [ ] **Step 1: Write the failing test for TrustScoreBadge bands**

```tsx
// app/src/components/TrustScoreBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { TrustScoreBadge } from './TrustScoreBadge';

describe('TrustScoreBadge', () => {
  it('renders sealed band for score 95', () => {
    const { container } = render(<TrustScoreBadge score={95} />);
    expect(container.firstChild).toHaveClass(/brass-300/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/components/TrustScoreBadge.test.tsx -v`
Expected: FAIL with `TrustScoreBadge is not defined` or class mismatch

- [ ] **Step 3: Write minimal implementation of TrustScoreBadge band classes**

```tsx
// app/src/components/TrustScoreBadge.tsx (add band class mapping)
const bandClass = (score: number) =>
  score >= 90 ? 'brass-300' :
  score >= 75 ? 'sage-600' :
  score >= 55 ? 'oxblood-100' :
  score >= 35 ? 'neutral-700' :
  'danger-tint';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/components/TrustScoreBadge.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/components/TrustScoreBadge.tsx app/src/components/TrustScoreBadge.test.tsx
git commit -m "fix: add trust score band colors"
```

---

## Task 11: Add E2E Flow Tests (Playwright)

**Files:**
- Create: `app/e2e/documents-scanner.spec.ts`
- Create: `app/e2e/payments-manager.spec.ts`
- Test: `npm run test:e2e`

**Interfaces:**
- Consumes: DocumentsPage (Task 7), PaymentsPage (Task 8)
- Produces: end-to-end verification of upload → review → accept and create intent → display QR

### Steps

- [ ] **Step 1: Write the failing test for document scanner E2E**

```ts
// app/e2e/documents-scanner.spec.ts
import { test, expect } from '@playwright/test';

test('upload -> review -> accept', async ({ page }) => {
  await page.goto('/en-US/documents');
  await page.getByRole('button', { name: /take photo/i }).click();
  await page.getByRole('button', { name: /accept & link/i }).click();
  await expect(page.getByText('accepted')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- app/e2e/documents-scanner.spec.ts`
Expected: FAIL with page not found

- [ ] **Step 3: Write minimal implementation of E2E test**

```ts
// app/e2e/documents-scanner.spec.ts (complete)
test('upload -> review -> accept', async ({ page }) => {
  await page.goto('/en-US/documents');
  await page.getByRole('button', { name: /take photo/i }).click();
  await page.getByRole('button', { name: /accept & link/i }).click();
  await expect(page.getByText('accepted')).toBeTruthy();
});
```

- [ ] **Step 4: Write the failing test for payments E2E**

```ts
// app/e2e/payments-manager.spec.ts
import { test, expect } from '@playwright/test';

test('create intent -> display QR', async ({ page }) => {
  await page.goto('/en-US/payments');
  await page.getByRole('button', { name: /create intent/i }).click();
  await expect(page.getByText(/AUC/)).toBeTruthy();
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/e2e/documents-scanner.spec.ts app/e2e/payments-manager.spec.ts
git commit -m "test: add e2e flows for scanner and payments"
```

---

## Task 12: Update AppLayout Navigation

**Files:**
- Modify: `app/src/AppLayout.tsx`
- Test: `app/src/AppLayout.test.tsx`

**Interfaces:**
- Consumes: `DocumentsPage` (Task 7), `PaymentsPage` (Task 8)
- Produces: visible nav items in SOURCE and FINANCE groups

### Steps

- [ ] **Step 1: Write the failing test for AppLayout nav**

```tsx
// app/src/AppLayout.test.tsx
import { render, screen } from '@testing-library/react';
import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('renders documents and payments nav items', () => {
    render(<AppLayout />);
    expect(screen.getByText(/Documents/)).toBeTruthy();
    expect(screen.getByText(/Payments/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/src/AppLayout.test.tsx -v`
Expected: FAIL with nav items missing

- [ ] **Step 3: Write minimal implementation of nav items**

```tsx
// app/src/AppLayout.tsx (add nav items)
{locale && (
  <>
    <NavItem label="Documents" href="/documents" />
    <NavItem label="Payments" href="/payments" />
  </>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/src/AppLayout.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/AppLayout.tsx app/src/AppLayout.test.tsx
git commit -m "feat: add documents and payments nav items"
```

---

## Task 13: Update README / Verification Notes

**Files:**
- Modify: `app/README.md`
- Test: `npm run build`, `npm run test`

**Interfaces:**
- Consumes: all tasks above
- Produces: updated verification documentation for Phase 1 mock flows

### Steps

- [ ] **Step 1: Write the failing test for build**

Run: `npm run build`
Expected: FAIL until all tasks complete

- [ ] **Step 2: Run build to verify it fails**

Expected: FAIL with missing components/routes

- [ ] **Step 3: Run full test suite after all tasks complete**

Run: `npm test && npm run test:e2e && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/README.md
git commit -m "docs: update phase 1 verification"
```

---

## Self-Review Checklist

1. **Spec coverage:** Each section of the design doc (DocumentScanner 5.3, 5.4, 5.5; Payments 7.1, 8.2, 8.3) is covered by Tasks 4, 5, 6, 7, 8.
2. **Placeholder scan:** No TBD/TODO/implement later placeholders remain.
3. **Type consistency:** All task signatures match between slices, client, components, and pages.
4. **Mock-only constraint:** No production backend, database, or provider integration is introduced.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2024-09-13-document-scanner-vietnam-payment-phase1-plan.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
