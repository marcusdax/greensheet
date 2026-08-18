import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAiStore } from '../../ai-store';
import { resetAiState } from './helpers/reset-ai';

const mockUuid = (value: string) =>
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(value as ReturnType<typeof crypto.randomUUID>);

describe('ai-slice', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAiState();
  });

  it('has default providers', () => {
    const ai = useAiStore.getState();
    expect(ai.providers.deepseek).toEqual({ apiKey: '', model: 'deepseek-chat', enabled: true });
    expect(ai.providers.claude).toEqual({ apiKey: '', model: 'claude-3-5-sonnet-20241022', enabled: false });
    expect(ai.providers.kimi).toEqual({ apiKey: '', model: 'moonshot-v1-8k', enabled: false });
    expect(ai.providers.gemini).toEqual({ apiKey: '', model: 'gemini-1.5-flash', enabled: false });
  });

  it('setProviderConfig merges provider config', () => {
    const ai = useAiStore.getState();
    ai.setProviderConfig('deepseek', { apiKey: 'sk-test', model: 'deepseek-reasoner' });
    expect(useAiStore.getState().providers.deepseek).toEqual({
      apiKey: 'sk-test',
      model: 'deepseek-reasoner',
      enabled: true,
    });
  });

  it('setActiveSession updates active session id', () => {
    const ai = useAiStore.getState();
    ai.setActiveSession('session-1');
    expect(useAiStore.getState().activeSessionId).toBe('session-1');
    ai.setActiveSession(null);
    expect(useAiStore.getState().activeSessionId).toBeNull();
  });

  it('sendMessage creates a new session when none is active', () => {
    mockUuid('new-session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('Hello, assistant');
    const state = useAiStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.activeSessionId).toBe('new-session-id');
    const session = state.sessions[0];
    expect(session.id).toBe('new-session-id');
    expect(session.title).toBe('Hello, assistant');
    expect(session.messages).toEqual([{ role: 'user', content: 'Hello, assistant' }]);
  });

  it('sendMessage truncates long titles', () => {
    mockUuid('long-session-id');
    const ai = useAiStore.getState();
    const longMessage = 'a'.repeat(50);
    ai.sendMessage(longMessage);
    const session = useAiStore.getState().sessions[0];
    expect(session.title).toBe('a'.repeat(40) + '…');
  });

  it('sendMessage appends to existing active session', () => {
    mockUuid('existing-session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('First');
    ai.sendMessage('Second');
    const session = useAiStore.getState().sessions[0];
    expect(session.messages).toHaveLength(2);
    expect(session.messages[1]).toEqual({ role: 'user', content: 'Second' });
  });

  it('appendAssistantChunk appends to last assistant message', () => {
    mockUuid('session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('Hello');
    ai.appendAssistantChunk('Hi');
    ai.appendAssistantChunk(' there');
    const session = useAiStore.getState().sessions[0];
    expect(session.messages).toHaveLength(2);
    expect(session.messages[1]).toEqual({ role: 'assistant', content: 'Hi there' });
  });

  it('appendAssistantChunk creates a new assistant message after user message', () => {
    mockUuid('session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('Hello');
    ai.appendAssistantChunk('First');
    ai.appendAssistantChunk('Second');
    const session = useAiStore.getState().sessions[0];
    expect(session.messages).toHaveLength(2);
    expect(session.messages[1].content).toBe('FirstSecond');
  });

  it('finalizeAssistantMessage updates session timestamp', () => {
    mockUuid('session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('Hello');
    ai.appendAssistantChunk('Reply');
    const before = useAiStore.getState().sessions[0].updatedAt;
    ai.finalizeAssistantMessage();
    const after = useAiStore.getState().sessions[0].updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });

  it('clearSession removes messages from active session without deleting it', () => {
    mockUuid('session-id');
    const ai = useAiStore.getState();
    ai.sendMessage('Hello');
    ai.clearSession();
    const session = useAiStore.getState().sessions[0];
    expect(session.messages).toHaveLength(0);
    expect(useAiStore.getState().activeSessionId).toBe('session-id');
  });

  it('deleteSession removes the session and updates active session', () => {
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('first' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('second' as ReturnType<typeof crypto.randomUUID>);
    const ai = useAiStore.getState();
    ai.sendMessage('First');
    ai.setActiveSession(null);
    ai.sendMessage('Second');
    // Two sessions exist; active is most recent.
    expect(useAiStore.getState().sessions).toHaveLength(2);
    ai.deleteSession('second');
    const state = useAiStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].id).toBe('first');
    expect(state.activeSessionId).toBe('first');
    spy.mockRestore();
  });

  it('deleteSession clears active session when deleting the last session', () => {
    mockUuid('only-session');
    const ai = useAiStore.getState();
    ai.sendMessage('Only');
    ai.deleteSession('only-session');
    const state = useAiStore.getState();
    expect(state.sessions).toHaveLength(0);
    expect(state.activeSessionId).toBeNull();
  });

  it('setStreaming updates streaming flag', () => {
    const ai = useAiStore.getState();
    ai.setStreaming(true);
    expect(useAiStore.getState().isStreaming).toBe(true);
    ai.setStreaming(false);
    expect(useAiStore.getState().isStreaming).toBe(false);
  });

  it('resetAi restores initial state', () => {
    const ai = useAiStore.getState();
    ai.setProviderConfig('claude', { enabled: true });
    ai.sendMessage('Hello');
    ai.setStreaming(true);
    ai.resetAi();
    const state = useAiStore.getState();
    expect(state.providers.claude.enabled).toBe(false);
    expect(state.sessions).toHaveLength(0);
    expect(state.activeSessionId).toBeNull();
    expect(state.isStreaming).toBe(false);
  });
});
