import { api } from '../../api/client';
import type { WebhookSubscription, WebhookSubscriptionCreate, WebhookSubscriptionPatch, WebhookDelivery, WebhookSubscriptionWithSecret, Problem } from '../../types/api';

export interface WebhooksState {
  webhooks: WebhookSubscription[];
  deliveries: WebhookDelivery[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
  lastCreatedSecret: string | null;
}

export interface WebhooksActions {
  loadWebhooks: (params?: { cursor?: string; status?: WebhookSubscription['status'][] }) => Promise<void>;
  createWebhook: (input: WebhookSubscriptionCreate, idempotencyKey?: string) => Promise<WebhookSubscriptionWithSecret | null>;
  updateWebhook: (id: string, patch: WebhookSubscriptionPatch) => Promise<WebhookSubscription | null>;
  deleteWebhook: (id: string) => Promise<boolean>;
  loadDeliveries: (id: string) => Promise<WebhookDelivery[] | null>;
  clearSecret: () => void;
}

export type WebhooksSlice = WebhooksState & WebhooksActions;

export const initialWebhooksState: WebhooksState = {
  webhooks: [],
  deliveries: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
  lastCreatedSecret: null,
};

export const createWebhooksSlice = (set: any) => ({
  ...initialWebhooksState,
  loadWebhooks: async (params: { cursor?: string; status?: WebhookSubscription['status'][] } = {}) => {
    set((s: any) => { s.webhooks.loading = true; s.webhooks.error = null; }, false, 'webhooks/loadWebhooks/start');
    const res = await api.webhooks.list(params);
    if ('problem' in res) {
      set((s: any) => { s.webhooks.error = res.problem; s.webhooks.loading = false; }, false, 'webhooks/loadWebhooks/error');
    } else {
      set((s: any) => {
        s.webhooks.webhooks = params.cursor ? [...s.webhooks.webhooks, ...res.data.data.map((w: WebhookSubscription) => ({ ...w }))] : res.data.data.map((w: WebhookSubscription) => ({ ...w }));
        s.webhooks.cursor = res.data.page.nextCursor;
        s.webhooks.hasMore = res.data.page.hasMore;
        s.webhooks.loading = false;
      }, false, 'webhooks/loadWebhooks/done');
    }
  },
  createWebhook: async (input: WebhookSubscriptionCreate, idempotencyKey?: string) => {
    const res = await api.webhooks.create(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.webhooks.error = res.problem; }, false, 'webhooks/createWebhook/error');
      return null;
    }
    const { signingSecret, ...webhook } = res.data;
    set((s: any) => {
      s.webhooks.webhooks.unshift(webhook);
      s.webhooks.lastCreatedSecret = signingSecret;
    }, false, 'webhooks/createWebhook/done');
    return res.data;
  },
  updateWebhook: async (id: string, patch: WebhookSubscriptionPatch) => {
    const res = await api.webhooks.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.webhooks.error = res.problem; }, false, 'webhooks/updateWebhook/error');
      return null;
    }
    set((s: any) => {
      const idx = s.webhooks.webhooks.findIndex((w: WebhookSubscription) => w.id === id);
      if (idx >= 0) s.webhooks.webhooks[idx] = res.data;
    }, false, 'webhooks/updateWebhook/done');
    return res.data;
  },
  deleteWebhook: async (id: string) => {
    const res = await api.webhooks.delete(id);
    if ('problem' in res) {
      set((s: any) => { s.webhooks.error = res.problem; }, false, 'webhooks/deleteWebhook/error');
      return false;
    }
    set((s: any) => {
      s.webhooks.webhooks = s.webhooks.webhooks.filter((w: WebhookSubscription) => w.id !== id);
    }, false, 'webhooks/deleteWebhook/done');
    return true;
  },
  loadDeliveries: async (id: string) => {
    const res = await api.webhooks.deliveries(id);
    if ('problem' in res) {
      set((s: any) => { s.webhooks.error = res.problem; }, false, 'webhooks/loadDeliveries/error');
      return null;
    }
    set((s: any) => { s.webhooks.deliveries = res.data; }, false, 'webhooks/loadDeliveries/done');
    return res.data;
  },
  clearSecret: () => {
    set((s: any) => { s.webhooks.lastCreatedSecret = null; }, false, 'webhooks/clearSecret');
  },
});
