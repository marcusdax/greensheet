import { create } from 'zustand';
import type { PersistStorage } from 'zustand/middleware';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { aiPersistStorage } from '../lib/ai-persist-storage';
import { createAiSlice, type AiSlice } from './slices/ai-slice';

type AiPersistedState = Pick<AiSlice, 'providers' | 'sessions' | 'activeSessionId'>;

export const useAiStore = create<AiSlice>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set) => createAiSlice(set)),
      ),
      {
        name: 'greensheet:ai',
        version: 1,
        storage: aiPersistStorage as unknown as PersistStorage<AiPersistedState>,
        partialize: (s) => ({
          providers: s.providers,
          sessions: s.sessions,
          activeSessionId: s.activeSessionId,
        }),
      },
    ),
    { name: 'AiStore' },
  ),
);

export const useAi = () => useAiStore();
