export type ProviderKey = 'deepseek' | 'claude' | 'kimi' | 'gemini';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiSlice {
  providers: Record<ProviderKey, ProviderConfig>;
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
  setProviderConfig: (provider: ProviderKey, config: Partial<ProviderConfig>) => void;
  setActiveSession: (id: string | null) => void;
  clearSession: () => void;
  deleteSession: (id: string) => void;
  sendMessage: (content: string) => void;
  appendAssistantChunk: (chunk: string) => void;
  finalizeAssistantMessage: () => void;
  setStreaming: (value: boolean) => void;
  resetAi: () => void;
}

export const defaultProviders: Record<ProviderKey, ProviderConfig> = {
  deepseek: { apiKey: '', model: 'deepseek-chat', enabled: true },
  claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', enabled: false },
  kimi: { apiKey: '', model: 'moonshot-v1-8k', enabled: false },
  gemini: { apiKey: '', model: 'gemini-1.5-flash', enabled: false },
};

export const initialAiState = {
  providers: defaultProviders,
  sessions: [],
  activeSessionId: null,
  isStreaming: false,
};

export function createAiSlice(set: any): AiSlice {
  return {
    ...initialAiState,

    setProviderConfig: (provider, config) =>
      set(
        (s: AiSlice) => {
          s.providers[provider] = { ...s.providers[provider], ...config };
        },
        false,
        'ai/setProviderConfig',
      ),

    setActiveSession: (id) =>
      set((s: AiSlice) => {
        s.activeSessionId = id;
      }, false, 'ai/setActiveSession'),

    clearSession: () =>
      set((s: AiSlice) => {
        const activeId = s.activeSessionId;
        if (activeId) {
          const session = s.sessions.find((x) => x.id === activeId);
          if (session) {
            session.messages = [];
            session.updatedAt = new Date().toISOString();
          }
        }
      }, false, 'ai/clearSession'),

    deleteSession: (id) =>
      set((s: AiSlice) => {
        s.sessions = s.sessions.filter((x) => x.id !== id);
        if (s.activeSessionId === id) {
          s.activeSessionId = s.sessions.length > 0 ? s.sessions[0].id : null;
        }
      }, false, 'ai/deleteSession'),

    sendMessage: (content) =>
      set((s: AiSlice) => {
        const now = new Date().toISOString();
        let session = s.sessions.find((x) => x.id === s.activeSessionId);
        if (!session) {
          session = {
            id: crypto.randomUUID(),
            title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
            messages: [],
            createdAt: now,
            updatedAt: now,
          };
          s.sessions.unshift(session);
          s.activeSessionId = session.id;
        }
        session.messages.push({ role: 'user', content });
        session.updatedAt = now;
      }, false, 'ai/sendMessage'),

    appendAssistantChunk: (chunk) =>
      set((s: AiSlice) => {
        const session = s.sessions.find((x) => x.id === s.activeSessionId);
        if (!session) return;
        const last = session.messages[session.messages.length - 1];
        if (last && last.role === 'assistant') {
          last.content += chunk;
        } else {
          session.messages.push({ role: 'assistant', content: chunk });
        }
        session.updatedAt = new Date().toISOString();
      }, false, 'ai/appendAssistantChunk'),

    finalizeAssistantMessage: () =>
      set((s: AiSlice) => {
        const session = s.sessions.find((x) => x.id === s.activeSessionId);
        if (session) {
          session.updatedAt = new Date().toISOString();
        }
      }, false, 'ai/finalizeAssistantMessage'),

    setStreaming: (value) =>
      set((s: AiSlice) => {
        s.isStreaming = value;
      }, false, 'ai/setStreaming'),

    resetAi: () =>
      set((s: AiSlice) => {
        s.providers = defaultProviders;
        s.sessions = [];
        s.activeSessionId = null;
        s.isStreaming = false;
      }, false, 'ai/resetAi'),
  };
}
