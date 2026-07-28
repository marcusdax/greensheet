import { api } from '../../api/client';
import type { CoffeeLot, CoffeeLotCreate, CoffeeLotPatch, Reservation, Problem } from '../../types/api';

export interface CatalogState {
  lots: CoffeeLot[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
  reservations: Reservation[];
}

export interface CatalogActions {
  loadLots: (params?: { cursor?: string; origins?: string[]; minCupScore?: number; maxPricePerLbCents?: number }) => Promise<void>;
  createLot: (input: CoffeeLotCreate, idempotencyKey?: string) => Promise<CoffeeLot | null>;
  updateLot: (id: string, patch: CoffeeLotPatch) => Promise<CoffeeLot | null>;
  retireLot: (id: string) => Promise<CoffeeLot | null>;
  reserveLot: (lotId: string, input: { quantityLbs: number; orderId: string }, idempotencyKey?: string) => Promise<Reservation | null>;
}

export type CatalogSlice = CatalogState & CatalogActions;

export const initialCatalogState: CatalogState = {
  lots: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
  reservations: [],
};

export const createCatalogSlice = (set: any) => ({
  ...initialCatalogState,
  loadLots: async (params: { cursor?: string; origins?: string[]; minCupScore?: number; maxPricePerLbCents?: number } = {}) => {
    set((s: any) => { s.catalog.loading = true; s.catalog.error = null; }, false, 'catalog/loadLots/start');
    const res = await api.catalog.list(params);
    if ('problem' in res) {
      set((s: any) => { s.catalog.error = res.problem; s.catalog.loading = false; }, false, 'catalog/loadLots/error');
    } else {
      set((s: any) => {
        s.catalog.lots = params.cursor ? [...s.catalog.lots, ...res.data.data.map((l: CoffeeLot) => ({ ...l }))] : res.data.data.map((l: CoffeeLot) => ({ ...l }));
        s.catalog.cursor = res.data.page.nextCursor;
        s.catalog.hasMore = res.data.page.hasMore;
        s.catalog.loading = false;
      }, false, 'catalog/loadLots/done');
    }
  },
  createLot: async (input: CoffeeLotCreate, idempotencyKey?: string) => {
    const res = await api.catalog.create(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.catalog.error = res.problem; }, false, 'catalog/createLot/error');
      return null;
    }
    set((s: any) => {
      const idx = s.catalog.lots.findIndex((l: CoffeeLot) => l.id === res.data.id);
      if (idx >= 0) s.catalog.lots[idx] = { ...res.data };
      else s.catalog.lots.unshift({ ...res.data });
    }, false, 'catalog/createLot/done');
    return res.data;
  },
  updateLot: async (id: string, patch: CoffeeLotPatch) => {
    const res = await api.catalog.patch(id, patch);
    if ('problem' in res) {
      set((s: any) => { s.catalog.error = res.problem; }, false, 'catalog/updateLot/error');
      return null;
    }
    set((s: any) => {
      const idx = s.catalog.lots.findIndex((l: CoffeeLot) => l.id === id);
      if (idx >= 0) s.catalog.lots[idx] = res.data;
    }, false, 'catalog/updateLot/done');
    return res.data;
  },
  retireLot: async (id: string) => {
    const res = await api.catalog.patch(id, { status: 'retired' });
    if ('problem' in res) {
      set((s: any) => { s.catalog.error = res.problem; }, false, 'catalog/retireLot/error');
      return null;
    }
    set((s: any) => {
      const idx = s.catalog.lots.findIndex((l: CoffeeLot) => l.id === id);
      if (idx >= 0) s.catalog.lots[idx] = res.data;
    }, false, 'catalog/retireLot/done');
    return res.data;
  },
  reserveLot: async (lotId: string, input: { quantityLbs: number; orderId: string }, idempotencyKey?: string) => {
    const res = await api.catalog.reserve(lotId, input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.catalog.error = res.problem; }, false, 'catalog/reserveLot/error');
      return null;
    }
    set((s: any) => {
      const existing = s.catalog.reservations.find((r: Reservation) => r.id === res.data.id);
      if (!existing) {
        const idx = s.catalog.lots.findIndex((l: CoffeeLot) => l.id === lotId);
        if (idx >= 0) s.catalog.lots[idx].availableQuantityLbs -= input.quantityLbs;
      }
      const idx = s.catalog.reservations.findIndex((r: Reservation) => r.id === res.data.id);
      if (idx >= 0) s.catalog.reservations[idx] = { ...res.data };
      else s.catalog.reservations.unshift({ ...res.data });
    }, false, 'catalog/reserveLot/done');
    return res.data;
  },
});
