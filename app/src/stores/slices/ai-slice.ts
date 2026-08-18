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
        (s: { ai: AiSlice }) => {
          s.ai.providers[provider] = { ...s.ai.providers[provider], ...config };
        },
        false,
        'ai/setProviderConfig',
      ),

    setActiveSession: (id) =>
      set((s: { ai: AiSlice }) => {
        s.ai.activeSessionId = id;
      }, false, 'ai/setActiveSession'),

    clearSession: () =>
      set((s: { ai: AiSlice }) => {
        const activeId = s.ai.activeSessionId;
        if (activeId) {
          const session = s.ai.sessions.find((x) => x.id === activeId);
          if (session) {
            session.messages = [];
            session.updatedAt = new Date().toISOString();
          }
        }
      }, false, 'ai/clearSession'),

    deleteSession: (id) =>
      set((s: { ai: AiSlice }) => {
        s.ai.sessions = s.ai.sessions.filter((x) => x.id !== id);
        if (s.ai.activeSessionId === id) {
          s.ai.activeSessionId = s.ai.sessions.length > 0 ? s.ai.sessions[0].id : null;
        }
      }, false, 'ai/deleteSession'),

    sendMessage: (content) =>
      set((s: { ai: AiSlice }) => {
        const now = new Date().toISOString();
        let session = s.ai.sessions.find((x) => x.id === s.ai.activeSessionId);
        if (!session) {
          session = {
            id: crypto.randomUUID(),
            title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
            messages: [],
            createdAt: now,
            updatedAt: now,
          };
          s.ai.sessions.unshift(session);
          s.ai.activeSessionId = session.id;
        }
        session.messages.push({ role: 'user', content });
        session.updatedAt = now;
      }, false, 'ai/sendMessage'),

    appendAssistantChunk: (chunk) =>
      set((s: { ai: AiSlice }) => {
        const session = s.ai.sessions.find((x) => x.id === s.ai.activeSessionId);
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
      set((s: { ai: AiSlice }) => {
        const session = s.ai.sessions.find((x) => x.id === s.ai.activeSessionId);
        if (session) {
          session.updatedAt = new Date().toISOString();
        }
      }, false, 'ai/finalizeAssistantMessage'),

    setStreaming: (value) =>
      set((s: { ai: AiSlice }) => {
        s.ai.isStreaming = value;
      }, false, 'ai/setStreaming'),

    resetAi: () =>
      set((s: { ai: AiSlice }) => {
        s.ai.providers = defaultProviders;
        s.ai.sessions = [];
        s.ai.activeSessionId = null;
        s.ai.isStreaming = false;
      }, false, 'ai/resetAi'),
  };
}
