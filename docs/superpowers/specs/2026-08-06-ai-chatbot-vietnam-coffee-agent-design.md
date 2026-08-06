# AI Chatbot — Vietnam Coffee Omni-Expert

## Goal

Add a floating AI chat assistant to the Greensheet React app. The agent is a unified Vietnam coffee value-chain expert for ODASI Technologies Inc. Users configure provider keys in a settings panel and chat with the agent; responses stream token-by-token from a backend proxy. The first release wires DeepSeek and scaffolds UI inputs for Claude, Kimi, and Gemini.

## Decisions from brainstorming

- **UI placement:** Floating widget, bottom-right of every page.
- **Backend:** Node + Express proxy inside `app/server/`.
- **Providers:** Settings UI exposes DeepSeek, Claude, Kimi, and Gemini. Only DeepSeek is wired in the first version; the others return a 501-style "coming soon" response.
- **Streaming:** Server-Sent Events from proxy to frontend.
- **Persistence:** Provider keys and chat history stored in browser `localStorage` (obfuscated, not encrypted).

## 1. Architecture & data flow

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                    │
│  ┌──────────────────┐   ┌───────────────────────────────┐  │
│  │ AgentChatWidget  │──▶│ ai-slice (Zustand)            │  │
│  └──────────────────┘   │  providers, sessions,       │  │
│                         │  activeSessionId              │  │
│                         └───────────────┬───────────────┘  │
│                                         │                   │
│  ┌──────────────────┐   ┌─────────────▼──────────────┐  │
│  │ AiSettingsPanel  │◀──│ ai-client.ts               │  │
│  └──────────────────┘   │  POST + ReadableStream/SSE  │  │
│                         └─────────────┬──────────────┘  │
└─────────────────────────────────────────┼─────────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │ Express proxy        │
                              │ POST /api/v1/chat/   │
                              │ completions          │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │ Provider adapter       │
                              │ DeepSeek (OpenAI-    │
                              │ compatible)            │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │ DeepSeek API          │
                              └───────────────────────┘
```

Flow:
1. User sends a message; `ai-slice` appends it to the active session.
2. `ai-client.ts` POSTs `{provider, model, messages, stream: true}` to the proxy.
3. Proxy injects the Vietnam coffee system prompt, selects the adapter, and forwards the request.
4. Provider streams tokens; proxy forwards them as SSE `data:` lines.
5. Frontend decodes chunks and appends them to the assistant message in `ai-slice`.
6. On stream end, the completed message is persisted to `localStorage` via Zustand persist.

## 2. Backend proxy

Location: `app/server/`

Files:
- `index.ts` — Express bootstrap, CORS, JSON parsing, single route.
- `routes/chat.ts` — `POST /api/v1/chat/completions`, validates body, injects system prompt, dispatches to adapter, returns SSE.
- `providers/adapter.ts` — `ProviderAdapter` interface.
- `providers/deepseek.ts` — OpenAI-compatible adapter using the `openai` package.
- `providers/claude.ts`, `providers/kimi.ts`, `providers/gemini.ts` — stub adapters that throw `501 Provider not yet implemented`.
- `system-prompt/index.ts` — assembles the Vietnam coffee omni-expert prompt.
- `system-prompt/{base,domains,deliverables,curriculum}.ts` — prompt sections for maintainability.

Request body:
```json
{
  "provider": "deepseek",
  "model": "deepseek-chat",
  "messages": [
    { "role": "user", "content": "What should I know about EUDR for Robusta to Germany?" }
  ],
  "stream": true
}
```

SSE shape:
```
data: {"chunk": "Vietnam"}
data: {"chunk": " is"}
data: {"done": true}
```

Error events:
```
data: {"error": "Invalid API key"}
```

Dev script:
- `npm run dev:server` — runs the Express proxy on `AI_PROXY_PORT` (default 3001).
- `npm run dev:full` — runs Vite and the proxy concurrently.

Dependencies to add to `app/package.json`:
- `express`, `cors` — backend framework.
- `openai` — OpenAI-compatible client for DeepSeek (and future Kimi).
- `tsx` or `ts-node` — run TypeScript server in dev (use `tsx` for speed).
- `concurrently` — run Vite + proxy together under `dev:full`.
- `supertest` (dev) — optional, for HTTP-level proxy tests.

## 3. Frontend state & components

Zustand slice: `app/src/stores/slices/ai-slice.ts`

```ts
type ProviderKey = 'deepseek' | 'claude' | 'kimi' | 'gemini';

