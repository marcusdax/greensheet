import { api } from '../../api/client';
import type { Order, OrderLineItem, Problem } from '../../types/api';

export interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
}

export interface OrdersActions {
  loadOrders: (params?: { cursor?: string; accountId?: string; status?: Order['status'][] }) => Promise<void>;
  createOrder: (input: { accountId: string; lineItems: OrderLineItem[] }) => Promise<Order | null>;
  processOrder: (id: string) => Promise<Order | null>;
  shipOrder: (id: string) => Promise<Order | null>;
  deliverOrder: (id: string) => Promise<Order | null>;
  cancelOrder: (id: string) => Promise<Order | null>;
  returnOrder: (id: string) => Promise<Order | null>;
}

export type OrdersSlice = OrdersState & OrdersActions;

export const initialOrdersState: OrdersState = {
  orders: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
};

export const createOrdersSlice = (set: any) => ({
  ...initialOrdersState,
  loadOrders: async (params: { cursor?: string; accountId?: string; status?: Order['status'][] } = {}) => {
    set((s: any) => { s.orders.loading = true; s.orders.error = null; }, false, 'orders/loadOrders/start');
    const res = await api.orders.list(params);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; s.orders.loading = false; }, false, 'orders/loadOrders/error');
    } else {
      set((s: any) => {
        s.orders.orders = params.cursor ? [...s.orders.orders, ...res.data.data.map((o: Order) => ({ ...o }))] : res.data.data.map((o: Order) => ({ ...o }));
        s.orders.cursor = res.data.page.nextCursor;
        s.orders.hasMore = res.data.page.hasMore;
        s.orders.loading = false;
      }, false, 'orders/loadOrders/done');
    }
  },
  createOrder: async (input: { accountId: string; lineItems: OrderLineItem[] }) => {
    const res = await api.orders.create(input, crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/createOrder/error');
      return null;
    }
    set((s: any) => { s.orders.orders.unshift({ ...res.data }); }, false, 'orders/createOrder/done');
    return res.data;
  },
  processOrder: async (id: string) => {
    const res = await api.orders.process(id);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/processOrder/error');
      return null;
    }
    set((s: any) => {
      const idx = s.orders.orders.findIndex((o: Order) => o.id === id);
      if (idx >= 0) s.orders.orders[idx] = res.data;
    }, false, 'orders/processOrder/done');
    return res.data;
  },
  shipOrder: async (id: string) => {
    const res = await api.orders.ship(id);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/shipOrder/error');
      return null;
    }
    set((s: any) => {
      const idx = s.orders.orders.findIndex((o: Order) => o.id === id);
      if (idx >= 0) s.orders.orders[idx] = res.data;
    }, false, 'orders/shipOrder/done');
    return res.data;
  },
  deliverOrder: async (id: string) => {
    const res = await api.orders.deliver(id);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/deliverOrder/error');
      return null;
    }
    set((s: any) => {
      const idx = s.orders.orders.findIndex((o: Order) => o.id === id);
      if (idx >= 0) s.orders.orders[idx] = res.data;
    }, false, 'orders/deliverOrder/done');
    return res.data;
  },
  cancelOrder: async (id: string) => {
    const res = await api.orders.cancel(id);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/cancelOrder/error');
      return null;
    }
    set((s: any) => {
      const idx = s.orders.orders.findIndex((o: Order) => o.id === id);
      if (idx >= 0) s.orders.orders[idx] = res.data;
    }, false, 'orders/cancelOrder/done');
    return res.data;
  },
  returnOrder: async (id: string) => {
    const res = await api.orders.return(id);
    if ('problem' in res) {
      set((s: any) => { s.orders.error = res.problem; }, false, 'orders/returnOrder/error');
      return null;
    }
    set((s: any) => {
      const idx = s.orders.orders.findIndex((o: Order) => o.id === id);
      if (idx >= 0) s.orders.orders[idx] = res.data;
    }, false, 'orders/returnOrder/done');
    return res.data;
  },
});
