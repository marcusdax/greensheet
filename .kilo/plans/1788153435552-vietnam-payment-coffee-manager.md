# Auctum Ledger Coffee Business Manager: Vietnam Payment Integration & Beyond

The previous section outlined the Vietnamese payment landscape and the strategic need for a dedicated **Coffee Business Manager** layered on Auctum Ledger. This document deepens that into a concrete implementation plan—aligned with the existing Greensheet monorepo—and then extends it with additional improvements that turn the system into a true operational backbone for Vietnamese coffee businesses.

---

## 1. Architectural Integration with Auctum Ledger

The Manager and Payments features will live as **two new bounded contexts** inside the existing `app/` directory, following established patterns (tRPC routers, Drizzle schema, React pages). They reuse `coffee_lots` as the source of truth for green coffee, while introducing their own operational tables for products, inventory, orders, and payments.

**Bounded Contexts:**

- **Coffee Business Manager** – Products (green lots & roasted SKUs), warehouses, inventory movements, customers, suppliers, sales orders, purchase orders, accounts receivable.
- **Payments** – Payment methods, intents, transactions, reconciliations, webhook handling.

**Key Design Decisions:**

- **Money as integer cents** – consistent with existing `pricePerLbCents` convention.
- **Event-driven** via `emitEvent` – payment success emits `payment.received`, which triggers AR clearing.
- **Idempotency** – all payment callbacks deduped by `(provider, providerTxnId)`.
- **Separate schemas** – `db/manager-schema.ts` and `db/payments-schema.ts`, cross-referencing `coffee_lots.id`.

---

## 2. Vietnam Payments: Implementation Deep-Dive

### 2.1 VietQR (Phase 1 – B2B Workhorse)

VietQR is the backbone for business payments in Vietnam. Integration via **Casso** or **PayOS** aggregators provides:

- **Dynamic QR generation** per invoice with embedded reference code.
- **Real-time webhooks** on successful bank transfer.
- **Zero-fee** for customers; merchant fees negligible.

**Workflow:**

1. Invoice created → Payment Intent with `qrPayload` generated.
2. Customer scans QR using any Vietnamese bank app.
3. Bank sends instant interbank transfer via NAPAS.
4. Aggregator webhook hits `/webhooks/casso` with transaction details.
5. System verifies signature, matches to intent, marks invoice paid, emits event.

### 2.2 E-Wallets (Phase 2 – MoMo & ZaloPay)

E-wallets capture B2C and micro‑B2B payments. Adapters will be built for:

- **MoMo** – `payUrl` deep‑link, HMAC‑SHA256 callback verification, refunds via API.
- **ZaloPay** – `payUrl`, `zptransid`, MAC verification.

Both support one‑time payments, subscriptions, and refunds. Merchant onboarding requires a Vietnamese legal entity; this will be flagged for business/legal teams.

### 2.3 Manual Bank Transfer (Fallback)

For customers who prefer manual transfer, the system:

- Shows a static QR (same as VietQR) or a virtual account number (via aggregator).
- Optionally ingests bank statements via API to auto-match incoming transfers by reference or amount.

### 2.4 Cash on Delivery (COD) – Deferred

COD remains important for e‑commerce but introduces risk. It will be integrated later with shipping partners (GHN, GHTK) and deposit requirements for high‑value orders.

---

## 3. Additional Improvements Beyond the Base Plan

The original plan covers the essentials. The following enhancements transform Auctum Ledger into a competitive advantage.

### 3.1 AI‑Powered Financial Assistant

The existing AI Assistant module will be extended to handle payment queries in natural language (Vietnamese and English):

- *“Which customers have overdue invoices over 5 triệu đồng?”*
- *“Show me today’s revenue by payment method.”*
- *“Generate a VietQR for invoice #1042.”*

It will also use image recognition to extract transfer details from screenshots when a customer manually confirms payment, reducing manual reconciliation.

### 3.2 Offline‑First PWA with Order Queue

Vietnamese café owners often work in poor connectivity areas. The Manager PWA will:

- Cache product catalog and inventory levels locally.
- Allow creating sales orders offline.
- Queue payment intents; when connectivity returns, sync and generate QR codes.

This ensures no sale is lost due to network issues.

### 3.3 Multi‑Currency for Exporters

While most transactions are in VND, Vietnamese exporters selling green coffee internationally need USD support. The Manager will:

- Support `USD` as a currency on sales orders.
- Allow FX conversion display (using live rates from a provider).
- Enable payment via SWIFT or international cards (Stripe/PayPal) through the same payment intent flow.

### 3.4 Automated Dunning & Smart Reminders

AR aging will be linked to an automated communication engine:

- **Day 0** – Invoice sent with payment link.
- **Day 3** – Friendly reminder via Zalo/email with fresh QR.
- **Day 7** – Escalation to phone call task.
- **Day 14** – Offer installment plan via MoMo.

The system tracks which channels get the best response and adjusts templates accordingly.

### 3.5 Integration with Vietnamese E‑Invoice (Hóa Đơn Điện Tử)

Auctum Ledger will generate VAT‑compliant e‑invoices (Thông tư 78/2021/TT‑BTC) directly from sales orders. This removes a major headache for businesses and improves legal compliance. Integration can be via official providers (e.g., VNPT, MISA, or Viettel).

### 3.6 Recurring B2B Subscriptions

Many cafés order beans weekly. The Manager will support:

- Standing orders with auto‑generated invoices.
- Payment via saved MoMo/ZaloPay tokens (with customer consent).
- Auto‑charge on due date, reducing churn.

### 3.7 Marketplace & Direct Trade Features

Leveraging Auctum Ledger’s existing lot data, the Manager can evolve into a marketplace:

- Roasters can discover green lots from Vietnamese importers.
- Importers can list lots with verified cup scores.
- Payment escrow via VietQR or bank transfer ensures trust.

This positions Auctum as both an operational tool and a trading platform.

### 3.8 Sustainability & Traceability Tied to Payment

When a roaster pays for a green lot through the system, the transaction automatically carries provenance data. Buyers can see the farm, processing method, and certifications. This reinforces Auctum’s brand promise: *Value is co‑created, not extracted.*

---

## 4. Phased Rollout Strategy

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **A – Foundation** | Months 1–2 | Manager schema, tRPC routers, basic UI (dashboard, products, inventory, orders, customers). |
| **B – Payments MVP** | Months 3–4 | VietQR via Casso/PayOS, payment intents, webhooks, reconciliation. |
| **C – E-Wallets** | Months 5–6 | MoMo & ZaloPay adapters, payment method registry, AR clearing on paid event. |
| **D – PWA & Offline** | Months 7–8 | Offline order queue, QR rendering, service worker. |
| **E – Advanced Features** | Months 9–12 | AI assistant extensions, multi-currency, dunning, e-invoice integration, marketplace pilot. |

---

## 5. Conclusion

Auctum Ledger Coffee Business Manager, with its deep Vietnam payment integration, is not just a tool—it’s the operating system for specialty coffee in one of the world’s most dynamic markets. By building on a verified data layer and adding payment rails that match local behavior, we remove friction, build trust, and enable growth. The additional improvements outlined here ensure that the system remains ahead of the curve, turning Auctum into an indispensable partner for every coffee business in Vietnam—and eventually across the global south.

**Auctum. Value is co‑created, not extracted.**