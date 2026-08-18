import type { ProviderAdapter, ChatMessage } from './adapter';

export class KimiAdapter implements ProviderAdapter {
  readonly provider = 'kimi';

  async *streamChat(_messages: ChatMessage[], _model: string, _apiKey: string) {
    yield { error: 'Kimi provider is not yet implemented. Enable DeepSeek to chat.' };
  }
}
