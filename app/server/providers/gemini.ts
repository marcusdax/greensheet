import type { ProviderAdapter, ChatMessage } from './adapter';

export class GeminiAdapter implements ProviderAdapter {
  readonly provider = 'gemini';

  async *streamChat(_messages: ChatMessage[], _model: string, _apiKey: string) {
    yield { error: 'Gemini provider is not yet implemented. Enable DeepSeek to chat.' };
  }
}
