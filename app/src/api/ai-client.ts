import type { ProviderKey, ChatMessage } from '../stores/slices/ai-slice';

export interface CompletionPayload {
  provider: ProviderKey;
  model: string;
  apiKey: string;
  messages: ChatMessage[];
}

export async function* streamCompletion(payload: CompletionPayload): AsyncGenerator<
  { chunk?: string; done?: boolean; error?: string },
  void,
  unknown
> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL ?? 'http://localhost:3001';
  const response = await fetch(`${proxyUrl}/api/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-provider-api-key': payload.apiKey,
    },
    body: JSON.stringify({
      provider: payload.provider,
      model: payload.model,
      messages: payload.messages,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    yield { error: text || `Proxy error: ${response.status}` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const dataLine = line.trim();
        if (!dataLine.startsWith('data: ')) continue;
        const json = dataLine.slice(6);
        if (json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json);
          yield parsed;
        } catch {
          yield { error: `Malformed SSE chunk: ${json}` };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
