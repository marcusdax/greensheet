import { describe, it, expect, beforeEach } from 'vitest';
import {
  AI_STORAGE_KEY,
  obfuscate,
  deobfuscate,
  aiPersistStorage,
} from '../ai-persist-storage';
import type { AiSlice } from '../../stores/slices/ai-slice';

describe('ai-persist-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('obfuscates and deobfuscates ASCII text', () => {
    const original = 'hello-world-123';
    const encoded = obfuscate(original);
    expect(encoded).not.toBe(original);
    expect(deobfuscate(encoded)).toBe(original);
  });

  it('obfuscates and deobfuscates unicode text', () => {
    const original = '你好世界 🌍 emojis';
    const encoded = obfuscate(original);
    expect(encoded).not.toBe(original);
    expect(deobfuscate(encoded)).toBe(original);
  });

  it('produces base64 output', () => {
    const encoded = obfuscate('test');
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('does not store apiKey in plain text', () => {
    const state: Partial<AiSlice> = {
      providers: {
        deepseek: { apiKey: 'sk-live-secret', model: 'deepseek-chat', enabled: true },
        claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', enabled: false },
        kimi: { apiKey: '', model: 'moonshot-v1-8k', enabled: false },
        gemini: { apiKey: '', model: 'gemini-1.5-flash', enabled: false },
      },
    };
    aiPersistStorage.setItem(AI_STORAGE_KEY, { state: state as AiSlice });
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(raw).not.toContain('sk-live-secret');
    expect(raw).not.toContain('deepseek-chat');
  });

  it('restores persisted state through getItem', async () => {
    const state: Partial<AiSlice> = {
      activeSessionId: 'session-1',
      sessions: [],
      providers: {
        deepseek: { apiKey: 'key', model: 'm', enabled: true },
        claude: { apiKey: '', model: 'm', enabled: false },
        kimi: { apiKey: '', model: 'm', enabled: false },
        gemini: { apiKey: '', model: 'm', enabled: false },
      },
    };
    aiPersistStorage.setItem(AI_STORAGE_KEY, { state: state as AiSlice });
    const restored = await Promise.resolve(aiPersistStorage.getItem(AI_STORAGE_KEY));
    expect(restored?.state.activeSessionId).toBe('session-1');
    expect(restored?.state.providers.deepseek.apiKey).toBe('key');
  });

  it('returns null when localStorage item is missing', async () => {
    expect(await Promise.resolve(aiPersistStorage.getItem('missing-key'))).toBeNull();
  });

  it('returns null when stored data is corrupted', async () => {
    localStorage.setItem(AI_STORAGE_KEY, 'not-valid-base64!!!');
    expect(await Promise.resolve(aiPersistStorage.getItem(AI_STORAGE_KEY))).toBeNull();
  });
});
