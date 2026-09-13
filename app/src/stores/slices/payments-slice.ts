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

export const createPaymentsSlice = (set: any, get: any) => {
  return {
    intents: [],
    invoices: [],
    transactions: [],
    createInvoice: (input) => {
      const invoice: InvoiceRecord = {
        id: `inv_${Date.now()}`,
        invoiceNumber: `INV-${Date.now()}`,
        counterpartyId: input.counterpartyId,
        currency: input.currency,
        totalMinor: input.totalMinor,
        paidMinor: 0n,
        dueAt: input.dueAt,
        status: 'issued',
      };
      set((state: any) => { state.payments.invoices.push(invoice); });
      return invoice;
    },
    createPaymentIntent: (input) => {
      const intent: PaymentIntent = {
        id: `intent_${Date.now()}`,
        invoiceId: input.invoiceId,
        idempotencyKey: input.idempotencyKey,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: 'awaiting_payment',
        providerOrderCode: input.providerOrderCode,
        qrCodeData: '090123456789',
        checkoutUrl: '/pay',
        createdAt: new Date().toISOString(),
      };
      set((state: any) => { state.payments.intents.push(intent); });
      return intent;
    },
    allocatePayment: (input) => {
      set((state: any) => {
        const invoice = state.payments.invoices.find((i: any) => i.id === input.invoiceId);
        if (invoice) {
          invoice.paidMinor += input.amountMinor;
          invoice.status = invoice.paidMinor >= invoice.totalMinor ? 'paid' : 'partially_paid';
        }
        state.payments.transactions.push({
          id: `txn_${Date.now()}`,
          provider: 'payos',
          providerTxnId: input.providerTransactionId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: 'VietQR payment',
          matchStatus: 'matched',
        });
      });
    },
    arAging: (counterpartyId?: string) => {
      const invoices = get().payments.invoices.filter((i: any) => !counterpartyId || i.counterpartyId === counterpartyId);
      const today = new Date();
      return invoices.reduce((acc, inv) => {
        const daysOverdue = Math.floor((today - new Date(inv.dueAt)) / 86400000);
        const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? 'b30' : daysOverdue <= 60 ? 'b60' : daysOverdue <= 90 ? 'b90' : 'b90plus';
        acc.push({ bucket, amountMinor: inv.totalMinor - inv.paidMinor });
        return acc;
      }, [] as Array<{ bucket: 'current' | 'b30' | 'b60' | 'b90' | 'b90plus'; amountMinor: bigint }>);
    },
  };
};