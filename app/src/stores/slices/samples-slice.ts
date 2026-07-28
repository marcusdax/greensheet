import { api } from '../../api/client';
import type { SampleKit, SampleKitCreate, SampleFeedback, Problem } from '../../types/api';

export interface SamplesState {
  kits: SampleKit[];
  loading: boolean;
  error: Problem | null;
  cursor: string | null;
  hasMore: boolean;
}

export interface SamplesActions {
  loadKits: (params?: { cursor?: string; roasterId?: string; status?: SampleKit['status'][] }) => Promise<void>;
  createKit: (input: SampleKitCreate, idempotencyKey?: string) => Promise<SampleKit | null>;
  submitFeedback: (input: SampleFeedback, idempotencyKey?: string) => Promise<SampleKit | null>;
}

export type SamplesSlice = SamplesState & SamplesActions;

export const initialSamplesState: SamplesState = {
  kits: [],
  loading: false,
  error: null,
  cursor: null,
  hasMore: false,
};

export const createSamplesSlice = (set: any) => ({
  ...initialSamplesState,
  loadKits: async (params: { cursor?: string; roasterId?: string; status?: SampleKit['status'][] } = {}) => {
    set((s: any) => { s.samples.loading = true; s.samples.error = null; }, false, 'samples/loadKits/start');
    const res = await api.sampleKits.list(params);
    if ('problem' in res) {
      set((s: any) => { s.samples.error = res.problem; s.samples.loading = false; }, false, 'samples/loadKits/error');
    } else {
      set((s: any) => {
        s.samples.kits = params.cursor ? [...s.samples.kits, ...res.data.data.map((k: SampleKit) => ({ ...k }))] : res.data.data.map((k: SampleKit) => ({ ...k }));
        s.samples.cursor = res.data.page.nextCursor;
        s.samples.hasMore = res.data.page.hasMore;
        s.samples.loading = false;
      }, false, 'samples/loadKits/done');
    }
  },
  createKit: async (input: SampleKitCreate, idempotencyKey?: string) => {
    const res = await api.sampleKits.create(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.samples.error = res.problem; }, false, 'samples/createKit/error');
      return null;
    }
    set((s: any) => {
      const idx = s.samples.kits.findIndex((k: SampleKit) => k.id === res.data.id);
      if (idx >= 0) s.samples.kits[idx] = { ...res.data };
      else s.samples.kits.unshift({ ...res.data });
    }, false, 'samples/createKit/done');
    return res.data;
  },
  submitFeedback: async (input: SampleFeedback, idempotencyKey?: string) => {
    const res = await api.sampleKits.feedback(input, idempotencyKey ?? crypto.randomUUID());
    if ('problem' in res) {
      set((s: any) => { s.samples.error = res.problem; }, false, 'samples/submitFeedback/error');
      return null;
    }
    set((s: any) => {
      const idx = s.samples.kits.findIndex((k: SampleKit) => k.id === res.data.id);
      if (idx >= 0) s.samples.kits[idx] = res.data;
    }, false, 'samples/submitFeedback/done');
    return res.data;
  },
});