interface AiState {
  providers: Record<ProviderKey, {
    apiKey: string;
    model: string;
    enabled: boolean;
  }>;
  sessions: ChatSession[];
  activeSessionId: string | null;
  isStreaming: boolean;
}
```

Actions:
- `setProviderConfig(provider, config)`
- `sendMessage(content)` — appends user message, calls `ai-client`, streams response.
- `clearSession()` / `deleteSession(id)`
- `setActiveSession(id)`

Components:
- `app/src/components/agent/AgentChatWidget.tsx` — floating bubble + expandable panel.
- `app/src/components/agent/ChatHeader.tsx`
- `app/src/components/agent/ChatMessageList.tsx`
- `app/src/components/agent/ChatInput.tsx`
- `app/src/components/agent/AiSettingsPanel.tsx`

API client:
- `app/src/api/ai-client.ts` exposes `streamCompletion(payload)` returning an async iterator of `{chunk}` or `{done}`.
- Uses `fetch` + `ReadableStream` + `TextDecoder`.

Storage:
- Provider configs persisted under `greensheet:ai` with lightweight obfuscation (base64 + XOR with an app salt).
- Chat sessions persisted under the existing `greensheet-store` Zustand persist.

## 4. UI/UX

Mockups are saved in `.superpowers/brainstorm/767-1786029236/content/widget-layout.html`.

- Collapsed: circular button bottom-right with a robot icon.
- Expanded: 340 × 420 px panel with header, scrollable messages, and input.
- Settings: tabbed slide-out inside the widget with provider tabs, key input, model select, enable toggle.
- Non-wired providers show a coming-soon notice in their settings tab.
- Active provider is the first enabled provider in priority order: DeepSeek > Claude > Kimi > Gemini.

## 5. Agent persona injection

The complete Vietnam Coffee Industry Omni-Expert prompt is stored server-side in `app/server/system-prompt/`. The proxy prepends it as a `system` message on every request, so users cannot override the persona from the frontend.

Prompt sections:
- `base.ts` — role, tone, and decision-support style.
- `domains.ts` — agronomy, post-harvest, commodity markets, regulatory, roasting, sensory, marketing, operations, sustainability, forecasting.
- `deliverables.ts` — output formats.
- `curriculum.ts` — educational teaching program.
- `index.ts` — concatenates sections into the final system string.

## 6. i18n & accessibility

- New namespace `agent` added to `app/src/i18n/`.
- Keys cover widget title, input placeholder, settings labels, provider names, streaming status, and error messages.
- Provider brand names remain untranslated per project convention.
- `en-US` keys authored first; other locales fall back to English until translated.

Accessibility:
- Floating button is a real `<button>` with `aria-label="Open coffee agent chat"`.
- Expanded panel has `role="dialog"`, `aria-modal="true"`, and focus trapping.
- Message list uses `aria-live="polite"`.
- Settings form fields use explicit `<label>` elements.
- Contrast follows existing WCAG 2.1 AA tokens.

## 7. Testing strategy

Backend:
- `app/server/__tests__/deepseek-adapter.test.ts` — mock provider responses, assert SSE chunk emission.
- `app/server/__tests__/proxy.test.ts` — Express route validation, CORS, 501 stubs.
- `app/server/__tests__/system-prompt.test.ts` — prompt contains expected Vietnam coffee keywords.

Frontend:
- `app/src/stores/slices/__tests__/ai-slice.test.ts`
- `app/src/api/__tests__/ai-client.test.ts`
- `app/src/components/agent/__tests__/AgentChatWidget.test.tsx`
- `app/src/components/agent/__tests__/AiSettingsPanel.test.tsx`

Manual:
- `npm run dev:full`, enter a real DeepSeek key, verify streaming end-to-end.

## 8. Security & error handling

Security:
- API keys are sent only in the `Authorization` header between proxy and provider.
- Frontend stores keys obfuscated in `localStorage`, never plaintext.
- Proxy logs provider/model only, never keys or message content.
- CORS restricted to the Vite dev origin and the production origin via env.

Error handling:
- Provider network failure → SSE `{"error": "Provider unreachable"}`.
- Invalid key → provider message forwarded without key exposure.
- Missing/unsupported provider → `400` with a clear message.
- Stream interruption → UI shows "Connection lost. Retry?" with a retry action that resends the last user message.
- Rate limit → toast with retry-after hint.

Environment:
- `VITE_AI_PROXY_URL` for frontend proxy URL.
- `AI_PROXY_PORT` for backend port.
- `.env.example` documents both; no secrets committed.

## 9. Future work

- Wire Claude, Kimi, and Gemini adapters.
- Dedicated `/agent` route for full-screen deep sessions.
- Server-side persistence with encrypted keys and cross-session memory.
- RAG grounding from the Greensheet catalog and lot data.
- Voice/text-to-speech for hands-free cupping-lab use.
